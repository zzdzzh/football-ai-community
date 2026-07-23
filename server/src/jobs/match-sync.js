import { randomUUID } from 'node:crypto';
import cron from 'node-cron';
import { Router } from 'express';
import { config } from '../config/index.js';
import { AppError } from '../middleware/error.js';
import { createFootballDataAdapter, ALLOWED_LEAGUES } from '../adapters/football-data-adapter.js';
import { importLeagueFromScraper } from '../services/scraper-import-service.js';
import { enrichScraperFinishedMatches } from '../services/scraper-match-enricher.js';
import { upsertTeam } from '../db/repositories/team-repository.js';
import {
  upsertMatch,
  findFinishedMatchesMissingStats,
  resolveCanonicalMatchId,
} from '../db/repositories/match-repository.js';
import {
  upsertMatchSyncMeta,
  getAllMatchSyncMeta,
} from '../db/repositories/match-sync-meta-repository.js';
import { getDb } from '../db/connection.js';
import { executeMatchReportGenerateJob } from './match-report-generate.js';

let cronTask = null;
let runningJob = null;

const MATCH_SYNC_STALE_HOURS = 6;

/** 任一联赛超过 maxAgeHours 未成功同步，或尚无 meta，视为需要同步 */
export function isMatchSyncStale(maxAgeHours = MATCH_SYNC_STALE_HOURS) {
  const metas = getAllMatchSyncMeta();
  if (metas.length === 0) return true;
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
  return metas.some((meta) => {
    if (!meta.lastSyncAt) return true;
    const ts = Date.parse(meta.lastSyncAt);
    return Number.isNaN(ts) || ts < cutoff;
  });
}

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
        const matchId = resolveCanonicalMatchId({
          id: match.id,
          leagueCode: match.leagueCode,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          utcDate: match.utcDate,
        });
        upsertMatch({
          id: matchId,
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
          const result = await importLeagueFromScraper(leagueCode, { includeFbref: false });
          results.push({
            leagueCode,
            syncedTeams: result.syncedTeams,
            syncedMatches: result.syncedMatches,
          });
        } catch (err) {
          results.push({ leagueCode, error: err.message });
          console.error(JSON.stringify({
            level: 'error',
            type: 'match_sync_league_failed',
            leagueCode,
            dataSource: 'scraper',
            message: err.message,
          }));
        }
      }
      const enriched = await enrichScraperFinishedMatches({ limit: 30 });
      // 同步完成后立刻尝试生成战报，避免只等 report cron
      if (!config.isTest) {
        executeMatchReportGenerateJob().catch((err) => {
          console.error(JSON.stringify({
            level: 'error',
            type: 'match_report_after_sync_failed',
            message: err.message,
          }));
        });
      }
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
    if (!config.isTest) {
      executeMatchReportGenerateJob().catch((err) => {
        console.error(JSON.stringify({
          level: 'error',
          type: 'match_report_after_sync_failed',
          message: err.message,
        }));
      });
    }
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
    console.log(JSON.stringify({
      level: 'info',
      type: 'match_sync_cron_tick',
      cron: config.matchSyncCron,
      dataSource: config.dataSource,
    }));
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
