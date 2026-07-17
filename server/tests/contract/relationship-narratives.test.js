import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';

const mockGenerateNarrative = jest.fn();

jest.unstable_mockModule('../../src/ai/ai-relationship-service.js', () => ({
  AiRelationshipService: class {},
  createAiRelationshipService: () => ({
    generateNarrative: mockGenerateNarrative,
  }),
}));

const { default: request } = await import('supertest');
const { runMigrations } = await import('../../src/db/migrate.js');
const { closeDb, getDb } = await import('../../src/db/connection.js');
const { createApp } = await import('../../src/app.js');
const { registerAndLogin } = await import('../helpers/seed-match-data.js');
const { upsertCareerClub } = await import('../../src/db/repositories/career-club-repository.js');
const { upsertCareerPlayer } = await import('../../src/db/repositories/career-player-repository.js');
const { insertClubStint } = await import('../../src/db/repositories/club-stint-repository.js');
const { upsertPlayerPairAnalysis } = await import('../../src/db/repositories/player-pair-analysis-repository.js');
const { resetAiRateLimitStore } = await import('../../src/services/ai-rate-limit.js');

const PLAYER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PLAYER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CLUB_BARCA = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const COMPUTED_AT = '2026-07-17T12:00:00.000Z';

function validAiText() {
  return JSON.stringify({
    narrative: '两人曾在 FC Barcelona 有重叠效力时段。',
    claims: [{
      type: 'clubmate',
      status: 'established',
      clubName: 'FC Barcelona',
      overlapFrom: '2014-07-11',
      overlapTo: '2020-09-23',
    }],
  });
}

function seedReadyPairAnalysis() {
  const now = new Date().toISOString();

  upsertCareerClub({
    id: CLUB_BARCA,
    externalSource: 'transfermarkt',
    externalId: '131',
    name: 'FC Barcelona',
    nameNormalized: 'fc barcelona',
  });

  upsertCareerPlayer({
    id: PLAYER_A,
    externalSource: 'transfermarkt',
    externalId: '28003',
    name: 'Lionel Messi',
    nameNormalized: 'lionel messi',
    dateOfBirth: '1987-06-24',
    nationality: 'Argentina',
    currentClubName: 'Inter Miami CF',
    syncedAt: now,
    syncStatus: 'ready',
  });

  upsertCareerPlayer({
    id: PLAYER_B,
    externalSource: 'transfermarkt',
    externalId: '3249',
    name: 'Luis Suárez',
    nameNormalized: 'luis suarez',
    dateOfBirth: '1987-01-24',
    nationality: 'Uruguay',
    currentClubName: 'Inter Miami CF',
    syncedAt: now,
    syncStatus: 'ready',
  });

  insertClubStint({
    id: randomUUID(),
    playerId: PLAYER_A,
    clubId: CLUB_BARCA,
    joinedRaw: '2004-07-01',
    leftRaw: '2021-08-10',
    joinedOn: '2004-07-01',
    leftOn: '2021-08-10',
    timePrecision: 'exact',
    sortOrder: 0,
  });

  insertClubStint({
    id: randomUUID(),
    playerId: PLAYER_B,
    clubId: CLUB_BARCA,
    joinedRaw: '2014-07-11',
    leftRaw: '2020-09-23',
    joinedOn: '2014-07-11',
    leftOn: '2020-09-23',
    timePrecision: 'exact',
    sortOrder: 0,
  });

  return upsertPlayerPairAnalysis({
    id: randomUUID(),
    playerIdLow: PLAYER_A,
    playerIdHigh: PLAYER_B,
    result: {
      clubmates: { status: 'established' },
      nationalTeammates: { status: 'not_established' },
      clubmateDetails: [{
        clubId: CLUB_BARCA,
        clubName: 'FC Barcelona',
        overlapFrom: '2014-07-11',
        overlapTo: '2020-09-23',
        precision: 'exact',
      }],
      nationalTeammateDetails: [],
      transfer: { directTransferLink: false, successiveSameClub: false, evidence: [] },
      indirectPath: null,
      pathStatus: 'no_path',
      relationDistance: 0,
      selfPair: false,
    },
    dataFreshness: { clubStints: 'fresh' },
    maxHops: 6,
    computedAt: COMPUTED_AT,
  });
}

