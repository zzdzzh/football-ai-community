import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { requestIdMiddleware } from './middleware/request-id.js';
import { loggingMiddleware } from './middleware/logging.js';
import { errorMiddleware } from './middleware/error.js';
import { optionalAuth } from './middleware/auth.js';
import authRouter from './api/auth.js';
import feedRouter from './api/feed.js';
import preferencesRouter from './api/preferences.js';
import matchesRouter from './api/matches.js';
import teamsRouter from './api/teams.js';
import conversationsRouter from './api/conversations.js';
import playersRouter from './api/players.js';
import careerPlayersRouter from './api/career-players.js';
import playerPairAnalysesRouter from './api/player-pair-analyses.js';
import relationshipNarrativesRouter from './api/relationship-narratives.js';
import fanPersonasRouter from './api/fan-personas.js';
import fanDiscussionsRouter from './api/fan-discussions.js';
import contentReportsRouter from './api/content-reports.js';
import adminReportsRouter from './api/admin-reports.js';
import { config } from './config/index.js';
import { getHealthNewsMeta } from './services/feed-service.js';
import { createInternalRouter } from './jobs/news-fetch.js';
import { createMatchSyncRouter } from './jobs/match-sync.js';
import { createPlayerSyncRouter } from './jobs/player-sync.js';
import { createMatchReportRouter } from './jobs/match-report-generate.js';
import { createPlayerIdentityAlignRouter } from './jobs/player-identity-align.js';
import playerIdentityLinksRouter from './api/player-identity-links.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadOpenApiSpec() {
  const specPath = resolve(__dirname, '../../specs/001-football-feed-mvp/contracts/openapi.yaml');
  const content = readFileSync(specPath, 'utf8');
  return yaml.parse(content);
}

export { createAiContentService, createAiInteractiveContentService } from './ai/factory.js';

export function createApp() {
  const app = express();
  const openApiSpec = loadOpenApiSpec();

  app.use(cors());
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use(loggingMiddleware);
  app.use(optionalAuth);

  app.get('/api/health', (_req, res) => {
    const newsMeta = getHealthNewsMeta();
    res.status(200).json({
      status: 'ok',
      ...newsMeta,
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/feed', feedRouter);
  app.use('/api/users', preferencesRouter);
  app.use('/api/matches', matchesRouter);
  app.use('/api/teams', teamsRouter);
  app.use('/api/players', playersRouter);
  app.use('/api/career-players', careerPlayersRouter);
  app.use('/api/player-pair-analyses', relationshipNarrativesRouter);
  app.use('/api/player-pair-analyses', playerPairAnalysesRouter);
  app.use('/api/fan-personas', fanPersonasRouter);
  app.use('/api/fan-discussions', fanDiscussionsRouter);
  app.use('/api/content-reports', contentReportsRouter);
  app.use('/api/admin/content-reports', adminReportsRouter);
  app.use('/api/conversations', conversationsRouter);
  app.use('/api/player-identity-links', playerIdentityLinksRouter);
  app.use('/api/internal', createInternalRouter());
  app.use('/api/internal', createMatchSyncRouter());
  app.use('/api/internal', createPlayerSyncRouter());
  app.use('/api/internal', createMatchReportRouter());
  app.use('/api/internal', createPlayerIdentityAlignRouter());
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use(errorMiddleware);
  return app;
}
