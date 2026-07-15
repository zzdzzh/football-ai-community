import { jest } from '@jest/globals';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb } from '../../src/db/connection.js';
import { registerAndLogin } from '../helpers/seed-match-data.js';
import { upsertCareerClub } from '../../src/db/repositories/career-club-repository.js';
import { upsertCareerPlayer } from '../../src/db/repositories/career-player-repository.js';
import { insertClubStint } from '../../src/db/repositories/club-stint-repository.js';
import { insertNationalTeamStint } from '../../src/db/repositories/national-team-stint-repository.js';

const PLAYER_ID = '11111111-1111-4111-8111-111111111111';
const UNKNOWN_PLAYER_ID = '99999999-9999-4999-8999-999999999999';
const CLUB_ID = '22222222-2222-4222-8222-222222222222';

const mockSearch = jest.fn();
const mockFetchProfile = jest.fn();

jest.unstable_mockModule('../../src/adapters/career-data-adapter.js', () => ({
  createCareerDataAdapter: () => ({
    search: mockSearch,
    fetchProfile: mockFetchProfile,
  }),
  careerDataAdapter: {
    search: mockSearch,
    fetchProfile: mockFetchProfile,
  },
}));

const { createApp } = await import('../../src/app.js');

function seedCareerPlayerFixture() {
  const now = new Date().toISOString();

  upsertCareerClub({
    id: CLUB_ID,
    externalSource: 'transfermarkt',
    externalId: '131',
    name: 'FC Barcelona',
    nameNormalized: 'fc barcelona',
  });

  upsertCareerPlayer({
    id: PLAYER_ID,
    externalSource: 'transfermarkt',
    externalId: '28003',
    name: 'Lionel Messi',
    nameNormalized: 'lionel messi',
    dateOfBirth: '1987-06-24',
    nationality: 'Argentina',
    position: 'Right Winger',
    currentClubId: CLUB_ID,
    currentClubName: 'Inter Miami CF',
    syncedAt: now,
    syncStatus: 'ready',
  });

  insertClubStint({
    id: randomUUID(),
    playerId: PLAYER_ID,
    clubId: CLUB_ID,
    joinedRaw: 'Jul 1, 2004',
    leftRaw: 'Aug 10, 2021',
    joinedOn: '2004-07-01',
    leftOn: '2021-08-10',
    timePrecision: 'exact',
    transferType: 'transfer',
    transferFee: null,
    sortOrder: 0,
  });

  insertNationalTeamStint({
    id: randomUUID(),
    playerId: PLAYER_ID,
    nationKey: 'argentina',
    nationName: 'Argentina',
    joinedRaw: '2005',
    leftRaw: null,
    joinedOn: '2005-01-01',
    leftOn: null,
    timePrecision: 'year',
  });

  return { playerId: PLAYER_ID, clubId: CLUB_ID };
}

describe('Career players API contract', () => {
  let app;
  let token;
  let fixture;

  beforeAll(async () => {
    runMigrations();
    fixture = seedCareerPlayerFixture();
    app = createApp();
    ({ token } = await registerAndLogin(app, request));
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    mockSearch.mockReset();
    mockFetchProfile.mockReset();
    mockFetchProfile.mockResolvedValue({
      externalSource: 'transfermarkt',
      externalId: '28003',
      slug: 'lionel-messi',
      name: 'Lionel Messi',
      nameNormalized: 'lionel messi',
      dateOfBirth: '1987-06-24',
      nationality: 'Argentina',
      position: 'Right Winger',
      currentClub: {
        externalId: '123',
        name: 'Inter Miami CF',
      },
      clubStints: [
        {
          club: { externalId: '131', name: 'FC Barcelona' },
          joinedRaw: 'Jul 1, 2004',
          leftRaw: 'Aug 10, 2021',
          transferType: 'transfer',
          sortOrder: 0,
        },
      ],
      nationalTeamStints: [
        {
          nationKey: 'argentina',
          nationName: 'Argentina',
          joinedRaw: '2005',
          leftRaw: null,
        },
      ],
    });
  });

  describe('GET /api/career-players', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/career-players?q=Messi');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
      expect(res.body.message).toEqual(expect.any(String));
    });

    it('returns 400 when q is missing', async () => {
      const res = await request(app)
        .get('/api/career-players')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('bad_request');
      expect(res.body.message).toEqual(expect.any(String));
    });

    it('returns 200 with candidate list matching CareerPlayerSearchResponse', async () => {
      const res = await request(app)
        .get('/api/career-players?q=Messi&limit=10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        items: expect.any(Array),
        sourceNote: expect.any(String),
      });
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.items[0]).toMatchObject({
        id: expect.any(String),
        name: expect.stringMatching(/Messi/i),
      });
      expect(
        res.body.items.some((item) => item.id === fixture.playerId),
      ).toBe(true);
    });
  });

  describe('GET /api/career-players/:playerId', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/api/career-players/${fixture.playerId}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });

    it('returns 200 with CareerPlayerDetail', async () => {
      const res = await request(app)
        .get(`/api/career-players/${fixture.playerId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: fixture.playerId,
        name: 'Lionel Messi',
        syncStatus: expect.stringMatching(/^(ready|stale|syncing|failed)$/),
        clubStints: expect.any(Array),
        nationalTeamStints: expect.any(Array),
      });
      expect(res.body.clubStints.length).toBeGreaterThanOrEqual(1);
      expect(res.body.clubStints[0]).toMatchObject({
        id: expect.any(String),
        clubId: expect.any(String),
        clubName: expect.any(String),
        timePrecision: expect.stringMatching(
          /^(exact|month|year|season|open_ended|unparseable)$/,
        ),
      });
      expect(res.body.nationalTeamStints.length).toBeGreaterThanOrEqual(1);
      expect(res.body.nationalTeamStints[0]).toMatchObject({
        id: expect.any(String),
        nationKey: expect.any(String),
        nationName: expect.any(String),
        timePrecision: expect.stringMatching(
          /^(exact|month|year|season|open_ended|unparseable)$/,
        ),
      });
    });

    it('returns 404 for unknown player', async () => {
      const res = await request(app)
        .get(`/api/career-players/${UNKNOWN_PLAYER_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
      expect(res.body.message).toEqual(expect.any(String));
    });
  });

  describe('POST /api/career-players/:playerId/sync', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post(`/api/career-players/${fixture.playerId}/sync`);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });

    it('returns 200 with CareerPlayerDetail after sync', async () => {
      const res = await request(app)
        .post(`/api/career-players/${fixture.playerId}/sync`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: fixture.playerId,
        name: expect.any(String),
        syncStatus: expect.stringMatching(/^(ready|stale|syncing|failed)$/),
        clubStints: expect.any(Array),
        nationalTeamStints: expect.any(Array),
      });
      expect(mockFetchProfile).toHaveBeenCalled();
    });

    it('returns 404 for unknown player', async () => {
      const res = await request(app)
        .post(`/api/career-players/${UNKNOWN_PLAYER_ID}/sync`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });
  });
});
