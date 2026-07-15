import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb } from '../../src/db/connection.js';
import { createApp } from '../../src/app.js';
import { registerAndLogin } from '../helpers/seed-match-data.js';
import { upsertCareerClub } from '../../src/db/repositories/career-club-repository.js';
import { upsertCareerPlayer } from '../../src/db/repositories/career-player-repository.js';
import { insertClubStint } from '../../src/db/repositories/club-stint-repository.js';
import { insertNationalTeamStint } from '../../src/db/repositories/national-team-stint-repository.js';

const PLAYER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PLAYER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UNKNOWN_PLAYER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CLUB_BARCA = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function seedClubmatesPair() {
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

  insertNationalTeamStint({
    id: randomUUID(),
    playerId: PLAYER_A,
    nationKey: 'argentina',
    nationName: 'Argentina',
    joinedRaw: '2005',
    leftRaw: null,
    joinedOn: '2005-01-01',
    leftOn: now.slice(0, 10),
    timePrecision: 'open_ended',
  });

  insertNationalTeamStint({
    id: randomUUID(),
    playerId: PLAYER_B,
    nationKey: 'uruguay',
    nationName: 'Uruguay',
    joinedRaw: '2007',
    leftRaw: null,
    joinedOn: '2007-01-01',
    leftOn: now.slice(0, 10),
    timePrecision: 'open_ended',
  });

  return { playerIdA: PLAYER_A, playerIdB: PLAYER_B };
}

describe('Player pair analyses API contract', () => {
  let app;
  let token;
  let fixture;

  beforeAll(async () => {
    runMigrations();
    fixture = seedClubmatesPair();
    app = createApp();
    ({ token } = await registerAndLogin(app, request));
  });

  afterAll(() => {
    closeDb();
  });

  describe('GET /api/player-pair-analyses/:playerIdA/:playerIdB', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(
        `/api/player-pair-analyses/${fixture.playerIdA}/${fixture.playerIdB}`,
      );
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });

    it('returns 400 for self-pair (same player id twice)', async () => {
      const res = await request(app)
        .get(`/api/player-pair-analyses/${fixture.playerIdA}/${fixture.playerIdA}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('bad_request');
      expect(res.body.message).toEqual(expect.any(String));
    });

    it('returns 404 when a player is unknown', async () => {
      const res = await request(app)
        .get(`/api/player-pair-analyses/${fixture.playerIdA}/${UNKNOWN_PLAYER}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });

    it('returns 200 with PlayerPairAnalysisResponse for clubmates pair', async () => {
      const res = await request(app)
        .get(`/api/player-pair-analyses/${fixture.playerIdA}/${fixture.playerIdB}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: expect.stringMatching(/^(ready|computing|failed)$/),
        playerIdA: expect.any(String),
        playerIdB: expect.any(String),
      });

      if (res.body.status === 'ready') {
        expect(res.body.result).toMatchObject({
          clubmates: {
            status: expect.stringMatching(/^(established|not_established|unknown)$/),
          },
          nationalTeammates: {
            status: expect.stringMatching(/^(established|not_established|unknown)$/),
          },
          transfer: expect.objectContaining({
            directTransferLink: expect.any(Boolean),
            successiveSameClub: expect.any(Boolean),
            evidence: expect.any(Array),
          }),
          pathStatus: expect.stringMatching(/^(found|no_path|skipped)$/),
        });
        expect(res.body.result.clubmates.status).toBe('established');
        expect(res.body.result.clubmateDetails).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              entityId: expect.any(String),
              entityName: expect.stringMatching(/Barcelona/i),
              overlapFrom: expect.any(String),
              overlapTo: expect.any(String),
            }),
          ]),
        );
        expect(res.body.dataFreshness).toMatchObject({
          summary: expect.any(String),
        });
      }
    });

    it('URL reentry with swapped player ids yields same pair identity', async () => {
      const forward = await request(app)
        .get(`/api/player-pair-analyses/${fixture.playerIdA}/${fixture.playerIdB}`)
        .set('Authorization', `Bearer ${token}`);
      const reverse = await request(app)
        .get(`/api/player-pair-analyses/${fixture.playerIdB}/${fixture.playerIdA}`)
        .set('Authorization', `Bearer ${token}`);

      expect(forward.status).toBe(200);
      expect(reverse.status).toBe(200);
      if (forward.body.status === 'ready' && reverse.body.status === 'ready') {
        expect(forward.body.result?.clubmates?.status).toBe(
          reverse.body.result?.clubmates?.status,
        );
        expect(forward.body.analysisId ?? null).toBe(reverse.body.analysisId ?? null);
      }
    });
  });

  describe('POST /api/player-pair-analyses', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/player-pair-analyses').send({
        playerIdA: fixture.playerIdA,
        playerIdB: fixture.playerIdB,
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });

    it('returns 400 for self-pair body', async () => {
      const res = await request(app)
        .post('/api/player-pair-analyses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          playerIdA: fixture.playerIdA,
          playerIdB: fixture.playerIdA,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('bad_request');
    });

    it('returns 400 when body fields missing', async () => {
      const res = await request(app)
        .post('/api/player-pair-analyses')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('bad_request');
    });

    it('returns 200 with analysis after force recalculate', async () => {
      const res = await request(app)
        .post('/api/player-pair-analyses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          playerIdA: fixture.playerIdA,
          playerIdB: fixture.playerIdB,
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: expect.stringMatching(/^(ready|computing|failed)$/),
        playerIdA: expect.any(String),
        playerIdB: expect.any(String),
      });
      if (res.body.status === 'ready') {
        expect(res.body.result.clubmates.status).toBe('established');
        expect(res.body.result.nationalTeammates.status).toMatch(
          /^(established|not_established|unknown)$/,
        );
      }
    });

    it('returns 404 when a player is unknown', async () => {
      const res = await request(app)
        .post('/api/player-pair-analyses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          playerIdA: fixture.playerIdA,
          playerIdB: UNKNOWN_PLAYER,
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });
  });
});
