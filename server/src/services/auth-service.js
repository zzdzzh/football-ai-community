import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { signToken } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';

const BCRYPT_ROUNDS = 10;

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nickname: z.string().min(2).max(32),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function mapUserRow(row) {
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    role: row.role,
    createdAt: row.created_at,
  };
}

export function registerUser(input) {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(400, 'bad_request', '请求参数无效');
  }

  const { email, password, nickname } = parsed.data;
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    throw new AppError(409, 'conflict', '邮箱已存在');
  }

  const now = new Date().toISOString();
  const userId = randomUUID();
  const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);

  db.prepare(`
    INSERT INTO users (id, email, password_hash, nickname, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'user', ?, ?)
  `).run(userId, email, passwordHash, nickname, now, now);

  const user = mapUserRow({
    id: userId,
    email,
    nickname,
    role: 'user',
    created_at: now,
  });

  const token = signToken({ sub: userId, email, role: 'user' });
  return { token, user };
}

export function loginUser(input) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(400, 'bad_request', '请求参数无效');
  }

  const { email, password } = parsed.data;
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    throw new AppError(401, 'unauthorized', '邮箱或密码错误');
  }

  const user = mapUserRow(row);
  const token = signToken({ sub: row.id, email: row.email, role: row.role });
  return { token, user };
}

export function getUserById(userId) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!row) {
    throw new AppError(404, 'not_found', '用户不存在');
  }
  return mapUserRow(row);
}
