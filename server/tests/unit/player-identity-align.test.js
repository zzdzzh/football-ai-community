import { randomUUID } from 'node:crypto';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import { upsertCareerPlayer } from '../../src/db/repositories/career-player-repository.js';
import {
  findActiveLinkByStatsPlayerId,
  findActiveLinkByCareerPlayerId,
  createActiveLink,
  updateLinkStatus,
} from '../../src/db/repositories/player-identity-link-repository.js';
import { findLatestConflictByMatchKey } from '../../src/db/repositories/player-identity-conflict-repository.js';
import {
  createPlayerIdentityAlignService,
  normalizeTransfermarktKey,
  alignPlayerIdentities,
  playerIdentityAlignService,
} from '../../src/services/player-identity-align-service.js';

function seedTeam() {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO teams (id, name, league_code, updated_at)
    VALUES ('team-align', 'Align FC', 'PL', ?)
  `).run(now);
}

function seedStatsPlayer({ id, name, transfermarktId }) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO players (
      id, name, team_id, position, date_of_birth, nationality, league_code, updated_at,
      transfermarkt_id
    ) VALUES (?, ?, 'team-align', 'Forward', '1995-01-01', 'Spain', 'PL', ?, ?)
  `).run(id, name, now, transfermarktId);
}

function seedCareerPlayer({
  id = randomUUID(),
  externalId,
  name,
  syncStatus = 'ready',
}) {
  return upsertCareerPlayer({
    id,
    externalSource: 'transfermarkt',
    externalId,
    name,
    nameNormalized: name.toLowerCase(),
    syncedAt: new Date().toISOString(),
    syncStatus,
  });
}

describe('normalizeTransfermarktKey', () => {
  it('trims valid id', () => {
    expect(normalizeTransfermarktKey('  28003  ')).toBe('28003');
  });

  it('rejects empty / null / literal null', () => {
    expect(normalizeTransfermarktKey(null)).toBeNull();
    expect(normalizeTransfermarktKey(undefined)).toBeNull();
    expect(normalizeTransfermarktKey('')).toBeNull();
    expect(normalizeTransfermarktKey('   ')).toBeNull();
    expect(normalizeTransfermarktKey('null')).toBeNull();
    expect(normalizeTransfermarktKey('NULL')).toBeNull();
  });
});

