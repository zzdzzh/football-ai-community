import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import {
  upsertMatch,
  findMatchById,
  resolveCanonicalMatchId,
  findMatchByFixtureKey,
} from '../../src/db/repositories/match-repository.js';
import { upsertTeam } from '../../src/db/repositories/team-repository.js';
import { dedupeMatchesByFixtureKey } from '../../src/services/match-dedup-cleanup.js';
import {
  upsertMatchSyncMeta,
  getAllMatchSyncMeta,
} from '../../src/db/repositories/match-sync-meta-repository.js';
import { isMatchSyncStale } from '../../src/jobs/match-sync.js';

describe('match fixture dedup and sync freshness', () => {
  beforeAll(() => {
    runMigrations();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    const db = getDb();
    db.exec(`
      DELETE FROM feed_items WHERE match_id LIKE 'dup-%' OR match_id LIKE 'ss-dup-%';
      DELETE FROM matches WHERE id LIKE 'dup-%' OR id LIKE 'ss-dup-%';
      DELETE FROM teams WHERE id LIKE 'dup-team-%';
    `);
  });

  function seedTeams() {
    const now = new Date().toISOString();
    upsertTeam({ id: 'dup-team-home', name: 'Dup Home', shortName: 'DH', leagueCode: 'WC', updatedAt: now });
    upsertTeam({ id: 'dup-team-away', name: 'Dup Away', shortName: 'DA', leagueCode: 'WC', updatedAt: now });
  }

  it('resolveCanonicalMatchId reuses existing fixture key row', () => {
    seedTeams();
    upsertMatch({
      id: 'dup-fd-1',
      leagueCode: 'WC',
      utcDate: '2026-06-20T18:00:00Z',
      status: 'SCHEDULED',
      homeTeamId: 'dup-team-home',
      awayTeamId: 'dup-team-away',
      homeScore: null,
      awayScore: null,
      dataCompleteness: 'partial',
    });

    const canonical = resolveCanonicalMatchId({
      id: 'ss-dup-999',
      leagueCode: 'WC',
      homeTeamId: 'dup-team-home',
      awayTeamId: 'dup-team-away',
      utcDate: '2026-06-20T20:00:00Z',
    });

    expect(canonical).toBe('dup-fd-1');
    expect(findMatchByFixtureKey({
      leagueCode: 'WC',
      homeTeamId: 'dup-team-home',
      awayTeamId: 'dup-team-away',
      utcDate: '2026-06-20T12:00:00Z',
    })?.id).toBe('dup-fd-1');
  });

  it('dedupeMatchesByFixtureKey removes duplicate and remaps feed_items', () => {
    seedTeams();
    upsertMatch({
      id: 'dup-fd-2',
      leagueCode: 'WC',
      utcDate: '2026-06-21T18:00:00Z',
      status: 'SCHEDULED',
      homeTeamId: 'dup-team-home',
      awayTeamId: 'dup-team-away',
      homeScore: null,
      awayScore: null,
      dataCompleteness: 'partial',
    });
    upsertMatch({
      id: 'ss-dup-2',
      leagueCode: 'WC',
      utcDate: '2026-06-21T18:00:00Z',
      status: 'FINISHED',
      homeTeamId: 'dup-team-home',
      awayTeamId: 'dup-team-away',
      homeScore: 2,
      awayScore: 1,
      dataCompleteness: 'partial',
    });

    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO feed_items (
        id, agent_id, type, title, summary, source_url, source_name,
        key_points, event_key, related_to, visibility, published_at, created_at, match_id
      ) VALUES (?, 'news', 'match_report', 't', 's', NULL, NULL, NULL, NULL, NULL, 'public', ?, ?, ?)
    `).run('dup-feed-1', now, now, 'dup-fd-2');

    const result = dedupeMatchesByFixtureKey();
    expect(result.removedCount).toBeGreaterThanOrEqual(1);
    // FINISHED 优先于 SCHEDULED，保留 scraper 行
    expect(findMatchById('ss-dup-2')).toBeTruthy();
    expect(findMatchById('dup-fd-2')).toBeNull();

    const feed = db.prepare('SELECT match_id FROM feed_items WHERE id = ?').get('dup-feed-1');
    expect(feed.match_id).toBe('ss-dup-2');

    const kept = findMatchById('ss-dup-2');
    expect(kept.status).toBe('FINISHED');
    expect(kept.homeScore).toBe(2);
  });

  it('isMatchSyncStale detects old last_sync_at', () => {
    const leagues = getAllMatchSyncMeta().map((m) => m.leagueCode);
    const target = leagues[0] ?? 'PL';
    upsertMatchSyncMeta({
      leagueCode: target,
      lastSyncAt: '2020-01-01T00:00:00.000Z',
      lastError: null,
      status: 'ok',
      requestsInWindow: 0,
      windowStartedAt: '2020-01-01T00:00:00.000Z',
    });
    expect(isMatchSyncStale(24)).toBe(true);

    upsertMatchSyncMeta({
      leagueCode: target,
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      status: 'ok',
      requestsInWindow: 0,
      windowStartedAt: new Date().toISOString(),
    });
  });
});
