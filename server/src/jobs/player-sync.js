import { randomUUID } from 'node:crypto';
import cron from 'node-cron';
import { Router } from 'express';
import { config } from '../config/index.js';
import { AppError } from '../middleware/error.js';
import { createFootballDataAdapter, ALLOWED_LEAGUES } from '../adapters/football-data-adapter.js';
import { importLeagueFromScraper } from '../services/scraper-import-service.js';
import { refreshClPlayerSyncMeta } from '../services/cl-player-bridge.js';
import { SEASON_REQUIRED_LEAGUES } from '../constants/league-codes.js';
import { searchTeams, upsertTeam } from '../db/repositories/team-repository.js';
import { upsertPlayer, countPlayersByLeague } from '../db/repositories/player-repository.js';
import { upsertPlayerStatsSnapshot } from '../db/repositories/player-stats-snapshot-repository.js';
import { upsertPlayerSyncMeta } from '../db/repositories/player-sync-meta-repository.js';
import { getDb } from '../db/connection.js';

let cronTask = null;
let runningJob = null;

export function getLeaguesNeedingPlayerSync() {
  const rows = getDb().prepare(`
    SELECT league_code
    FROM player_sync_meta
    WHERE players_count = 0 OR last_sync_at IS NULL
    ORDER BY league_code
  `).all();
  return rows.map((row) => row.league_code);
}

function resolveSeason(leagueCode) {
  if (SEASON_REQUIRED_LEAGUES.includes(leagueCode)) {
    return String(config.footballData.wcSeason);
  }
  return String(new Date().getFullYear());
}

async function syncLeaguePlayers(adapter, leagueCode) {
  const now = new Date().toISOString();
  try {
    let teams = searchTeams({ league: leagueCode, page: 1, pageSize: 200 }).items;
    if (teams.length === 0) {
      const apiTeams = await adapter.getCompetitionTeams(leagueCode);
      for (const team of apiTeams) {
        upsertTeam({ ...team, updatedAt: now });
      }
      teams = apiTeams;
    }

    const allPlayers = [];
    for (const team of teams) {
      const squad = await adapter.getTeamSquad(team.id, { leagueCode });
      for (const player of squad) {
        allPlayers.push({ ...player, leagueCode, updatedAt: now });
      }
    }

    const season = resolveSeason(leagueCode);
    const scorers = await adapter.getCompetitionScorers(leagueCode, { season });

    const db = getDb();
    const tx = db.transaction(() => {
      for (const player of allPlayers) {
        upsertPlayer(player);
      }
      for (const scorer of scorers) {
        upsertPlayerStatsSnapshot({
          playerId: scorer.playerId,
          leagueCode: scorer.leagueCode,
          season: scorer.season,
          goals: scorer.goals,
          assists: scorer.assists,
          penalties: scorer.penalties,
          appearances: scorer.appearances,
          syncedAt: now,
        });
      }
      upsertPlayerSyncMeta({
        leagueCode,
        lastSyncAt: now,
        lastError: null,
        status: 'ok',
        playersCount: countPlayersByLeague(leagueCode),
      });
    });
    tx();

    return {
      leagueCode,
      syncedPlayers: allPlayers.length,
      syncedScorers: scorers.length,
    };
  } catch (err) {
    upsertPlayerSyncMeta({
      leagueCode,
      lastSyncAt: now,
      lastError: err.message,
      status: err.code === 'RATE_LIMITED' ? 'degraded' : 'down',
      playersCount: countPlayersByLeague(leagueCode),
    });
    throw err;
  }
}

export async function executePlayerSyncJob({ league = null, adapter = null } = {}) {
  if (runningJob) {
    return runningJob;
  }

  if (config.dataSource === 'scraper') {
    const leagues = league ? [league] : ALLOWED_LEAGUES;
    runningJob = (async () => {
      const results = [];
      for (const leagueCode of leagues) {
        try {
          const result = await importLeagueFromScraper(leagueCode, {
            playersOnly: leagueCode === 'WC',
          });
          results.push({
            leagueCode,
            syncedPlayers: result.syncedPlayers,
            syncedScorers: result.syncedScorers,
            squadErrors: result.squadErrors?.length ?? 0,
          });
        } catch (err) {
          results.push({ leagueCode, error: err.message });
        }
      }
      try {
        const bridgeResult = refreshClPlayerSyncMeta();
        results.push({ leagueCode: 'CL', ...bridgeResult });
      } catch (err) {
        results.push({ leagueCode: 'CL', bridgeError: err.message });
      }
      return results;
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
        const result = await syncLeaguePlayers(footballAdapter, leagueCode);
        results.push(result);
      } catch (err) {
        results.push({ leagueCode, error: err.message });
        if (err.code === 'RATE_LIMITED') break;
      }
    }
    return results;
  })().finally(() => {
    runningJob = null;
  });

  return runningJob;
}

export function schedulePlayerSyncCron() {
  if (config.isTest || cronTask) {
    return;
  }

  cronTask = cron.schedule(config.playerSyncCron, () => {
    executePlayerSyncJob().catch((err) => {
      console.error(JSON.stringify({
        level: 'error',
        type: 'player_sync_cron_failed',
        message: err.message,
      }));
    });
  });
}

export function createPlayerSyncRouter() {
  const router = Router();

  router.post('/jobs/player-sync', (req, res, next) => {
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
      executePlayerSyncJob({ league }).catch((err) => {
        console.error(JSON.stringify({
          level: 'error',
          type: 'player_sync_job_failed',
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
