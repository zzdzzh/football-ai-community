import { jest } from '@jest/globals';
import { runMigrations } from '../../src/db/migrate.js';
import { closeDb, getDb } from '../../src/db/connection.js';
import { buildReportContext } from '../../src/services/stats-context-builder.js';
import { ContentAgent, createContentAgent } from '../../src/agents/content-agent.js';

describe('buildReportContext', () => {
  const baseMatch = {
    id: 'm1',
    status: 'FINISHED',
    homeTeam: { id: '57', name: 'Arsenal FC' },
    awayTeam: { id: '99', name: 'Unknown FC' },
    homeScore: 2,
    awayScore: 0,
    stats: [{ name: '控球率', homeValue: 60, awayValue: 40 }],
    events: [{ minute: 30, type: 'GOAL', teamId: '57', playerName: 'Saka' }],
    dataCompleteness: 'complete',
  };

  it('marks full report when score/stats/events present', () => {
    const ctx = buildReportContext(baseMatch);
    expect(ctx.isBrief).toBe(false);
    expect(ctx.missingFields).toEqual([]);
    expect(ctx.payload.match.homeScore).toBe(2);
  });

  it('marks brief when stats or events missing', () => {
    const ctx = buildReportContext({
      ...baseMatch,
      stats: [],
      events: [],
      dataCompleteness: 'partial',
    });
    expect(ctx.isBrief).toBe(true);
    expect(ctx.missingFields).toEqual(expect.arrayContaining(['stats', 'events']));
  });

  it('marks brief when score missing', () => {
    const ctx = buildReportContext({
      ...baseMatch,
      homeScore: null,
      awayScore: null,
    });
    expect(ctx.isBrief).toBe(true);
    expect(ctx.missingFields).toContain('score');
  });
});

