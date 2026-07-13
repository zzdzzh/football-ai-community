import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../src/config/index.js';
import { getDb } from '../src/db/connection.js';

const BCRYPT_ROUNDS = 10;

function seedAdminUser() {
  const email = config.adminEmail;
  const password = config.adminPassword;

  if (!email || !password) {
    console.error('请在 server/.env 中配置 ADMIN_EMAIL 与 ADMIN_PASSWORD');
    process.exit(1);
  }

  const db = getDb();
  const existing = db.prepare('SELECT id, email, role FROM users WHERE email = ?').get(email);
  const now = new Date().toISOString();

  if (existing) {
    db.prepare(`
      UPDATE users
      SET role = 'admin', password_hash = ?, nickname = ?, updated_at = ?
      WHERE id = ?
    `).run(bcrypt.hashSync(password, BCRYPT_ROUNDS), '管理员', now, existing.id);
    console.log(`已更新管理员账号: ${email} (role=admin)`);
    return;
  }

  const userId = randomUUID();
  db.prepare(`
    INSERT INTO users (id, email, password_hash, nickname, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'admin', ?, ?)
  `).run(userId, email, bcrypt.hashSync(password, BCRYPT_ROUNDS), '管理员', now, now);

  console.log(`已创建管理员账号: ${email} (role=admin)`);
}

seedAdminUser();
