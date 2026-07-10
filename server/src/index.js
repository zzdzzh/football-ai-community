import { createApp } from './app.js';
import { config } from './config/index.js';
import { runMigrations } from './db/migrate.js';
import { getDb } from './db/connection.js';
import { scheduleNewsFetchCron } from './jobs/news-fetch.js';
import { scheduleMatchSyncCron, executeMatchSyncJob } from './jobs/match-sync.js';
import { schedulePlayerSyncCron, executePlayerSyncJob } from './jobs/player-sync.js';
import { dedupeFeedItemsBySourceUrl } from './services/feed-dedup-cleanup.js';

const app = createApp();

if (!config.isTest) {
  runMigrations();
  scheduleNewsFetchCron();
  scheduleMatchSyncCron();
  schedulePlayerSyncCron();

  if (config.footballData.apiKey || config.dataSource === 'scraper') {
    const matchCount = getDb().prepare('SELECT COUNT(*) AS count FROM matches').get().count;
    if (matchCount === 0 && config.dataSource !== 'scraper') {
      executeMatchSyncJob().catch((err) => {
        console.error(JSON.stringify({
          level: 'error',
          type: 'match_sync_startup_failed',
          message: err.message,
        }));
      });
    }

    const playerCount = getDb().prepare('SELECT COUNT(*) AS count FROM players').get().count;
    if (playerCount === 0) {
      const syncJob = config.dataSource === 'scraper'
        ? executePlayerSyncJob({ league: 'PL' })
        : executePlayerSyncJob();
      syncJob.catch((err) => {
        console.error(JSON.stringify({
          level: 'error',
          type: 'player_sync_startup_failed',
          message: err.message,
        }));
      });
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
