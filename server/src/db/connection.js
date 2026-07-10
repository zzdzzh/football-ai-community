import Database from 'better-sqlite3';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { config } from '../config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let dbInstance = null;

export function getDb() {
  if (!dbInstance) {
    const dbPath = resolve(config.databasePath);
    mkdirSync(dirname(dbPath), { recursive: true });
    dbInstance = new Database(dbPath);
    dbInstance.pragma('foreign_keys = ON');
  }
  return dbInstance;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function resetDbForTests() {
  closeDb();
  dbInstance = null;
}

export function getMigrationsDir() {
  return resolve(__dirname, 'migrations');
}
