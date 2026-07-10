const LEAGUE_KEYWORDS = {
  PL: ['premier league', '英超', 'pl'],
  PD: ['la liga', '西甲', 'pd'],
  BL1: ['bundesliga', '德甲', 'bl1'],
  SA: ['serie a', '意甲', 'sa'],
  FL1: ['ligue 1', '法甲', 'fl1'],
  CL: ['champions league', '欧冠', 'cl'],
};

export function computePreferenceScore(item, preferences) {
  const text = `${item.title ?? ''} ${item.summary ?? ''}`.toLowerCase();
  const publishedMs = new Date(item.publishedAt).getTime() || 0;

  let boost = 0;

  for (const team of preferences.followedTeams ?? []) {
    if (team && text.includes(team.toLowerCase())) {
      boost += 100000;
    }
  }

  for (const league of preferences.followedLeagues ?? []) {
    const keywords = LEAGUE_KEYWORDS[league] ?? [league.toLowerCase()];
    if (keywords.some((keyword) => text.includes(keyword))) {
      boost += 50000;
    }
  }

  return publishedMs + boost;
}

export function applyPreferenceFilteringAndSorting(items, preferences) {
  const enabledAgents = preferences?.enabledAgents ?? [];
  const filtered = enabledAgents.length > 0
    ? items.filter((item) => enabledAgents.includes(item.agentId))
    : items;

  if (!preferences || (preferences.followedTeams.length === 0 && preferences.followedLeagues.length === 0)) {
    return [...filtered].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }

  return [...filtered]
    .map((item) => ({ item, score: computePreferenceScore(item, preferences) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}
