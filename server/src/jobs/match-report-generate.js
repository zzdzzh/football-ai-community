import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import cron from 'node-cron';
import { config } from '../config/index.js';
import { AppError } from '../middleware/error.js';
import { findFinishedMatchesWithoutReport, findMatchById } from '../db/repositories/match-repository.js';
import { createContentAgent } from '../agents/content-agent.js';
import { publishMatchReport } from '../services/feed-service.js';
import { createAiContentService } from '../ai/factory.js';

let cronTask = null;
let runningJob = null;

export async function executeMatchReportGenerateJob({
  matchId = null,
  aiContentService = null,
  contentAgent = null,
  limit = 10,
} = {}) {
  if (runningJob) {
    return runningJob;
  }

  runningJob = (async () => {
    const agent = contentAgent ?? createContentAgent({
      aiContentService: aiContentService ?? createAiContentService(),
    });

    const candidates = matchId
      ? (() => {
        const existing = findMatchById(matchId);
        if (!existing) return [];
        const without = findFinishedMatchesWithoutReport({ matchId });
        return without.length > 0 ? without : [];
      })()
      : findFinishedMatchesWithoutReport({ limit });

    let generated = 0;
    let skipped = 0;
    let failed = 0;
    const results = [];

    for (const match of candidates) {
      try {
        const report = await agent.generateMatchReport(match);
        if (report.skipped) {
          skipped += 1;
          results.push({ matchId: match.id, status: 'skipped', reason: report.reason });
          continue;
        }

        const feedItem = publishMatchReport(report);
        if (!feedItem) {
          skipped += 1;
          results.push({ matchId: match.id, status: 'skipped', reason: 'duplicate' });
          continue;
        }

        generated += 1;
        results.push({ matchId: match.id, status: 'generated', feedItemId: feedItem.id, type: report.type });
      } catch (err) {
        failed += 1;
        results.push({ matchId: match.id, status: 'failed', message: err.message });
        console.error(JSON.stringify({
          level: 'error',
          type: 'match_report_generate_item_failed',
          matchId: match.id,
          message: err.message,
        }));
      }
    }

    console.log(JSON.stringify({
      level: 'info',
      type: 'match_report_generate_done',
      candidateCount: candidates.length,
      generated,
      skipped,
      failed,
    }));

    return { candidateCount: candidates.length, generated, skipped, failed, results };
  })();

  try {
    return await runningJob;
  } finally {
    runningJob = null;
  }
}

export function scheduleMatchReportCron() {
  if (config.isTest || cronTask) {
    return;
  }

  cronTask = cron.schedule(config.matchReportCron, () => {
    executeMatchReportGenerateJob().catch((err) => {
      console.error(JSON.stringify({
        level: 'error',
        type: 'match_report_cron_failed',
        message: err.message,
      }));
    });
  });
}

export function createMatchReportRouter() {
  const router = Router();

  router.post('/jobs/match-report-generate', (req, res, next) => {
    try {
      const internalKey = req.headers['x-internal-key'];
      if (!internalKey || internalKey !== config.internalApiKey) {
        throw new AppError(401, 'unauthorized', '内部接口密钥无效');
      }

      const matchId = req.query.matchId ?? null;
      const jobId = randomUUID();
      executeMatchReportGenerateJob({ matchId }).catch((err) => {
        console.error(JSON.stringify({
          level: 'error',
          type: 'match_report_job_failed',
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
