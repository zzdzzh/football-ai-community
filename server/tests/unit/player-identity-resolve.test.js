import { randomUUID } from 'node:crypto';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import { upsertCareerPlayer } from '../../src/db/repositories/career-player-repository.js';
import { createActiveLink } from '../../src/db/repositories/player-identity-link-repository.js';
import {
  listLinkStatusByCareerPlayerIds,
  resolvePlayerIdentityLink,
  toLinkStatusItem,
  createPlayerIdentityResolveService,
} from '../../src/services/player-identity-resolve-service.js';

const CAREER_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01';
const CAREER_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccc02';
const CAREER_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccc03';

describe('player-identity-resolve-service', () => {
  beforeAll(() => {
    runMigrations();
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO teams (id, name, league_code, updated_at)
      VALUES ('team-resolve', 'Resolve FC', 'PL', ?)
    `).run(now);
    db.prepare(`
      INSERT OR REPLACE INTO players (
        id, name, team_id, position, date_of_birth, nationality, league_code, updated_at, transfermarkt_id
      ) VALUES ('resolve-stats-1', 'Resolve A', 'team-resolve', 'Forward', '1990-01-01', 'ES', 'PL', ?, 'resolve-tm-1')
    `).run(now);
    db.prepare(`
      INSERT OR REPLACE INTO players (
        id, name, team_id, position, date_of_birth, nationality, league_code, updated_at, transfermarkt_id
      ) VALUES ('resolve-stats-2', 'Resolve B', 'team-resolve', 'Midfielder', '1991-01-01', 'ES', 'PL', ?, 'resolve-tm-2')
    `).run(now);

    upsertCareerPlayer({
      id: CAREER_A,
      externalSource: 'transfermarkt',
      externalId: 'resolve-tm-1',
      name: 'Resolve A',
      nameNormalized: 'resolve a',
      syncedAt: now,
      syncStatus: 'ready',
    });
    upsertCareerPlayer({
      id: CAREER_B,
      externalSource: 'transfermarkt',
      externalId: 'resolve-tm-2',
      name: 'Resolve B',
      nameNormalized: 'resolve b',
      syncedAt: now,
      syncStatus: 'ready',
    });
    upsertCareerPlayer({
      id: CAREER_C,
      externalSource: 'transfermarkt',
      externalId: 'resolve-tm-3',
      name: 'Resolve C',
      nameNormalized: 'resolve c',
      syncedAt: now,
      syncStatus: 'ready',
    });

    createActiveLink({
      statsPlayerId: 'resolve-stats-1',
      careerPlayerId: CAREER_A,
      matchKey: 'resolve-tm-1',
      confidence: 'high',
    });
    const medium = createActiveLink({
      statsPlayerId: 'resolve-stats-2',
      careerPlayerId: CAREER_B,
      matchKey: 'resolve-tm-2',
      confidence: 'high',
    });
    db.prepare(`UPDATE player_identity_links SET confidence = 'medium' WHERE id = ?`).run(medium.id);

    // CAREER_C：仅有 shelved 行（无 active）→ 批量状态 unlinked，但走 mapLinkRow 分支
    db.prepare(`
      INSERT INTO player_identity_links (
        id, stats_player_id, career_player_id, match_basis, match_key,
        confidence, status, created_at, updated_at
      ) VALUES (?, 'resolve-stats-ghost', ?, 'transfermarkt_id', 'resolve-tm-3',
        'high', 'conflict_shelved', ?, ?)
    `).run(randomUUID(), CAREER_C, now, now);
  });

  afterAll(() => {
    closeDb();
  });

  describe('resolvePlayerIdentityLink', () => {
    it('resolves stats → career', () => {
      const result = resolvePlayerIdentityLink({ statsPlayerId: 'resolve-stats-1' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.link.careerPlayerId).toBe(CAREER_A);
        expect(result.link.confidence).toBe('high');
        expect(result.link.matchBasis).toBe('transfermarkt_id');
      }
    });

    it('resolves career → stats', () => {
      const result = resolvePlayerIdentityLink({ careerPlayerId: CAREER_A });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.link.statsPlayerId).toBe('resolve-stats-1');
      }
    });

    it('returns not_found when no mapping', () => {
      const result = resolvePlayerIdentityLink({ careerPlayerId: CAREER_C });
      expect(result).toEqual({
        ok: false,
        code: 'not_found',
        message: '未找到身份映射',
      });
    });

    it('returns bad_request when both params provided', () => {
      const result = resolvePlayerIdentityLink({
        statsPlayerId: 'resolve-stats-1',
        careerPlayerId: CAREER_A,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('bad_request');
    });

    it('returns bad_request when neither param provided', () => {
      const result = resolvePlayerIdentityLink();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('bad_request');
    });
  });

  describe('listLinkStatusByCareerPlayerIds / toLinkStatusItem', () => {
    it('maps linked / pending / unlinked', () => {
      const { items } = listLinkStatusByCareerPlayerIds([CAREER_A, CAREER_B, CAREER_C, CAREER_A]);
      expect(items).toHaveLength(3);
      const byId = Object.fromEntries(items.map((i) => [i.careerPlayerId, i]));
      expect(byId[CAREER_A].linkState).toBe('linked');
      expect(byId[CAREER_A].statsEntryPath).toBe('/players/resolve-stats-1');
      expect(byId[CAREER_B].linkState).toBe('pending_confirmation');
      expect(byId[CAREER_C].linkState).toBe('unlinked');
      expect(byId[CAREER_C].statsPlayerId).toBeNull();
    });

    it('handles empty input', () => {
      expect(listLinkStatusByCareerPlayerIds([]).items).toEqual([]);
      expect(listLinkStatusByCareerPlayerIds(undefined).items).toEqual([]);
    });

    it('unknown career id with no link rows → unlinked via ?? null', () => {
      const unknown = 'cccccccc-cccc-4ccc-8ccc-cccccccccc99';
      const { items } = listLinkStatusByCareerPlayerIds([unknown]);
      expect(items).toEqual([{
        careerPlayerId: unknown,
        linkState: 'unlinked',
        link: null,
        statsPlayerId: null,
        statsEntryPath: null,
      }]);
    });

    it('toLinkStatusItem treats invalid/shelved as unlinked', () => {
      expect(toLinkStatusItem('x', null).linkState).toBe('unlinked');
      expect(toLinkStatusItem('x', {
        id: randomUUID(),
        statsPlayerId: 's',
        careerPlayerId: 'x',
        matchBasis: 'transfermarkt_id',
        matchKey: 'k',
        confidence: 'high',
        status: 'invalid',
        createdAt: '',
        updatedAt: '',
      }).linkState).toBe('unlinked');
      expect(toLinkStatusItem('x', {
        id: randomUUID(),
        statsPlayerId: 's',
        careerPlayerId: 'x',
        matchBasis: 'transfermarkt_id',
        matchKey: 'k',
        confidence: 'high',
        status: 'conflict_shelved',
        createdAt: '',
        updatedAt: '',
      }).linkState).toBe('unlinked');
    });
  });

  it('factory export works', () => {
    const svc = createPlayerIdentityResolveService();
    expect(svc.resolvePlayerIdentityLink({ statsPlayerId: 'resolve-stats-1' }).ok).toBe(true);
  });
});