describe('ContentAgent', () => {
  beforeAll(() => {
    runMigrations();
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO teams (id, name, league_code, updated_at)
      VALUES ('57', 'Arsenal FC', 'PL', ?), ('99', 'Unknown FC', 'PL', ?)
    `).run(now, now);
    db.prepare(`
      INSERT OR REPLACE INTO matches (
        id, league_code, utc_date, status, home_team_id, away_team_id,
        home_score, away_score, stats_json, events_json, data_completeness,
        last_synced_at, created_at, updated_at
      ) VALUES (
        'content-1001', 'PL', ?, 'FINISHED', '57', '99', 2, 0,
        ?, ?, 'complete', ?, ?, ?
      )
    `).run(
      now,
      JSON.stringify([{ name: '控球率', homeValue: 60, awayValue: 40, unit: '%' }]),
      JSON.stringify([{ minute: 30, type: 'GOAL', teamId: '57', playerName: 'Saka' }]),
      now,
      now,
      now,
    );
    db.prepare(`
      INSERT OR REPLACE INTO matches (
        id, league_code, utc_date, status, home_team_id, away_team_id,
        home_score, away_score, data_completeness, last_synced_at, created_at, updated_at
      ) VALUES (
        'content-1002', 'PL', ?, 'FINISHED', '57', '99', 1, 1,
        'partial', ?, ?, ?
      )
    `).run(now, now, now, now);
    db.prepare(`
      INSERT OR REPLACE INTO matches (
        id, league_code, utc_date, status, home_team_id, away_team_id,
        data_completeness, last_synced_at, created_at, updated_at
      ) VALUES (
        'content-1003', 'PL', ?, 'SCHEDULED', '57', '99', 'pending', ?, ?, ?
      )
    `).run(now, now, now, now);
  });

  afterAll(() => {
    closeDb();
  });

  it('generates match_report for complete finished match', async () => {
    const mockAi = {
      generate: jest.fn().mockResolvedValueOnce({
        text: JSON.stringify({
          title: '阿森纳主场取胜',
          summary: '主队以 2-0 击败对手，控球占优。',
          sections: [{ heading: '走势评述', content: '主队前 30 分钟打开僵局。' }],
          timeline: [{ minute: 30, type: 'GOAL', teamId: '57', playerName: 'Saka' }],
        }),
      }),
    };

    const agent = new ContentAgent({ aiContentService: mockAi });
    const db = getDb();
    const row = db.prepare('SELECT * FROM matches WHERE id = ?').get('content-1001');
    const match = {
      id: row.id,
      status: row.status,
      homeTeam: { id: '57', name: 'Arsenal FC' },
      awayTeam: { id: '99', name: 'Unknown FC' },
      homeScore: row.home_score,
      awayScore: row.away_score,
      stats: JSON.parse(row.stats_json),
      events: JSON.parse(row.events_json),
      dataCompleteness: row.data_completeness,
    };

    const result = await agent.generateMatchReport(match);
    expect(result.skipped).toBe(false);
    expect(result.type).toBe('match_report');
    expect(result.eventKey).toBe('match_report:content-1001');
    expect(result.title).toContain('阿森纳');
    expect(result.body.sections.length).toBeGreaterThan(0);
    expect(result.body.timeline).toHaveLength(1);
  });

  it('publishes brief_report when data incomplete', async () => {
    const mockAi = {
      generate: jest.fn().mockResolvedValueOnce({
        text: JSON.stringify({
          title: '简要战报',
          summary: '数据不足',
          sections: [{ heading: '说明', content: '缺少统计' }],
          timeline: [],
        }),
      }),
    };
    const agent = createContentAgent({ aiContentService: mockAi });
    const result = await agent.generateMatchReport({
      id: 'content-1002',
      status: 'FINISHED',
      homeTeam: { id: '57', name: 'Arsenal FC' },
      awayTeam: { id: '99', name: 'Unknown FC' },
      homeScore: 1,
      awayScore: 1,
      stats: [],
      events: [],
      dataCompleteness: 'partial',
    });

    expect(result.type).toBe('brief_report');
    expect(result.missingFields.length).toBeGreaterThan(0);
    expect(result.body.missingFields).toEqual(expect.arrayContaining(['stats', 'events']));
  });

  it('falls back without fabricating when AI fails', async () => {
    const mockAi = {
      generate: jest.fn().mockRejectedValueOnce(new Error('timeout')),
    };
    const agent = new ContentAgent({ aiContentService: mockAi });
    const result = await agent.generateMatchReport({
      id: 'content-1001',
      status: 'FINISHED',
      homeTeam: { id: '57', name: 'Arsenal FC' },
      awayTeam: { id: '99', name: 'Unknown FC' },
      homeScore: 2,
      awayScore: 0,
      stats: [{ name: '控球率', homeValue: 60, awayValue: 40 }],
      events: [{ minute: 30, type: 'GOAL', teamId: '57' }],
      dataCompleteness: 'complete',
    });

    expect(result.skipped).toBe(false);
    expect(result.summary).toMatch(/简要|比分|2-0/);
    expect(result.body.sections[0].content).toMatch(/未补充虚构|AI/);
  });

  it('skips non-finished matches', async () => {
    const mockAi = { generate: jest.fn() };
    const agent = new ContentAgent({ aiContentService: mockAi });
    const result = await agent.generateMatchReport({
      id: 'content-1003',
      status: 'SCHEDULED',
      homeTeam: { id: '57', name: 'Arsenal FC' },
      awayTeam: { id: '99', name: 'Unknown FC' },
      homeScore: null,
      awayScore: null,
      dataCompleteness: 'pending',
    });

    expect(result.skipped).toBe(true);
    expect(mockAi.generate).not.toHaveBeenCalled();
  });

  it('drops fabricated timeline events not in source', async () => {
    const mockAi = {
      generate: jest.fn().mockResolvedValueOnce({
        text: JSON.stringify({
          title: 't',
          summary: 's',
          sections: [{ heading: 'h', content: 'c' }],
          timeline: [
            { minute: 30, type: 'GOAL', teamId: '57', playerName: 'Saka' },
            { minute: 90, type: 'GOAL', teamId: '99', playerName: 'Fake' },
          ],
        }),
      }),
    };
    const agent = new ContentAgent({ aiContentService: mockAi });
    const result = await agent.generateMatchReport({
      id: 'content-1001',
      status: 'FINISHED',
      homeTeam: { id: '57', name: 'Arsenal FC' },
      awayTeam: { id: '99', name: 'Unknown FC' },
      homeScore: 2,
      awayScore: 0,
      stats: [{ name: '控球率', homeValue: 60, awayValue: 40 }],
      events: [{ minute: 30, type: 'GOAL', teamId: '57', playerName: 'Saka' }],
      dataCompleteness: 'complete',
    });

    expect(result.body.timeline).toHaveLength(1);
    expect(result.body.timeline[0].playerName).toBe('Saka');
  });
});
