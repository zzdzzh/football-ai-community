import {
  normalizePlayerName,
  buildPlayerNameIndex,
  resolvePlayerByName,
} from '../../src/services/fbref-player-matcher.js';

describe('fbref-player-matcher', () => {
  it('normalizes accents and punctuation', () => {
    expect(normalizePlayerName('Martin Ødegaard')).toBe('martin odegaard');
    expect(normalizePlayerName('  Cole   Palmer! ')).toBe('cole palmer');
  });

  it('resolves unique player by normalized name', () => {
    const index = buildPlayerNameIndex([
      { id: 'p1', name: 'Bukayo Saka', team_id: '57' },
      { id: 'p2', name: 'Martin Ødegaard', team_id: '57' },
    ]);
    expect(resolvePlayerByName('Martin Odegaard', index)?.id).toBe('p2');
    expect(resolvePlayerByName('Unknown Player', index)).toBeNull();
  });

  it('returns null when multiple players share normalized name', () => {
    const index = buildPlayerNameIndex([
      { id: 'p1', name: 'Gabriel', team_id: '57' },
      { id: 'p2', name: 'Gabriel', team_id: '61' },
    ]);
    expect(resolvePlayerByName('Gabriel', index)).toBeNull();
  });
});
