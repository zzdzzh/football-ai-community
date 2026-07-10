import request from 'supertest';
import { createApp } from '../../src/app.js';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb } from '../../src/db/connection.js';

describe('Auth API contract', () => {
  let app;

  beforeAll(() => {
    runMigrations();
    app = createApp();
  });

  afterAll(() => {
    closeDb();
  });

  const testUser = {
    email: 'contract-test@example.com',
    password: 'password123',
    nickname: '契约测试',
  };

  describe('POST /api/auth/register', () => {
    it('returns 201 with token and user on success', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({
        email: testUser.email,
        nickname: testUser.nickname,
        role: 'user',
      });
      expect(res.body.user.id).toEqual(expect.any(String));
      expect(res.body.user.createdAt).toEqual(expect.any(String));
    });

    it('returns 409 when email already exists', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('conflict');
      expect(res.body.message).toBe('邮箱已存在');
    });

    it('returns 400 for invalid payload', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'bad-email', password: 'short', nickname: 'x' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('bad_request');
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 200 with token and user on success', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      expect(res.status).toBe(200);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user.email).toBe(testUser.email);
    });

    it('returns 401 for wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });
  });

  describe('GET /api/auth/me', () => {
    let token;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });
      token = res.body.token;
    });

    it('returns 200 with current user when authenticated', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(testUser.email);
      expect(res.body.nickname).toBe(testUser.nickname);
      expect(res.body.role).toBe('user');
    });

    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    });
  });
});
