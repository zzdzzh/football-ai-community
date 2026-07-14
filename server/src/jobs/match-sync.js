import { randomUUID } from 'node:crypto';
import cron from 'node-cron';
import { Router } from 'express';
import { config } from '../config/index.js';
import { AppError } from '../middleware/error.js';
import { createFootballDataAdapter, ALLOWED_LEAGUES } from '../adapters/football-data-adapter.js';
import { importLeagueFromScraper } from '../services/scraper-import-service.js';
import { enrichScraperFinishedMatches } from '../services/scraper-match-enricher.js';
import { upsertTeam } from '../db/repositories/team-repository.js';
import { upsertMatch, findFinishedMatchesMissingStats } from '../db/repositories/match-repository.js';
import { upsertMatchSyncMeta } from '../db/repositories/match-sync-meta-repository.js';
import { getDb } from '../db/connection.js';

let cronTask = null;
let runningJob = null;

async function syncLeague(adapter, leagueCode) {
  const now = new Date().toISOString();
  try {
    const [teamList, matchList] = await Promise.all([
      adapter.getCompetitionTeams(leagueCode),
      adapter.getCompetitionMatches(leagueCode),
    ]);

    const db = getDb();
    const tx = db.transaction(() => {
      for (const team of teamList) {
        upsertTeam({ ...team, updatedAt: now });
      }
      for (const match of matchList) {
        if (!match.homeTeamId || !match.awayTeamId) continue;
        upsertTeam({ ...match.homeTeam, leagueCode: match.leagueCode, updatedAt: now });
        upsertTeam({ ...match.awayTeam, leagueCode: match.leagueCode, updatedAt: now });
        upsertMatch({
          id: match.id,
          leagueCode: match.leagueCode,
          season: match.season,
          matchday: match.matchday,
          utcDate: match.utcDate,
          status: match.status,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          statsJson: match.statsJson,
          eventsJson: match.eventsJson,
          dataCompleteness: match.dataCompleteness,
          lastSyncedAt: now,
        });
      }
      upsertMatchSyncMeta({
        leagueCode,
        lastSyncAt: now,
        lastError: null,
        status: 'ok',
        requestsInWindow: 0,
        windowStartedAt: now,
      });
    });
    tx();
    return { leagueCode, syncedTeams: teamList.length, syncedMatches: matchList.length };
  } catch (err) {
    upsertMatchSyncMeta({
      leagueCode,
      lastSyncAt: now,
      lastError: err.message,
      status: err.code === 'RATE_LIMITED' ? 'degraded' : 'down',
    });
    throw err;
  }
}

async function enrichFinishedMatches(adapter) {
  const pending = findFinishedMatchesMissingStats(3);
  for (const match of pending) {
    try {
      const detail = await adapter.getMatch(match.id);
      const now = new Date().toISOString();
      upsertMatch({
        id: detail.id,
        leagueCode: detail.leagueCode,
        season: detail.season,
        matchday: detail.matchday,
        utcDate: detail.utcDate,
        status: detail.status,
        homeTeamId: detail.homeTeamId,
        awayTeamId: detail.awayTeamId,
        homeScore: detail.homeScore,
        awayScore: detail.awayScore,
        statsJson: detail.statsJson,
        eventsJson: detail.eventsJson,
        dataCompleteness: detail.dataCompleteness,
        lastSyncedAt: now,
      });
    } catch (err) {
      console.error(JSON.stringify({
        level: 'error',
        type: 'match_detail_enrich_failed',
        matchId: match.id,
        message: err.message,
      }));
    }
  }
}

export async function executeMatchSyncJob({ league = null, adapter = null } = {}) {
  if (runningJob) {
    return runningJob;
  }

  if (config.dataSource === 'scraper') {
    const leagues = league ? [league] : ALLOWED_LEAGUES;
    runningJob = (async () => {
      const results = [];
      for (const leagueCode of leagues) {
        try {
          const result = await importLeagueFromScraper(leagueCode);
          results.push({
            leagueCode,
            syncedTeams: result.syncedTeams,
            syncedMatches: result.syncedMatches,
          });
        } catch (err) {
          results.push({ leagueCode, error: err.message });
        }
      }
      const enriched = await enrichScraperFinishedMatches({ limit: 30 });
      return { results, enriched };
    })().finally(() => {
      runningJob = null;
    });
    return runningJob;
  }

  const footballAdapter = adapter ?? createFootballDataAdapter();
  const leagues = league ? [league] : ALLOWED_LEAGUES;

  runningJob = (async () => {
    const results = [];
    for (const leagueCode of leagues) {
      try {
        const result = await syncLeague(footballAdapter, leagueCode);
        results.push(result);
      } catch (err) {
        results.push({ leagueCode, error: err.message });
        if (err.code === 'RATE_LIMITED') break;
      }
    }
    await enrichFinishedMatches(footballAdapter);
    return results;
  })().finally(() => {
    runningJob = null;
  });

  return runningJob;
}

export function scheduleMatchSyncCron() {
  if (config.isTest || cronTask) {
    return;
  }

  cronTask = cron.schedule(config.matchSyncCron, () => {
    executeMatchSyncJob().catch((err) => {
      console.error(JSON.stringify({
        level: 'error',
        type: 'match_sync_cron_failed',
        message: err.message,
      }));
    });
  });
}

export function createMatchSyncRouter() {
  const router = Router();

  router.post('/jobs/match-sync', (req, res, next) => {
    try {
      const internalKey = req.headers['x-internal-key'];
      if (!internalKey || internalKey !== config.internalApiKey) {
        throw new AppError(401, 'unauthorized', '内部接口密钥无效');
      }

      const league = req.query.league ?? null;
      if (league && !ALLOWED_LEAGUES.includes(league)) {
        throw new AppError(400, 'bad_request', '无效的联赛代码');
      }

      const jobId = randomUUID();
      executeMatchSyncJob({ league }).catch((err) => {
        console.error(JSON.stringify({
          level: 'error',
          type: 'match_sync_job_failed',
          jobId,
          message: err.message,
        }));
      });

      res.status(202).json({ jobId, status: 'accepted' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
