import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb } from '../../src/db/connection.js';
import { createCareerSyncService } from '../../src/services/career-sync-service.js';
import { upsertCareerPlayer, findCareerPlayerById } from '../../src/db/repositories/career-player-repository.js';
import { upsertCareerClub } from '../../src/db/repositories/career-club-repository.js';
import {
  insertClubStint,
  listClubStintsByPlayerId,
} from '../../src/db/repositories/club-stint-repository.js';
import { listNationalTeamStintsByPlayerId } from '../../src/db/repositories/national-team-stint-repository.js';

const AS_OF = '2026-07-15';

function recentIso() {
  return new Date().toISOString();
}

function staleIso() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

function baseProfile(overrides = {}) {
  return {
    externalSource: 'transfermarkt',
    externalId: '90001',
    slug: 'test-player',
    name: 'Test Player',
    nameNormalized: 'test player',
    dateOfBirth: '1990-01-01',
    nationality: 'Spain',
    position: 'Forward',
    currentClub: { externalId: '100', name: 'Test FC' },
    clubStints: [
      {
        club: { externalId: '100', name: 'Test FC' },
        joinedRaw: '2019-01-01',
        leftRaw: '2021-06-30',
        transferType: 'transfer',
        sortOrder: 0,
      },
    ],
    nationalTeamStints: [
      {
        nationKey: 'spain',
        nationName: 'Spain',
        joinedRaw: '2018',
        leftRaw: '2022',
      },
    ],
    ...overrides,
  };
}

