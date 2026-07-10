import { randomUUID } from 'node:crypto';
import cron from 'node-cron';
import { Router } from 'express';
import { config } from '../config/index.js';
import { AppError } from '../middleware/error.js';
import { createAiContentService } from '../ai/factory.js';
import { runNewsIngestion } from '../services/feed-service.js';

let cronTask = null;
let runningJob = null;

export async function executeNewsFetchJob() {
  if (runningJob) {
    return runningJob;
  }

  runningJob = runNewsIngestion({
    aiContentService: createAiContentService(),
  }).finally(() => {
    runningJob = null;
  });

  return runningJob;
}

export function scheduleNewsFetchCron() {
  if (config.isTest || cronTask) {
    return;
  }

  cronTask = cron.schedule('*/15 * * * *', () => {
    executeNewsFetchJob().catch((err) => {
      console.error(JSON.stringify({
        level: 'error',
        type: 'news_fetch_cron_failed',
        message: err.message,
      }));
    });
  });
}

export function createInternalRouter() {
  const router = Router();

  router.post('/jobs/news-fetch', (req, res, next) => {
    try {
      const internalKey = req.headers['x-internal-key'];
      if (!internalKey || internalKey !== config.internalApiKey) {
        throw new AppError(401, 'unauthorized', '内部接口密钥无效');
      }

      const jobId = randomUUID();
      executeNewsFetchJob().catch((err) => {
        console.error(JSON.stringify({
          level: 'error',
          type: 'news_fetch_job_failed',
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
