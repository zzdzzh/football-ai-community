import { describe, expect, it } from '@jest/globals';
import {
  normalizeCareerSearchQuery,
  scoreCareerPlayerName,
} from '../../src/db/repositories/career-player-repository.js';

describe('career player search ranking', () => {
  it('normalizes accents for query matching', () => {
    expect(normalizeCareerSearchQuery('Mbappé')).toBe('mbappe');
    expect(normalizeCareerSearchQuery('  João  ')).toBe('joao');
  });

  it('ranks exact surname above substring noise', () => {
    const messi = scoreCareerPlayerName('lionel messi', 'messi');
    const messias = scoreCareerPlayerName('junior messias', 'messi');
    const rayane = scoreCareerPlayerName('rayane messi', 'messi');
    expect(messi).toBeGreaterThan(messias);
    expect(rayane).toBeGreaterThan(messias);
    expect(messi).toBeGreaterThanOrEqual(880);
  });

  it('does not substring-match short queries into mid-word', () => {
    expect(scoreCareerPlayerName('ahmed khalil', 'me')).toBe(0);
    expect(scoreCareerPlayerName('bruno almeida', 'me')).toBe(0);
    expect(scoreCareerPlayerName('lionel messi', 'me')).toBe(0);
    expect(scoreCareerPlayerName('mees hilgers', 'me')).toBe(0);
    expect(scoreCareerPlayerName('hao mu', 'mu')).toBeGreaterThan(0);
  });

  it('scores prefix queries for full names', () => {
    expect(scoreCareerPlayerName('erling haaland', 'haaland')).toBeGreaterThanOrEqual(880);
    expect(scoreCareerPlayerName('kylian mbappe', 'mbappe')).toBeGreaterThanOrEqual(880);
  });
});
