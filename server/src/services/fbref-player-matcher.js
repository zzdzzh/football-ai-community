export function normalizePlayerName(name) {
  if (!name) return '';
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[øØ]/g, 'o')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildPlayerNameIndex(players) {
  const index = new Map();
  for (const player of players) {
    const key = normalizePlayerName(player.name);
    if (!key) continue;
    const bucket = index.get(key) ?? [];
    bucket.push(player);
    index.set(key, bucket);
  }
  return index;
}

export function resolvePlayerByName(name, index) {
  const key = normalizePlayerName(name);
  if (!key) return null;
  const matches = index.get(key) ?? [];
  if (matches.length === 1) {
    return matches[0];
  }
  return null;
}
