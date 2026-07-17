import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import { createApp } from '../../src/app.js';
import { registerAndLogin } from '../helpers/seed-match-data.js';
import { upsertCareerClub } from '../../src/db/repositories/career-club-repository.js';
import { upsertCareerPlayer } from '../../src/db/repositories/career-player-repository.js';
import { insertClubStint } from '../../src/db/repositories/club-stint-repository.js';
import { upsertPlayerPairAnalysis } from '../../src/db/repositories/player-pair-analysis-repository.js';
import { resetAiRateLimitStore } from '../../src/services/ai-rate-limit.js';

const PLAYER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PLAYER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CLUB_BARCA = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const COMPUTED_AT = '2026-07-17T12:00:00.000Z';

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
      reused: expect.any(Boolean),
      narrativeText: expect.any(String),
    });
    expect(typeof res.body.narrativeText).toBe('string');
    expect(res.body.narrativeText.length).toBeGreaterThan(0);
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
});
