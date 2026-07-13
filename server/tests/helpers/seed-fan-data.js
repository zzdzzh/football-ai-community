import { getDb } from '../../src/db/connection.js';
import { seedTeamsAndMatches } from './seed-match-data.js';

export function seedFanPersonas() {
  seedTeamsAndMatches();
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR REPLACE INTO teams (id, name, short_name, tla, league_code, updated_at)
    VALUES ('64', 'Liverpool FC', 'Liverpool', 'LIV', 'PL', ?)
  `).run(now);

  db.prepare(`
    INSERT OR REPLACE INTO fan_personas (
      id, team_id, display_name, style_traits_json, accent_phrases_json, enabled, created_at, updated_at
    ) VALUES
      ('persona-arsenal', '57', '枪手铁杆小明', '["乐观","护短"]', '["塔子哥有东西"]', 1, ?, ?),
      ('persona-liverpool', '64', '红军KOP老张', '["激情","历史党"]', '["YNWA"]', 1, ?, ?)
  `).run(now, now, now, now);

  return {
    personaIds: ['persona-arsenal', 'persona-liverpool'],
    matchId: '1001',
  };
}

export async function registerModerator(app, request) {
  const user = {
    email: `mod-${Date.now()}@example.com`,
    password: 'password123',
    nickname: 'Moderator',
  };
  const registerRes = await request(app).post('/api/auth/register').send(user);
  const db = getDb();
  db.prepare("UPDATE users SET role = 'moderator' WHERE id = ?").run(registerRes.body.user.id);
  const loginRes = await request(app).post('/api/auth/login').send({
    email: user.email,
    password: user.password,
  });
  return {
    token: loginRes.body.token,
    user: { ...registerRes.body.user, role: 'moderator' },
  };
}