describe('CareerSyncService', () => {
  let mockFetchProfile;
  let mockSearch;
  let service;

  beforeAll(() => {
    runMigrations();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    mockFetchProfile = jest.fn();
    mockSearch = jest.fn();
    service = createCareerSyncService({
      adapter: { fetchProfile: mockFetchProfile, search: mockSearch },
      ttlDays: 7,
      asOf: AS_OF,
    });
  });

  it('ready + 近期 syncedAt 且未 force → TTL 命中跳过', async () => {
    const playerId = randomUUID();
    upsertCareerPlayer({
      id: playerId,
      externalSource: 'transfermarkt',
      externalId: 'ttl-001',
      name: 'TTL Player',
      nameNormalized: 'ttl player',
      syncedAt: recentIso(),
      syncStatus: 'ready',
    });

    const result = await service.syncPlayer({ playerId });

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('ttl_hit');
    expect(mockFetchProfile).not.toHaveBeenCalled();
  });

  it('force=true 忽略 TTL 仍执行同步', async () => {
    const playerId = randomUUID();
    upsertCareerPlayer({
      id: playerId,
      externalSource: 'transfermarkt',
      externalId: 'ttl-002',
      name: 'Force Player',
      nameNormalized: 'force player',
      syncedAt: recentIso(),
      syncStatus: 'ready',
    });
    mockFetchProfile.mockResolvedValue(baseProfile({ externalId: 'ttl-002' }));

    const result = await service.syncPlayer({ playerId, force: true });

    expect(result.skipped).toBe(false);
    expect(result.reason).toBe('synced');
    expect(mockFetchProfile).toHaveBeenCalled();
  });

  it('无 syncedAt 时不跳过 TTL', async () => {
    const playerId = randomUUID();
    upsertCareerPlayer({
      id: playerId,
      externalSource: 'transfermarkt',
      externalId: 'no-sync-at',
      name: 'No SyncAt',
      nameNormalized: 'no syncat',
      syncedAt: null,
      syncStatus: 'ready',
    });
    mockFetchProfile.mockResolvedValue(baseProfile({ externalId: 'no-sync-at' }));

    const result = await service.syncPlayer({ playerId });

    expect(result.skipped).toBe(false);
    expect(mockFetchProfile).toHaveBeenCalled();
  });

  it('无效 syncedAt 时不跳过 TTL', async () => {
    const playerId = randomUUID();
    upsertCareerPlayer({
      id: playerId,
      externalSource: 'transfermarkt',
      externalId: 'bad-sync-at',
      name: 'Bad SyncAt',
      nameNormalized: 'bad syncat',
      syncedAt: 'not-a-date',
      syncStatus: 'ready',
    });
    mockFetchProfile.mockResolvedValue(baseProfile({ externalId: 'bad-sync-at' }));

    const result = await service.syncPlayer({ playerId });

    expect(result.skipped).toBe(false);
    expect(mockFetchProfile).toHaveBeenCalled();
  });

  it('同步成功：fetchProfile 后事务内替换 stints', async () => {
    const playerId = randomUUID();
    const clubId = randomUUID();
    upsertCareerClub({
      id: clubId,
      externalSource: 'transfermarkt',
      externalId: 'old-club',
      name: 'Old Club',
      nameNormalized: 'old club',
    });
    upsertCareerPlayer({
      id: playerId,
      externalSource: 'transfermarkt',
      externalId: 'sync-ok',
      name: 'Sync OK',
      nameNormalized: 'sync ok',
      syncedAt: staleIso(),
      syncStatus: 'stale',
    });
    insertClubStint({
      id: randomUUID(),
      playerId,
      clubId,
      joinedRaw: 'old',
      leftRaw: 'old',
      joinedOn: '2000-01-01',
      leftOn: '2001-01-01',
      timePrecision: 'exact',
      sortOrder: 0,
    });

    mockFetchProfile.mockResolvedValue(baseProfile({
      externalId: 'sync-ok',
      clubStints: [
        {
          club: { externalId: '200', name: 'New Club' },
          joinedRaw: '2020-01-01',
          leftRaw: '2022-12-31',
          sortOrder: 1,
        },
      ],
      nationalTeamStints: [
        { nationKey: 'spain', nationName: 'Spain', joinedRaw: '2019', leftRaw: '2023' },
      ],
    }));

    const result = await service.syncPlayer({ playerId, force: true });

    expect(result.skipped).toBe(false);
    expect(result.player.syncStatus).toBe('ready');
    const clubStints = listClubStintsByPlayerId(playerId);
    expect(clubStints).toHaveLength(1);
    expect(clubStints[0].joinedOn).toBe('2020-01-01');
    const nationalStints = listNationalTeamStintsByPlayerId(playerId);
    expect(nationalStints).toHaveLength(1);
    expect(nationalStints[0].nationKey).toBe('spain');
  });

  it('同步失败：标记 failed、保留既有 stints、抛出 CAREER_SYNC_FAILED', async () => {
    const playerId = randomUUID();
    const clubId = randomUUID();
    upsertCareerClub({
      id: clubId,
      externalSource: 'transfermarkt',
      externalId: 'keep-club',
      name: 'Keep Club',
      nameNormalized: 'keep club',
    });
    upsertCareerPlayer({
      id: playerId,
      externalSource: 'transfermarkt',
      externalId: 'sync-fail',
      name: 'Sync Fail',
      nameNormalized: 'sync fail',
      syncedAt: staleIso(),
      syncStatus: 'ready',
    });
    insertClubStint({
      id: randomUUID(),
      playerId,
      clubId,
      joinedRaw: 'keep',
      leftRaw: 'keep',
      joinedOn: '2015-01-01',
      leftOn: '2016-01-01',
      timePrecision: 'exact',
      sortOrder: 0,
    });

    mockFetchProfile.mockRejectedValue(new Error('upstream timeout'));

    await expect(service.syncPlayer({ playerId, force: true })).rejects.toMatchObject({
      code: 'CAREER_SYNC_FAILED',
      playerId,
    });

    const player = findCareerPlayerById(playerId);
    expect(player.syncStatus).toBe('failed');
    expect(player.lastSyncError).toContain('upstream timeout');
    expect(listClubStintsByPlayerId(playerId)).toHaveLength(1);
  });

  it('缺少 playerId 与 externalId → MISSING_PLAYER', async () => {
    await expect(service.syncPlayer({})).rejects.toMatchObject({
      code: 'MISSING_PLAYER',
    });
  });

  it('仅 externalId 且球员不在库 → 创建球员并同步', async () => {
    mockFetchProfile.mockResolvedValue(baseProfile({
      externalId: 'new-ext-001',
      name: 'Brand New',
      nameNormalized: 'brand new',
    }));

    const result = await service.syncPlayer({ externalId: 'new-ext-001', slug: 'brand-new' });

    expect(result.skipped).toBe(false);
    expect(result.player.name).toBe('Brand New');
    expect(result.player.externalId).toBe('new-ext-001');
    expect(listClubStintsByPlayerId(result.player.id)).toHaveLength(1);
  });

  it('searchExternal 委托 adapter.search', async () => {
    mockSearch.mockResolvedValue([{ externalId: '1', name: 'Candidate' }]);

    const items = await service.searchExternal('messi', { limit: 5 });

    expect(mockSearch).toHaveBeenCalledWith('messi', { limit: 5 });
    expect(items).toHaveLength(1);
  });

  it('俱乐部 stint 缺少 name 与 externalId 时跳过', async () => {
    const playerId = randomUUID();
    upsertCareerPlayer({
      id: playerId,
      externalSource: 'transfermarkt',
      externalId: 'skip-club',
      name: 'Skip Club',
      nameNormalized: 'skip club',
      syncStatus: 'stale',
    });
    mockFetchProfile.mockResolvedValue(baseProfile({
      externalId: 'skip-club',
      clubStints: [
        { club: {}, joinedRaw: '2019', leftRaw: '2020', sortOrder: 0 },
        {
          club: { externalId: '300', name: 'Valid Club' },
          joinedRaw: '2021',
          leftRaw: '2022',
          sortOrder: 1,
        },
      ],
      nationalTeamStints: [],
    }));

    await service.syncPlayer({ playerId, force: true });

    const stints = listClubStintsByPlayerId(playerId);
    expect(stints).toHaveLength(1);
    expect(stints[0].joinedOn).toBe('2021-01-01');
  });

  it('国家队 stint 缺少 nationName 与 nationKey 时跳过', async () => {
    const playerId = randomUUID();
    upsertCareerPlayer({
      id: playerId,
      externalSource: 'transfermarkt',
      externalId: 'skip-nat',
      name: 'Skip Nat',
      nameNormalized: 'skip nat',
      syncStatus: 'stale',
    });
    mockFetchProfile.mockResolvedValue(baseProfile({
      externalId: 'skip-nat',
      clubStints: [],
      nationalTeamStints: [
        { joinedRaw: '2010', leftRaw: '2012' },
        { nationKey: 'brazil', nationName: 'Brazil', joinedRaw: '2013', leftRaw: '2015' },
      ],
    }));

    await service.syncPlayer({ playerId, force: true });

    const stints = listNationalTeamStintsByPlayerId(playerId);
    expect(stints).toHaveLength(1);
    expect(stints[0].nationKey).toBe('brazil');
  });

  it('仅 externalId 的俱乐部可合成名称入库', async () => {
    const playerId = randomUUID();
    upsertCareerPlayer({
      id: playerId,
      externalSource: 'transfermarkt',
      externalId: 'club-ext-only',
      name: 'Club Ext',
      nameNormalized: 'club ext',
      syncStatus: 'stale',
    });
    mockFetchProfile.mockResolvedValue(baseProfile({
      externalId: 'club-ext-only',
      currentClub: { externalId: '777' },
      clubStints: [
        {
          club: { externalId: '888' },
          joinedRaw: '2019',
          leftRaw: '2020',
          sortOrder: NaN,
        },
      ],
      nationalTeamStints: [
        { nationName: 'Portugal', joinedRaw: '2014', leftRaw: '2018' },
      ],
    }));

    await service.syncPlayer({ playerId, force: true });

    const clubStints = listClubStintsByPlayerId(playerId);
    expect(clubStints).toHaveLength(1);
    expect(clubStints[0].sortOrder).toBe(0);
    const nationalStints = listNationalTeamStintsByPlayerId(playerId);
    expect(nationalStints).toHaveLength(1);
    expect(nationalStints[0].nationKey).toBe('portugal');
  });

  it('外源失败且球员尚不存在 → 仍抛 CAREER_SYNC_FAILED（playerId 为 null）', async () => {
    mockFetchProfile.mockRejectedValue(new Error('not found'));

    await expect(service.syncPlayer({ externalId: 'ghost-999' })).rejects.toMatchObject({
      code: 'CAREER_SYNC_FAILED',
      playerId: null,
    });
  });

  it('profile 无 currentClub 与非数组 stints 可降级', async () => {
    const playerId = randomUUID();
    upsertCareerPlayer({
      id: playerId,
      externalSource: 'transfermarkt',
      externalId: 'sparse-profile',
      name: 'Sparse Profile',
      nameNormalized: 'sparse profile',
      syncStatus: 'stale',
    });
    mockFetchProfile.mockResolvedValue({
      externalId: 'sparse-profile',
      name: '',
      clubStints: null,
      nationalTeamStints: undefined,
    });

    const result = await service.syncPlayer({ playerId, force: true });

    expect(result.player.name).toBe('Sparse Profile');
    expect(listClubStintsByPlayerId(playerId)).toHaveLength(0);
    expect(listNationalTeamStintsByPlayerId(playerId)).toHaveLength(0);
  });

  it('仅 name 的俱乐部走 hash externalId', async () => {
    const playerId = randomUUID();
    upsertCareerPlayer({
      id: playerId,
      externalSource: 'transfermarkt',
      externalId: 'name-only-club',
      name: 'Name Only',
      nameNormalized: 'name only',
      syncStatus: 'stale',
    });
    mockFetchProfile.mockResolvedValue(baseProfile({
      externalId: 'name-only-club',
      currentClub: null,
      clubStints: [
        {
          club: { name: 'Unlisted FC' },
          joinedRaw: '2017',
          leftRaw: '2018',
        },
      ],
      nationalTeamStints: [],
    }));

    await service.syncPlayer({ playerId, force: true });

    expect(listClubStintsByPlayerId(playerId)).toHaveLength(1);
  });

  it('fetchProfile 抛出无 message 的错误仍可标记失败', async () => {
    const playerId = randomUUID();
    upsertCareerPlayer({
      id: playerId,
      externalSource: 'transfermarkt',
      externalId: 'err-no-msg',
      name: 'Err No Msg',
      nameNormalized: 'err no msg',
      syncStatus: 'ready',
      syncedAt: staleIso(),
    });
    mockFetchProfile.mockRejectedValue({ code: 'TIMEOUT' });

    await expect(service.syncPlayer({ playerId, force: true })).rejects.toMatchObject({
      code: 'CAREER_SYNC_FAILED',
    });
    expect(findCareerPlayerById(playerId).syncStatus).toBe('failed');
  });

  it('stale 状态即使 syncedAt 在 TTL 内也会同步', async () => {
    const playerId = randomUUID();
    upsertCareerPlayer({
      id: playerId,
      externalSource: 'transfermarkt',
      externalId: 'stale-status',
      name: 'Stale Status',
      nameNormalized: 'stale status',
      syncedAt: recentIso(),
      syncStatus: 'stale',
    });
    mockFetchProfile.mockResolvedValue(baseProfile({ externalId: 'stale-status' }));

    const result = await service.syncPlayer({ playerId });

    expect(result.skipped).toBe(false);
    expect(mockFetchProfile).toHaveBeenCalled();
  });

  it('可通过 externalId 查找已有球员', async () => {
    const playerId = randomUUID();
    upsertCareerPlayer({
      id: playerId,
      externalSource: 'transfermarkt',
      externalId: 'find-by-ext',
      name: 'Find By Ext',
      nameNormalized: 'find by ext',
      syncStatus: 'stale',
    });
    mockFetchProfile.mockResolvedValue(baseProfile({ externalId: 'find-by-ext' }));

    const result = await service.syncPlayer({ externalId: 'find-by-ext' });

    expect(result.player.id).toBe(playerId);
    expect(result.skipped).toBe(false);
  });

  it('新建球员且 profile 无 name 时使用 Player {externalId} 回退', async () => {
    mockFetchProfile.mockResolvedValue({
      externalId: 'no-name-ext',
      name: '',
      nameNormalized: '',
      clubStints: [],
      nationalTeamStints: [],
    });

    const result = await service.syncPlayer({ externalId: 'no-name-ext' });

    expect(result.player.name).toBe('Player no-name-ext');
  });

  it('仅 nationKey 的国家队 stint 可入库', async () => {
    const playerId = randomUUID();
    upsertCareerPlayer({
      id: playerId,
      externalSource: 'transfermarkt',
      externalId: 'nat-key-only',
      name: 'Nat Key',
      nameNormalized: 'nat key',
      syncStatus: 'stale',
    });
    mockFetchProfile.mockResolvedValue(baseProfile({
      externalId: 'nat-key-only',
      clubStints: [],
      nationalTeamStints: [
        { nationKey: 'germany', joinedRaw: '2011', leftRaw: '2014' },
      ],
    }));

    await service.syncPlayer({ playerId, force: true });

    const stints = listNationalTeamStintsByPlayerId(playerId);
    expect(stints).toHaveLength(1);
    expect(stints[0].nationName).toBe('germany');
  });

  it('stint 原始 join/leave 为 null 时写入 null', async () => {
    const playerId = randomUUID();
    upsertCareerPlayer({
      id: playerId,
      externalSource: 'transfermarkt',
      externalId: 'null-raw',
      name: 'Null Raw',
      nameNormalized: 'null raw',
      syncStatus: 'stale',
    });
    mockFetchProfile.mockResolvedValue(baseProfile({
      externalId: 'null-raw',
      clubStints: [
        {
          club: { externalId: '400', name: 'Raw Club' },
          joinedRaw: null,
          leftRaw: null,
          sortOrder: 2,
        },
      ],
      nationalTeamStints: [],
    }));

    await service.syncPlayer({ playerId, force: true });

    const stint = listClubStintsByPlayerId(playerId)[0];
    expect(stint.joinedRaw).toBeUndefined();
    expect(stint.leftRaw).toBeUndefined();
    expect(stint.sortOrder).toBe(2);
  });

  it('searchExternal 默认 limit=20', async () => {
    mockSearch.mockResolvedValue([]);
    await service.searchExternal('ronaldo');
    expect(mockSearch).toHaveBeenCalledWith('ronaldo', { limit: 20 });
  });

  it('过期 syncedAt 触发重新同步', async () => {
    const playerId = randomUUID();
    upsertCareerPlayer({
      id: playerId,
      externalSource: 'transfermarkt',
      externalId: 'expired-ttl',
      name: 'Expired TTL',
      nameNormalized: 'expired ttl',
      syncedAt: staleIso(),
      syncStatus: 'ready',
    });
    mockFetchProfile.mockResolvedValue(baseProfile({ externalId: 'expired-ttl' }));

    const result = await service.syncPlayer({ playerId });

    expect(result.skipped).toBe(false);
    expect(mockFetchProfile).toHaveBeenCalled();
  });
});
