import { describe, it, expect, jest } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb } from '../../src/db/connection.js';
import {
  hasMinimumRole,
  optionalAuth,
  requireAuth,
  requireRole,
  signToken,
  verifyToken,
} from '../../src/middleware/auth.js';
import { AppError } from '../../src/middleware/error.js';
import {
  getUserById,
  loginUser,
  registerUser,
} from '../../src/services/auth-service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = resolve(__dirname, '../..');
const SRC_ROOT = join(SERVER_ROOT, 'src');

function walkFiles(dir, extension, acc = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walkFiles(fullPath, extension, acc);
    } else if (fullPath.endsWith(extension)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function readSrcBundle() {
  const files = walkFiles(SRC_ROOT, '.js');
  return files.map((file) => readFileSync(file, 'utf8')).join('\n');
}

describe('auth middleware', () => {
  describe('signToken and verifyToken', () => {
    it('round trips jwt payload', () => {
      const token = signToken({ sub: 'user-1', email: 'jwt@example.com', role: 'user' });
      const decoded = verifyToken(token);
      expect(decoded.sub).toBe('user-1');
      expect(decoded.email).toBe('jwt@example.com');
      expect(decoded.role).toBe('user');
    });

    it('throws for invalid token', () => {
      expect(() => verifyToken('not-a-jwt')).toThrow();
    });
  });

  describe('optionalAuth', () => {
    it('continues as guest without authorization header', () => {
      const req = { headers: {} };
      const next = jest.fn();
      optionalAuth(req, {}, next);
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('continues as guest when authorization is not Bearer', () => {
      const req = { headers: { authorization: 'Basic abc' } };
      const next = jest.fn();
      optionalAuth(req, {}, next);
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('attaches user for valid bearer token', () => {
      const token = signToken({ sub: 'uid-1', email: 'ok@example.com', role: 'moderator' });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const next = jest.fn();
      optionalAuth(req, {}, next);
      expect(req.user).toEqual({
        id: 'uid-1',
        email: 'ok@example.com',
        role: 'moderator',
      });
      expect(next).toHaveBeenCalledWith();
    });

    it('ignores invalid bearer token and continues as guest', () => {
      const req = { headers: { authorization: 'Bearer invalid-token' } };
      const next = jest.fn();
      optionalAuth(req, {}, next);
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('requireAuth', () => {
    it('returns 401 when user is missing', () => {
      const req = {};
      const next = jest.fn();
      requireAuth(req, {}, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it('continues when user exists', () => {
      const req = { user: { id: 'u1', role: 'user' } };
      const next = jest.fn();
      requireAuth(req, {}, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('requireRole', () => {
    const guard = requireRole('admin', 'moderator');

    it('returns 401 when user is missing', () => {
      const req = {};
      const next = jest.fn();
      guard(req, {}, next);
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it('returns 403 when role is not allowed', () => {
      const req = { user: { id: 'u1', role: 'user' } };
      const next = jest.fn();
      guard(req, {}, next);
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });

    it('continues when role is allowed', () => {
      const req = { user: { id: 'u1', role: 'admin' } };
      const next = jest.fn();
      guard(req, {}, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('hasMinimumRole', () => {
    it('returns true when user role meets requirement', () => {
      expect(hasMinimumRole('admin', 'user')).toBe(true);
      expect(hasMinimumRole('moderator', 'moderator')).toBe(true);
    });

    it('returns false when user role is insufficient', () => {
      expect(hasMinimumRole('user', 'admin')).toBe(false);
      expect(hasMinimumRole('guest', 'user')).toBe(false);
    });

    it('handles unknown roles conservatively', () => {
      expect(hasMinimumRole('unknown', 'user')).toBe(false);
      expect(hasMinimumRole('admin', 'unknown')).toBe(false);
    });
  });
});

describe('auth service', () => {
  beforeAll(() => {
    runMigrations();
  });

  afterAll(() => {
    closeDb();
  });

  const unique = () => `auth-unit-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  describe('registerUser', () => {
    it('registers user with hashed password and token', () => {
      const email = unique();
      const result = registerUser({
        email,
        password: 'password123',
        nickname: '单元测试',
      });

      expect(result.token).toEqual(expect.any(String));
      expect(result.user.email).toBe(email);
      expect(result.user.role).toBe('user');
      const verified = verifyToken(result.token);
      expect(verified.sub).toBe(result.user.id);
    });

    it('throws 409 when email already exists', () => {
      const email = unique();
      registerUser({ email, password: 'password123', nickname: '重复用户' });
      expect(() => registerUser({ email, password: 'password123', nickname: '重复用户2' }))
        .toThrow(expect.objectContaining({ statusCode: 409 }));
    });

    it('throws 400 for invalid register payload', () => {
      expect(() => registerUser({ email: 'bad', password: 'short', nickname: 'x' }))
        .toThrow(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('loginUser', () => {
    it('logs in with valid credentials', () => {
      const email = unique();
      const password = 'password123';
      registerUser({ email, password, nickname: '登录测试' });
      const result = loginUser({ email, password });
      expect(result.user.email).toBe(email);
      expect(result.token).toEqual(expect.any(String));
    });

    it('throws 401 for unknown email', () => {
      expect(() => loginUser({ email: unique(), password: 'password123' }))
        .toThrow(expect.objectContaining({ statusCode: 401 }));
    });

    it('throws 401 for wrong password', () => {
      const email = unique();
      registerUser({ email, password: 'password123', nickname: '密码测试' });
      expect(() => loginUser({ email, password: 'wrong-password' }))
        .toThrow(expect.objectContaining({ statusCode: 401 }));
    });

    it('throws 400 for invalid login payload', () => {
      expect(() => loginUser({ email: 'not-email', password: '' }))
        .toThrow(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('getUserById', () => {
    it('returns user by id', () => {
      const email = unique();
      const { user } = registerUser({ email, password: 'password123', nickname: '查询测试' });
      const found = getUserById(user.id);
      expect(found.email).toBe(email);
    });

    it('throws 404 when user does not exist', () => {
      expect(() => getUserById('00000000-0000-0000-0000-000000000000'))
        .toThrow(expect.objectContaining({ statusCode: 404 }));
    });
  });
});

describe('quickstart.md validation', () => {
  it('exposes scripts documented in quickstart', () => {
    const pkg = JSON.parse(readFileSync(join(SERVER_ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts.dev).toBeDefined();
    expect(pkg.scripts['db:migrate']).toBeDefined();
    expect(pkg.scripts['db:seed']).toBeDefined();
    expect(pkg.scripts.test).toBeDefined();
    expect(pkg.scripts['test:contract']).toBeDefined();
  });

  it('documents MVP-1 API surface in openapi contract', () => {
    const openapi = readFileSync(
      resolve(SERVER_ROOT, '../specs/001-football-feed-mvp/contracts/openapi.yaml'),
      'utf8',
    );
    expect(openapi).toContain('/health');
    expect(openapi).toContain('/auth/register');
    expect(openapi).toContain('/feed');
    expect(openapi).toContain('/users/me/preferences');
    expect(openapi).toContain('/internal/jobs/news-fetch');
  });
});

describe('MVP-1 scope boundary audit', () => {
  it('has zero billing implementation', () => {
    const bundle = readSrcBundle();
    const migrationSql = readFileSync(
      join(SRC_ROOT, 'db/migrations/001_initial.sql'),
      'utf8',
    );
    expect(bundle).not.toMatch(/\bbilling\b/i);
    expect(migrationSql).not.toMatch(/\bbilling\b/i);
  });

  it('keeps AgentProfile read-only without create/update API', () => {
    const apiBundle = walkFiles(join(SRC_ROOT, 'api'), '.js')
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    expect(apiBundle).not.toMatch(/createAgentProfile|updateAgentProfile|router\.post\(['"]\/agents/);
  });

  it('allows football-data config; fan and conversations routes implemented', () => {
    const bundle = readSrcBundle();
    expect(bundle).toMatch(/\/fan-discussions/);
    expect(bundle).toMatch(/FOOTBALL_DATA_API_KEY/);
    expect(bundle).toMatch(/\/matches|match-sync|\/conversations/);
  });
});
