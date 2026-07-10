import { createApp } from './app.js';
import { config } from './config/index.js';
import { runMigrations } from './db/migrate.js';
import { scheduleNewsFetchCron } from './jobs/news-fetch.js';
import { scheduleMatchSyncCron } from './jobs/match-sync.js';

const app = createApp();

if (!config.isTest) {
  runMigrations();
  scheduleNewsFetchCron();
  scheduleMatchSyncCron();
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
