import { runMigrations } from '../../src/db/migrate.js';
import { closeDb } from '../../src/db/connection.js';
import {
  buildTacticalContext,
  deriveAnalysisType,
} from '../../src/services/tactical-context-builder.js';
import { seedTacticalMatches } from '../helpers/seed-tactical-data.js';

describe('TacticalContextBuilder', () => {
  let matchIds;

  beforeAll(() => {
    runMigrations();
    matchIds = seedTacticalMatches();
  });

  afterAll(() => {
    closeDb();
  });

  it('derives post_match for finished matches', () => {
    expect(deriveAnalysisType('FINISHED')).toBe('post_match');
  });

  it('derives pre_match_prediction for scheduled matches', () => {
    expect(deriveAnalysisType('SCHEDULED')).toBe('pre_match_prediction');
    expect(deriveAnalysisType('LIVE')).toBe('pre_match_prediction');
  });

  it('builds match context with stats and events', () => {
    const context = buildTacticalContext({
      contextType: 'match',
      contextId: matchIds.matchId,
    });
    expect(context.analysisType).toBe('post_match');
    expect(context.payload.match.homeTeam.name).toBe('Arsenal FC');
    expect(context.payload.match.events.length).toBeGreaterThan(0);
    expect(context.maxConfidence).toBe('high');
  });

  it('builds scheduled match context as pre_match_prediction', () => {
    const context = buildTacticalContext({
      contextType: 'match',
      contextId: matchIds.scheduledMatchId,
    });
    expect(context.analysisType).toBe('pre_match_prediction');
    expect(context.dataLimitations.length).toBeGreaterThan(0);
  });

  it('caps confidence when events missing', () => {
    const context = buildTacticalContext({
      contextType: 'match',
      contextId: matchIds.partialMatchId,
    });
    expect(context.maxConfidence).toBe('medium');
    expect(context.dataLimitations.some((item) => item.includes('事件'))).toBe(true);
  });

  it('builds team context', () => {
    const context = buildTacticalContext({
      contextType: 'team',
      contextId: '57',
    });
    expect(context.analysisType).toBe('pre_match_prediction');
    expect(context.payload.team.name).toBe('Arsenal FC');
    expect(context.maxConfidence).toBe('medium');
  });

  it('returns notFound for missing match', () => {
    const context = buildTacticalContext({
      contextType: 'match',
      contextId: 'missing',
    });
    expect(context.notFound).toBe(true);
  });

  it('returns notFound for missing team', () => {
    const context = buildTacticalContext({
      contextType: 'team',
      contextId: 'missing-team',
    });
    expect(context.notFound).toBe(true);
  });

  it('returns invalid for unsupported context type', () => {
    const context = buildTacticalContext({
      contextType: 'league',
      contextId: 'PL',
    });
    expect(context.invalid).toBe(true);
  });
});
