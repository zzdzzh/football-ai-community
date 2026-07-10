export function levenshteinDistance(a, b) {
  const left = a ?? '';
  const right = b ?? '';
  const matrix = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));

  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[left.length][right.length];
}

export function normalizeTitle(title) {
  return (title ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function titleSimilarity(titleA, titleB) {
  const left = normalizeTitle(titleA);
  const right = normalizeTitle(titleB);
  const maxLen = Math.max(left.length, right.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(left, right) / maxLen;
}

export function isDuplicateArticle(candidate, existingArticles, { titleThreshold = 0.85 } = {}) {
  if (!candidate) return false;

  const sourceUrl = candidate.sourceUrl ?? candidate.source_url;
  if (sourceUrl && existingArticles.some((item) => item.source_url === sourceUrl || item.sourceUrl === sourceUrl)) {
    return true;
  }

  const eventKey = candidate.eventKey ?? candidate.event_key;
  if (eventKey && existingArticles.some((item) => item.event_key === eventKey || item.eventKey === eventKey)) {
    return true;
  }

  const title = candidate.title ?? '';
  return existingArticles.some((item) => titleSimilarity(item.title, title) > titleThreshold);
}

export function findDuplicateParent(candidate, existingArticles, { titleThreshold = 0.85 } = {}) {
  if (!candidate || !existingArticles?.length) return null;

  const eventKey = candidate.eventKey ?? candidate.event_key;
  if (eventKey) {
    const byEventKey = existingArticles.find(
      (item) => item.event_key === eventKey || item.eventKey === eventKey,
    );
    if (byEventKey?.id) return byEventKey;
  }

  const title = candidate.title ?? '';
  return existingArticles.find((item) => titleSimilarity(item.title, title) > titleThreshold) ?? null;
}
