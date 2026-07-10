import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-32chars';
process.env.DATABASE_PATH = './data/test-contract.db';
process.env.AI_API_KEY = 'test-key';

const dbPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/test-contract.db');
if (existsSync(dbPath)) {
  try {
    rmSync(dbPath, { force: true, maxRetries: 10, retryDelay: 300 });
  } catch (err) {
    if (err.code !== 'EBUSY' && err.code !== 'EPERM') {
      throw err;
    }
  }
}
mkdirSync(dirname(dbPath), { recursive: true });
