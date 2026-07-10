import {
  findDuplicateParent,
  isDuplicateArticle,
  levenshteinDistance,
  titleSimilarity,
} from '../../src/services/news-dedup.js';

describe('news dedup', () => {
  const existing = [
    { title: 'Arsenal beat Chelsea 2-1', source_url: 'https://example.com/a', event_key: 'arsenal-chelsea-2-1' },
    { title: 'Liverpool sign new midfielder', source_url: 'https://example.com/b', event_key: 'liverpool-signing' },
  ];

  it('computes levenshtein distance', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('', '')).toBe(0);
  });

  it('detects duplicate by exact source url', () => {
    const candidate = {
      title: 'Different title',
      sourceUrl: 'https://example.com/a',
    };
    expect(isDuplicateArticle(candidate, existing)).toBe(true);
  });

  it('detects duplicate by similar title above threshold', () => {
    const candidate = {
      title: 'Arsenal beats Chelsea 2-1',
      sourceUrl: 'https://example.com/c',
    };
    expect(titleSimilarity(candidate.title, existing[0].title)).toBeGreaterThan(0.85);
    expect(isDuplicateArticle(candidate, existing)).toBe(true);
  });

  it('detects duplicate by event key', () => {
    const candidate = {
      title: 'Totally different headline',
      sourceUrl: 'https://example.com/d',
      eventKey: 'arsenal-chelsea-2-1',
    };
    expect(isDuplicateArticle(candidate, existing)).toBe(true);
  });

  it('allows unique article', () => {
    const candidate = {
      title: 'Manchester City win Champions League final',
      sourceUrl: 'https://example.com/e',
      eventKey: 'city-cl-final',
    };
    expect(isDuplicateArticle(candidate, existing)).toBe(false);
  });

  it('finds duplicate parent by event key', () => {
    const candidate = {
      title: 'Different headline',
      sourceUrl: 'https://example.com/f',
      eventKey: 'arsenal-chelsea-2-1',
    };
    const parent = findDuplicateParent(candidate, [
      { id: 'parent-1', title: 'Arsenal beat Chelsea 2-1', event_key: 'arsenal-chelsea-2-1' },
    ]);
    expect(parent).toEqual(expect.objectContaining({ id: 'parent-1' }));
  });

  it('finds duplicate parent by similar title', () => {
    const candidate = {
      title: 'Arsenal beats Chelsea 2-1',
      sourceUrl: 'https://example.com/g',
    };
    const parent = findDuplicateParent(candidate, [
      { id: 'parent-2', title: 'Arsenal beat Chelsea 2-1', event_key: 'arsenal-chelsea-2-1' },
    ]);
    expect(parent).toEqual(expect.objectContaining({ id: 'parent-2' }));
  });
});
