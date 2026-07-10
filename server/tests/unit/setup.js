import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-32chars';
process.env.DATABASE_PATH = './data/test-unit-auth.db';
process.env.AI_API_KEY = 'test-key';

const dbPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/test-unit-auth.db');
if (existsSync(dbPath)) {
  unlinkSync(dbPath);
}
mkdirSync(dirname(dbPath), { recursive: true });
