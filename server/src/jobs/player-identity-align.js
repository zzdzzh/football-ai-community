import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { config } from '../config/index.js';
import { AppError } from '../middleware/error.js';
import { alignPlayerIdentities } from '../services/player-identity-align-service.js';

/**
 * 内部/批处理对齐 Job：同步执行并返回计数（契约允许 200）。
 * @param {{ trigger?: 'cron'|'internal', statsPlayerId?: string, careerPlayerId?: string }} options
 */
export function executePlayerIdentityAlignJob(options = {}) {
  return alignPlayerIdentities({
    trigger: options.trigger ?? 'internal',
    statsPlayerId: options.statsPlayerId,
    careerPlayerId: options.careerPlayerId,
  });
}

export function createPlayerIdentityAlignRouter() {
  const router = Router();

  router.post('/player-identity-align', (req, res, next) => {
    try {
      const internalKey = req.headers['x-internal-key'];
      if (!internalKey || internalKey !== config.internalApiKey) {
        throw new AppError(401, 'unauthorized', '内部接口密钥无效');
      }

      const sync = req.query.sync === '1' || req.query.sync === 'true';
      if (!sync && req.query.async === '1') {
        const jobId = randomUUID();
        Promise.resolve()
          .then(() => executePlayerIdentityAlignJob({ trigger: 'internal' }))
          .catch((err) => {
            console.error(JSON.stringify({
              level: 'error',
              type: 'player_identity_align_job_failed',
              jobId,
              message: err.message,
            }));
          });
        res.status(202).json({ accepted: true, jobId });
        return;
      }

      const result = executePlayerIdentityAlignJob({
        trigger: 'internal',
        statsPlayerId: req.body?.statsPlayerId,
        careerPlayerId: req.body?.careerPlayerId,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
