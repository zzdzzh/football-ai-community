import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getDb, getMigrationsDir } from './connection.js';
import { dedupeFeedItemsBySourceUrl } from '../services/feed-dedup-cleanup.js';

const MIGRATION_FILES = [
  '001_initial.sql',
  '002_seed_agents.sql',
  '003_stats_content.sql',
  '004_add_wc_league.sql',
  '005_feed_source_url_unique.sql',
  '006_scout_tactical.sql',
  '007_scout_conversation_context.sql',
];

function ensureMigrationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

function isMigrationApplied(db, migrationId) {
  const row = db.prepare('SELECT id FROM schema_migrations WHERE id = ?').get(migrationId);
  return Boolean(row);
}

function markMigrationApplied(db, migrationId) {
  db.prepare('INSERT OR IGNORE INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(
    migrationId,
    new Date().toISOString(),
  );
}

export function runMigrations() {
  const db = getDb();
  ensureMigrationTable(db);

  const migrationsDir = getMigrationsDir();
  const available = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of MIGRATION_FILES) {
    if (!available.includes(file)) {
      throw new Error(`Missing migration file: ${file}`);
    }
    const migrationId = file.replace('.sql', '');
    if (isMigrationApplied(db, migrationId)) {
      continue;
    }
    if (migrationId === '005_feed_source_url_unique') {
      dedupeFeedItemsBySourceUrl();
    }
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    db.exec(sql);
    markMigrationApplied(db, migrationId);
  }
}

export function runSeed() {
  runMigrations();
}
