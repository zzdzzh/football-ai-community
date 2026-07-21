import { createApp } from './app.js';
import { config } from './config/index.js';
import { runMigrations } from './db/migrate.js';
import { getDb } from './db/connection.js';
import { scheduleNewsFetchCron } from './jobs/news-fetch.js';
import {
  scheduleMatchSyncCron,
  executeMatchSyncJob,
  isMatchSyncStale,
} from './jobs/match-sync.js';
import {
  schedulePlayerSyncCron,
  executePlayerSyncJob,
  getLeaguesNeedingPlayerSync,
} from './jobs/player-sync.js';
import { scheduleMatchReportCron } from './jobs/match-report-generate.js';
import { dedupeFeedItemsBySourceUrl } from './services/feed-dedup-cleanup.js';
import { dedupeMatchesByFixtureKey } from './services/match-dedup-cleanup.js';

const app = createApp();

if (!config.isTest) {
  runMigrations();
  const feedDedup = dedupeFeedItemsBySourceUrl();
  if (feedDedup.mergedCount > 0) {
    console.log(JSON.stringify({
      level: 'info',
      type: 'feed_dedup_cleanup',
      mergedCount: feedDedup.mergedCount,
    }));
  }
  const matchDedup = dedupeMatchesByFixtureKey();
  if (matchDedup.removedCount > 0) {
    console.log(JSON.stringify({
      level: 'info',
      type: 'match_dedup_cleanup',
      removedCount: matchDedup.removedCount,
      groupCount: matchDedup.groupCount,
    }));
  }
  scheduleNewsFetchCron();
  scheduleMatchSyncCron();
  schedulePlayerSyncCron();
  scheduleMatchReportCron();

  if (config.footballData.apiKey || config.dataSource === 'scraper') {
    const matchCount = getDb().prepare('SELECT COUNT(*) AS count FROM matches').get().count;
    const needsMatchSync = matchCount === 0 || isMatchSyncStale();
    if (needsMatchSync) {
      executeMatchSyncJob().catch((err) => {
        console.error(JSON.stringify({
          level: 'error',
          type: 'match_sync_startup_failed',
          message: err.message,
        }));
      });
    }

    const leaguesNeedingPlayerSync = getLeaguesNeedingPlayerSync();
    if (config.dataSource === 'scraper' && leaguesNeedingPlayerSync.length > 0) {
      executePlayerSyncJob().catch((err) => {
        console.error(JSON.stringify({
          level: 'error',
          type: 'player_sync_startup_failed',
          leagues: leaguesNeedingPlayerSync,
          message: err.message,
        }));
      });
    } else {
      const playerCount = getDb().prepare('SELECT COUNT(*) AS count FROM players').get().count;
      if (playerCount === 0) {
        executePlayerSyncJob().catch((err) => {
          console.error(JSON.stringify({
            level: 'error',
            type: 'player_sync_startup_failed',
            message: err.message,
          }));
        });
      }
    }
  }

  app.listen(config.port, () => {
    console.log(JSON.stringify({
      level: 'info',
      type: 'server_start',
      port: config.port,
      message: `Server listening on http://localhost:${config.port}`,
    }));
  });
}

export default app;