describe('Relationship narratives API contract (POST)', () => {
  let app;
  let token;
  let analysis;

  beforeAll(async () => {
    runMigrations();
    analysis = seedReadyPairAnalysis();
    app = createApp();
    ({ token } = await registerAndLogin(app, request));
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    resetAiRateLimitStore();
    getDb().prepare('DELETE FROM relationship_narratives').run();
    mockGenerateNarrative.mockReset();
    mockGenerateNarrative.mockResolvedValue({
      text: validAiText(),
      model: 'mock-model',
    });
  });

  const narrativePath = () => `/api/player-pair-analyses/${PLAYER_A}/${PLAYER_B}/narrative`;

  it('returns 401 without auth', async () => {
    const res = await request(app).post(narrativePath());
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('returns 409 when analysis is not ready', async () => {
    const pendingA = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const pendingB = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const now = new Date().toISOString();
    upsertCareerPlayer({
      id: pendingA,
      externalSource: 'transfermarkt',
      externalId: 'pending-a',
      name: 'Pending A',
      nameNormalized: 'pending a',
      syncedAt: now,
      syncStatus: 'syncing',
    });
    upsertCareerPlayer({
      id: pendingB,
      externalSource: 'transfermarkt',
      externalId: 'pending-b',
      name: 'Pending B',
      nameNormalized: 'pending b',
      syncedAt: now,
      syncStatus: 'syncing',
    });

    const res = await request(app)
      .post(`/api/player-pair-analyses/${pendingA}/${pendingB}/narrative`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual(expect.any(String));
    expect(res.body.message).toEqual(expect.any(String));
  });

  it('returns 200 with aiGenerated/reused structure on success', async () => {
    const res = await request(app)
      .post(narrativePath())
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ready',
      playerIdA: expect.any(String),
      playerIdB: expect.any(String),
      analysisId: analysis.id,
      analysisComputedAt: COMPUTED_AT,
      aiGenerated: true,
      reused: false,
      narrativeText: expect.any(String),
    });
    expect(res.body.narrativeText.length).toBeGreaterThan(0);
    expect(mockGenerateNarrative).toHaveBeenCalled();
  });

  it('returns 422 on narrative_verification_failed', async () => {
    const res = await request(app)
      .post(narrativePath())
      .set('Authorization', `Bearer ${token}`)
      .set('X-Test-Narrative-Mode', 'verification_failed')
      .send({ force: true });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('narrative_verification_failed');
    expect(res.body.message).toEqual(expect.any(String));
  });

  it('returns 429 when rate limited', async () => {
    const res = await request(app)
      .post(narrativePath())
      .set('Authorization', `Bearer ${token}`)
      .set('X-Test-Narrative-Mode', 'rate_limited')
      .send({ force: true });

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('rate_limited');
  });

  it('returns 408 on AI timeout', async () => {
    const res = await request(app)
      .post(narrativePath())
      .set('Authorization', `Bearer ${token}`)
      .set('X-Test-Narrative-Mode', 'timeout')
      .send({ force: true });

    expect(res.status).toBe(408);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it('returns 503 on upstream unavailable', async () => {
    const res = await request(app)
      .post(narrativePath())
      .set('Authorization', `Bearer ${token}`)
      .set('X-Test-Narrative-Mode', 'upstream_fail')
      .send({ force: true });

    expect(res.status).toBe(503);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it('POST returns reused=true on second call without force', async () => {
    const first = await request(app)
      .post(narrativePath())
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(first.status).toBe(200);
    expect(first.body.reused).toBe(false);

    mockGenerateNarrative.mockClear();
    const second = await request(app)
      .post(narrativePath())
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(second.status).toBe(200);
    expect(second.body.reused).toBe(true);
    expect(second.body.narrativeText).toBe(first.body.narrativeText);
    expect(mockGenerateNarrative).not.toHaveBeenCalled();
  });
});

describe('Relationship narratives API contract (GET)', () => {
  let app;
  let token;
  let analysis;

  beforeAll(async () => {
    runMigrations();
    analysis = seedReadyPairAnalysis();
    app = createApp();
    ({ token } = await registerAndLogin(app, request));
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    resetAiRateLimitStore();
    getDb().prepare('DELETE FROM relationship_narratives').run();
    mockGenerateNarrative.mockReset();
    mockGenerateNarrative.mockResolvedValue({
      text: validAiText(),
      model: 'mock-model',
    });
  });

  const narrativePath = () => `/api/player-pair-analyses/${PLAYER_A}/${PLAYER_B}/narrative`;

  it('returns 401 without auth on GET', async () => {
    const res = await request(app).get(narrativePath());
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('returns 404 when no narrative exists', async () => {
    const res = await request(app)
      .get(narrativePath())
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('returns 200 when matching version narrative exists', async () => {
    await request(app)
      .post(narrativePath())
      .set('Authorization', `Bearer ${token}`)
      .send({});

    const res = await request(app)
      .get(narrativePath())
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ready',
      analysisId: analysis.id,
      analysisComputedAt: COMPUTED_AT,
      aiGenerated: true,
      reused: true,
      narrativeText: expect.any(String),
    });
  });

  it('returns 409 when analysis is not ready on GET', async () => {
    const pendingA = '11111111-1111-4111-8111-111111111111';
    const pendingB = '22222222-2222-4222-8222-222222222222';
    const now = new Date().toISOString();
    upsertCareerPlayer({
      id: pendingA,
      externalSource: 'transfermarkt',
      externalId: 'get-pending-a',
      name: 'Get Pending A',
      nameNormalized: 'get pending a',
      syncedAt: now,
      syncStatus: 'syncing',
    });
    upsertCareerPlayer({
      id: pendingB,
      externalSource: 'transfermarkt',
      externalId: 'get-pending-b',
      name: 'Get Pending B',
      nameNormalized: 'get pending b',
      syncedAt: now,
      syncStatus: 'syncing',
    });

    const res = await request(app)
      .get(`/api/player-pair-analyses/${pendingA}/${pendingB}/narrative`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it('returns 404 narrative_stale when only older computed_at narrative exists', async () => {
    await request(app)
      .post(narrativePath())
      .set('Authorization', `Bearer ${token}`)
      .send({});

    const newComputedAt = '2026-07-17T15:00:00.000Z';
    upsertPlayerPairAnalysis({
      id: analysis.id,
      playerIdLow: PLAYER_A,
      playerIdHigh: PLAYER_B,
      result: analysis.result,
      dataFreshness: { clubStints: 'fresh' },
      maxHops: 6,
      computedAt: newComputedAt,
    });

    const res = await request(app)
      .get(narrativePath())
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('narrative_stale');
  });
});