describe('PlayerIdentityAlignService', () => {
  let service;

  beforeAll(() => {
    runMigrations();
    seedTeam();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM player_identity_links').run();
    db.prepare('DELETE FROM player_identity_conflicts').run();
    db.prepare('DELETE FROM player_identity_align_runs').run();
    db.prepare("DELETE FROM players WHERE id LIKE 'align-%'").run();
    db.prepare("DELETE FROM career_players WHERE external_id LIKE 'align-tm-%'").run();
    service = createPlayerIdentityAlignService();
  });

  it('TM exact unique match → creates active high link', () => {
    seedStatsPlayer({ id: 'align-stats-1', name: 'Match Player', transfermarktId: 'align-tm-1' });
    const career = seedCareerPlayer({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
      externalId: 'align-tm-1',
      name: 'Match Player',
    });

    const result = service.align({ trigger: 'api' });

    expect(result.created).toBe(1);
    expect(result.conflict).toBe(0);
    expect(result.skipped).toBeGreaterThanOrEqual(0);
    expect(result.runId).toEqual(expect.any(String));
    expect(result.finishedAt).toEqual(expect.any(String));

    const link = findActiveLinkByStatsPlayerId('align-stats-1');
    expect(link).toMatchObject({
      careerPlayerId: career.id,
      matchBasis: 'transfermarkt_id',
      matchKey: 'align-tm-1',
      confidence: 'high',
      status: 'active',
    });
    expect(findActiveLinkByCareerPlayerId(career.id)?.statsPlayerId).toBe('align-stats-1');
  });

  it('missing TM on stats side → skip, no high link', () => {
    seedStatsPlayer({ id: 'align-stats-no-tm', name: 'No TM', transfermarktId: null });
    seedCareerPlayer({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
      externalId: 'align-tm-orphan',
      name: 'Orphan Career',
    });

    const result = service.align({ trigger: 'api' });

    expect(result.created).toBe(0);
    expect(findActiveLinkByStatsPlayerId('align-stats-no-tm')).toBeNull();
  });

  it('literal null TM → skip, no fabricated high link', () => {
    seedStatsPlayer({ id: 'align-stats-null', name: 'Null TM', transfermarktId: 'null' });
    seedCareerPlayer({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03',
      externalId: 'null',
      name: 'Bad Career',
    });

    const result = service.align({ trigger: 'api' });

    expect(result.created).toBe(0);
    expect(findActiveLinkByStatsPlayerId('align-stats-null')).toBeNull();
  });

  it('stats-side conflict (≥2 players same TM) → conflict row, no active high', () => {
    seedStatsPlayer({ id: 'align-stats-c1', name: 'Dup A', transfermarktId: 'align-tm-dup' });
    seedStatsPlayer({ id: 'align-stats-c2', name: 'Dup B', transfermarktId: 'align-tm-dup' });
    seedCareerPlayer({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04',
      externalId: 'align-tm-dup',
      name: 'Career Dup',
    });

    const result = service.align({ trigger: 'api' });

    expect(result.created).toBe(0);
    expect(result.conflict).toBeGreaterThanOrEqual(1);
    expect(findActiveLinkByStatsPlayerId('align-stats-c1')).toBeNull();
    expect(findActiveLinkByStatsPlayerId('align-stats-c2')).toBeNull();

    const conflict = findLatestConflictByMatchKey('align-tm-dup');
    expect(conflict).toMatchObject({
      matchBasis: 'transfermarkt_id',
      side: 'stats',
    });
    expect(conflict.candidateStatsIds).toEqual(
      expect.arrayContaining(['align-stats-c1', 'align-stats-c2']),
    );
  });

  it('career sync_status=failed → skip new link, does not delete nothing', () => {
    seedStatsPlayer({ id: 'align-stats-fail', name: 'Fail Pair', transfermarktId: 'align-tm-fail' });
    seedCareerPlayer({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05',
      externalId: 'align-tm-fail',
      name: 'Failed Career',
      syncStatus: 'failed',
    });

    const result = service.align({ trigger: 'api' });

    expect(result.created).toBe(0);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
    expect(findActiveLinkByStatsPlayerId('align-stats-fail')).toBeNull();
  });

  it('same name without shared TM MUST NOT create high confidence link', () => {
    seedStatsPlayer({
      id: 'align-stats-name',
      name: 'Same Name Player',
      transfermarktId: 'align-tm-name-a',
    });
    seedCareerPlayer({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06',
      externalId: 'align-tm-name-b',
      name: 'Same Name Player',
    });

    const result = service.align({ trigger: 'api' });

    expect(result.created).toBe(0);
    expect(findActiveLinkByStatsPlayerId('align-stats-name')).toBeNull();
  });

  it('scoped align by statsPlayerId only processes that player', () => {
    seedStatsPlayer({ id: 'align-stats-scope-a', name: 'Scope A', transfermarktId: 'align-tm-sa' });
    seedStatsPlayer({ id: 'align-stats-scope-b', name: 'Scope B', transfermarktId: 'align-tm-sb' });
    seedCareerPlayer({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa07',
      externalId: 'align-tm-sa',
      name: 'Scope A',
    });
    seedCareerPlayer({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08',
      externalId: 'align-tm-sb',
      name: 'Scope B',
    });

    const result = service.align({ trigger: 'api', statsPlayerId: 'align-stats-scope-a' });

    expect(result.created).toBe(1);
    expect(findActiveLinkByStatsPlayerId('align-stats-scope-a')).not.toBeNull();
    expect(findActiveLinkByStatsPlayerId('align-stats-scope-b')).toBeNull();
  });

  it('idempotent: existing active unique link counts as skip not duplicate create', () => {
    seedStatsPlayer({ id: 'align-stats-idem', name: 'Idem', transfermarktId: 'align-tm-idem' });
    seedCareerPlayer({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa09',
      externalId: 'align-tm-idem',
      name: 'Idem',
    });

    const first = service.align({ trigger: 'api' });
    const second = service.align({ trigger: 'api' });

    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(second.skipped).toBeGreaterThanOrEqual(1);
  });

  it('scoped align by careerPlayerId creates link for that career only', () => {
    seedStatsPlayer({ id: 'align-stats-cscope', name: 'CScope', transfermarktId: 'align-tm-cs' });
    seedStatsPlayer({ id: 'align-stats-other', name: 'Other', transfermarktId: 'align-tm-other' });
    const career = seedCareerPlayer({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10',
      externalId: 'align-tm-cs',
      name: 'CScope',
    });
    seedCareerPlayer({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11',
      externalId: 'align-tm-other',
      name: 'Other',
    });

    const result = service.align({ trigger: 'api', careerPlayerId: career.id });

    expect(result.created).toBe(1);
    expect(findActiveLinkByCareerPlayerId(career.id)).not.toBeNull();
    expect(findActiveLinkByStatsPlayerId('align-stats-other')).toBeNull();
  });

  it('careerPlayerId not found → skipped with note', () => {
    const result = service.align({
      trigger: 'api',
      careerPlayerId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    });
    expect(result.created).toBe(0);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
    expect(result.notes).toMatch(/career_not_found/);
  });

  it('careerPlayerId without valid TM → skipped', () => {
    const career = seedCareerPlayer({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12',
      externalId: 'null',
      name: 'No Key',
    });
    const result = service.align({ trigger: 'api', careerPlayerId: career.id });
    expect(result.created).toBe(0);
    expect(result.notes).toMatch(/career_missing_tm/);
  });

  it('career-side multi candidates → conflict no active', () => {
    seedStatsPlayer({ id: 'align-stats-cc', name: 'CC', transfermarktId: 'align-tm-cc' });
    const mocked = createPlayerIdentityAlignService({
      listCareerCandidatesByTm: () => ([
        { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa13', external_id: 'align-tm-cc', sync_status: 'ready', name: 'A' },
        { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa14', external_id: 'align-tm-cc', sync_status: 'ready', name: 'B' },
      ]),
    });

    const result = mocked.align({ trigger: 'api', statsPlayerId: 'align-stats-cc' });

    expect(result.created).toBe(0);
    expect(result.conflict).toBeGreaterThanOrEqual(1);
    expect(findActiveLinkByStatsPlayerId('align-stats-cc')).toBeNull();
    expect(findLatestConflictByMatchKey('align-tm-cc')?.side).toBe('career');
  });

  it('createActiveLink failure → both-side conflict', () => {
    seedStatsPlayer({ id: 'align-stats-throw', name: 'Throw', transfermarktId: 'align-tm-throw' });
    seedCareerPlayer({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa15',
      externalId: 'align-tm-throw',
      name: 'Throw',
    });
    const mocked = createPlayerIdentityAlignService({
      createActiveLink: () => {
        throw new Error('active uniqueness conflict on stats');
      },
    });

    const result = mocked.align({ trigger: 'api', statsPlayerId: 'align-stats-throw' });

    expect(result.created).toBe(0);
    expect(result.conflict).toBe(1);
    expect(findLatestConflictByMatchKey('align-tm-throw')?.side).toBe('both');
  });

  it('statsPlayerId filter miss on candidates → skip', () => {
    seedStatsPlayer({ id: 'align-stats-miss', name: 'Miss', transfermarktId: 'align-tm-miss' });
    const mocked = createPlayerIdentityAlignService({
      listStatsCandidatesByTm: () => ([{ id: 'someone-else', transfermarkt_id: 'align-tm-miss', name: 'X' }]),
    });
    const result = mocked.align({ trigger: 'api', statsPlayerId: 'align-stats-miss' });
    expect(result.created).toBe(0);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });

  it('empty stats candidates for key → skip', () => {
    const mocked = createPlayerIdentityAlignService({
      listStatsPlayersWithTm: () => ([{ id: 'align-ghost', transfermarkt_id: 'align-tm-ghost', name: 'G' }]),
      listStatsCandidatesByTm: () => [],
    });
    const result = mocked.align({ trigger: 'api' });
    expect(result.created).toBe(0);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });

  it('careerPlayerId filter miss on key → skip', () => {
    seedStatsPlayer({ id: 'align-stats-chit', name: 'CHit', transfermarktId: 'align-tm-chit' });
    const career = seedCareerPlayer({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa16',
      externalId: 'align-tm-chit',
      name: 'CHit',
    });
    const mocked = createPlayerIdentityAlignService({
      listCareerCandidatesByTm: () => ([
        { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa99', external_id: 'align-tm-chit', sync_status: 'ready', name: 'Other' },
      ]),
    });
    const result = mocked.align({ trigger: 'api', careerPlayerId: career.id });
    expect(result.created).toBe(0);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });

  it('career external_source not transfermarkt → career_missing_tm', () => {
    const mocked = createPlayerIdentityAlignService({
      findCareerById: () => ({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17',
        external_source: 'other',
        external_id: 'align-tm-other-src',
      }),
    });
    const result = mocked.align({
      trigger: 'api',
      careerPlayerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17',
    });
    expect(result.notes).toMatch(/career_missing_tm/);
  });

  it('careerPlayerId only (no stats rows yet) loads key into byKey', () => {
    seedStatsPlayer({ id: 'align-stats-late', name: 'Late', transfermarktId: 'align-tm-late' });
    const career = seedCareerPlayer({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa19',
      externalId: 'align-tm-late',
      name: 'Late',
    });
    const mocked = createPlayerIdentityAlignService({
      listStatsPlayersWithTm: () => [],
    });
    const result = mocked.align({ trigger: 'api', careerPlayerId: career.id });
    expect(result.created).toBe(1);
  });

  it('existing shelved link is upgraded to active high', () => {
    seedStatsPlayer({ id: 'align-stats-up', name: 'Up', transfermarktId: 'align-tm-up' });
    const career = seedCareerPlayer({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa20',
      externalId: 'align-tm-up',
      name: 'Up',
    });
    const link = createActiveLink({
      statsPlayerId: 'align-stats-up',
      careerPlayerId: career.id,
      matchKey: 'align-tm-up',
    });
    updateLinkStatus(link.id, { status: 'conflict_shelved', confidence: 'high' });

    const result = service.align({ trigger: 'api', statsPlayerId: 'align-stats-up' });
    expect(result.created).toBe(1);
    expect(findActiveLinkByStatsPlayerId('align-stats-up')?.status).toBe('active');
  });

  it('alignPlayerIdentities wrapper works without factory', () => {
    seedStatsPlayer({ id: 'align-stats-wrap', name: 'Wrap', transfermarktId: 'align-tm-wrap' });
    seedCareerPlayer({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18',
      externalId: 'align-tm-wrap',
      name: 'Wrap',
    });
    const result = alignPlayerIdentities({ statsPlayerId: 'align-stats-wrap' });
    expect(result.created).toBe(1);
    expect(result.runId).toEqual(expect.any(String));
  });

  it('unknown statsPlayerId yields empty scan', () => {
    const result = playerIdentityAlignService.align({
      trigger: 'cron',
      statsPlayerId: 'align-stats-does-not-exist',
    });
    expect(result.created).toBe(0);
    expect(result.finishedAt).toEqual(expect.any(String));
  });

  it('align() and alignPlayerIdentities() accept empty options', () => {
    const a = createPlayerIdentityAlignService().align(undefined);
    const b = alignPlayerIdentities(undefined);
    expect(a.runId).toEqual(expect.any(String));
    expect(b.runId).toEqual(expect.any(String));
  });
});
