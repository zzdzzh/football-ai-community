import { ALLOWED_LEAGUES } from '../constants/league-codes.js';
import { findTeamById } from '../db/repositories/team-repository.js';
import { searchPlayers, calcPlayerAge, countPlayersByLeague, searchPlayersByTeamLeague } from '../db/repositories/player-repository.js';
import {
  listPlayerStatsSnapshots,
  mapSnapshotToPlayerStats,
  pickBestPlayerStatsSnapshot,
  scoreSnapshotRichness,
} from '../db/repositories/player-stats-snapshot-repository.js';
import {
  getAggregatePlayerSyncStatus,
  findPlayerSyncMetaByLeague,
  getAllPlayerSyncMeta,
} from '../db/repositories/player-sync-meta-repository.js';
import { parseStatFocusFromQuestion } from './scout-key-stats.js';

const CANDIDATE_CAP = 50;
const BROAD_POOL_THRESHOLD = 5;
const PLAYER_DATA_NOT_SYNCED_MESSAGE = '球员数据尚未同步，请稍后再试（首次同步约需数分钟）';

function isLeaguePlayerDataNeverSynced(leagueCode) {
  const meta = findPlayerSyncMetaByLeague(leagueCode);
  if (meta?.lastSyncAt && (meta.playersCount ?? 0) > 0) {
    return false;
  }
  if (leagueCode === 'CL') {
    return searchPlayersByTeamLeague('CL', { page: 1, pageSize: 1 }).total === 0;
  }
  return !meta?.lastSyncAt && countPlayersByLeague(leagueCode) === 0;
}

function isGlobalPlayerDataNeverSynced() {
  const result = searchPlayers({ page: 1, pageSize: 1 });
  if (result.total > 0) {
    return false;
  }
  const metas = getAllPlayerSyncMeta();
  return metas.length === 0 || metas.every((meta) => !meta.lastSyncAt);
}

export function parseAgeRangeFromQuestion(question) {
  if (!question) return null;
  const match = question.match(/(\d{1,2})\s*[-~～—–到至]\s*(\d{1,2})\s*岁/);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return { minAge: Math.min(a, b), maxAge: Math.max(a, b) };
}

export function parseMaxAgeFromQuestion(question) {
  if (!question) return null;
  const match = question.match(/(\d{1,2})\s*岁\s*(?:以下|以内|之内)|under\s*(\d{1,2})|≤\s*(\d{1,2})/i);
  if (!match) return null;
  const age = Number(match[1] ?? match[2] ?? match[3]);
  return Number.isNaN(age) ? null : age;
}

export function parseMinAgeFromQuestion(question) {
  if (!question) return null;
  const match = question.match(
    /(\d{1,2})\s*岁\s*以上|over\s*(\d{1,2})|≥\s*(\d{1,2})|至少\s*(\d{1,2})\s*岁/i,
  );
  if (!match) return null;
  const age = Number(match[1] ?? match[2] ?? match[3] ?? match[4]);
  return Number.isNaN(age) ? null : age;
}

export function parsePositionFromQuestion(question) {
  if (!question) return null;
  // 边后卫须在后卫之前，避免被更宽泛关键词抢先匹配
  const keywords = [
    '边后卫', '中场', '前锋', '后卫', '门将', '边锋',
    'Midfield', 'Forward', 'Defender', 'Goalkeeper', 'Winger',
  ];
  return keywords.find((kw) => question.includes(kw)) ?? null;
}

function resolveCandidateSnapshots(player) {
  // 优先当前联赛快照；若明显更贫（如世界杯国脚无富统计、但有俱乐部赛季数据），跨联赛回退优选
  const all = listPlayerStatsSnapshots(player.id);
  if (!player.leagueCode || all.length <= 1) {
    return all;
  }
  const leagueSnapshots = all.filter((s) => s.leagueCode === player.leagueCode);
  if (leagueSnapshots.length === 0) {
    return all;
  }
  const bestLeague = pickBestPlayerStatsSnapshot(leagueSnapshots);
  const bestAll = pickBestPlayerStatsSnapshot(all);
  if (scoreSnapshotRichness(bestAll) > scoreSnapshotRichness(bestLeague) + 10) {
    return all;
  }
  return leagueSnapshots;
}

function mapCandidate(player) {
  const snapshots = resolveCandidateSnapshots(player);
  const best = pickBestPlayerStatsSnapshot(snapshots);
  const stats = best ? mapSnapshotToPlayerStats(best) : [];
  return {
    id: player.id,
    name: player.name,
    teamId: player.teamId,
    teamName: player.teamName,
    position: player.position,
    age: player.age,
    leagueCode: player.leagueCode,
    stats,
  };
}

const POSITION_ALIASES = {
  中场: ['midfield'],
  前锋: ['forward', 'striker'],
  后卫: ['defender', 'back'],
  边后卫: ['left-back', 'right-back', 'wing-back', 'full-back', 'fullback'],
  门将: ['goalkeeper'],
  边锋: ['winger'],
};

// 数据源可能存简称（D/M/F/G）或完整位名（Left-Back 等），SQL LIKE 需覆盖两者常见形态
const POSITION_SQL_LIKE_TERMS = {
  中场: ['Midfield'],
  前锋: ['Forward', 'Striker'],
  后卫: ['Back', 'Defender'],
  边后卫: ['Left-Back', 'Right-Back', 'Wing-Back', 'Full-Back'],
  门将: ['Goalkeeper'],
  边锋: ['Winger'],
  Midfield: ['Midfield'],
  Forward: ['Forward', 'Striker'],
  Defender: ['Back', 'Defender'],
  Goalkeeper: ['Goalkeeper'],
  Winger: ['Winger'],
};

const POSITION_EXACT_CODES = {
  中场: ['m'],
  Midfield: ['m'],
  前锋: ['f'],
  Forward: ['f'],
  后卫: ['d'],
  Defender: ['d'],
  门将: ['g'],
  Goalkeeper: ['g'],
};

function resolvePositionSqlLikeTerms(keyword) {
  if (!keyword) return null;
  return POSITION_SQL_LIKE_TERMS[keyword] ?? [keyword];
}

function matchPosition(playerPosition, keyword) {
  if (!keyword) return true;
  if (!playerPosition) return false;
  const lower = playerPosition.toLowerCase();
  const exactCodes = POSITION_EXACT_CODES[keyword] ?? [];
  if (exactCodes.includes(lower)) return true;
  const aliases = POSITION_ALIASES[keyword] ?? [keyword.toLowerCase()];
  return aliases.some((alias) => lower.includes(alias));
}

function filterCandidates(candidates, { maxAge = null, minAge = null, position = null } = {}) {
  let filtered = candidates;
  if (maxAge != null) {
    filtered = filtered.filter((c) => c.age != null && c.age <= maxAge);
  }
  if (minAge != null) {
    // 缺生日数据时保留候选，由 AI 说明无法确认年龄
    filtered = filtered.filter((c) => c.age == null || c.age >= minAge);
  }
  if (position) {
    filtered = filtered.filter((c) => matchPosition(c.position, position));
  }
  return filtered;
}

function searchLeagueCandidates(leagueCode, { position = null } = {}) {
  const positionAny = resolvePositionSqlLikeTerms(position);
  if (leagueCode === 'CL') {
    return searchPlayersByTeamLeague('CL', { page: 1, pageSize: CANDIDATE_CAP });
  }
  return searchPlayers({
    league: leagueCode,
    positionAny,
    page: 1,
    pageSize: CANDIDATE_CAP,
  });
}

function resolveAgeFilters(userQuestion) {
  const range = parseAgeRangeFromQuestion(userQuestion);
  if (range) {
    return { minAge: range.minAge, maxAge: range.maxAge };
  }
  return {
    minAge: parseMinAgeFromQuestion(userQuestion),
    maxAge: parseMaxAgeFromQuestion(userQuestion),
  };
}

export function buildScoutContext({ contextType, contextId, userQuestion = '' }) {
  const { status: syncStatus } = getAggregatePlayerSyncStatus();
  // 同步任务失败但库内仍有历史数据时，允许使用已有球员继续推荐
  if (syncStatus === 'down' && isGlobalPlayerDataNeverSynced()) {
    return { syncMessage: '球员数据同步暂不可用，请稍后再试' };
  }

  if (contextType === 'league') {
    if (!contextId || !ALLOWED_LEAGUES.includes(contextId)) {
      return { notFound: true };
    }
    if (isLeaguePlayerDataNeverSynced(contextId)) {
      return { syncMessage: PLAYER_DATA_NOT_SYNCED_MESSAGE };
    }
    const { maxAge, minAge } = resolveAgeFilters(userQuestion);
    const position = parsePositionFromQuestion(userQuestion);
    const statFocus = parseStatFocusFromQuestion(userQuestion, position);
    const result = searchLeagueCandidates(contextId, { position });
    const candidates = result.items.map(mapCandidate);
    const filtered = filterCandidates(candidates, { maxAge, minAge, position });
    return {
      contextType,
      contextId,
      leagueCode: contextId,
      candidates: filtered.slice(0, CANDIDATE_CAP),
      poolSize: filtered.length,
      tooBroad: filtered.length > BROAD_POOL_THRESHOLD,
      filters: { maxAge, minAge, position, leagueCode: contextId, statFocus },
    };
  }

  if (contextType === 'team') {
    const team = findTeamById(contextId);
    if (!team) {
      return { notFound: true };
    }
    if (isLeaguePlayerDataNeverSynced(team.leagueCode)) {
      return { syncMessage: PLAYER_DATA_NOT_SYNCED_MESSAGE };
    }
    const { maxAge, minAge } = resolveAgeFilters(userQuestion);
    const position = parsePositionFromQuestion(userQuestion);
    const statFocus = parseStatFocusFromQuestion(userQuestion, position);
    const result = searchPlayers({
      teamId: contextId,
      positionAny: resolvePositionSqlLikeTerms(position),
      page: 1,
      pageSize: CANDIDATE_CAP,
    });
    const candidates = result.items.map(mapCandidate);
    const filtered = filterCandidates(candidates, { maxAge, minAge, position });
    return {
      contextType,
      contextId,
      leagueCode: team.leagueCode,
      teamName: team.name,
      candidates: filtered.slice(0, CANDIDATE_CAP),
      poolSize: filtered.length,
      tooBroad: filtered.length > BROAD_POOL_THRESHOLD,
      filters: { maxAge, minAge, position, teamId: contextId, statFocus },
    };
  }

  if (contextType === 'general') {
    if (isGlobalPlayerDataNeverSynced()) {
      return { syncMessage: PLAYER_DATA_NOT_SYNCED_MESSAGE };
    }
    const { maxAge, minAge } = resolveAgeFilters(userQuestion);
    const position = parsePositionFromQuestion(userQuestion);
    const statFocus = parseStatFocusFromQuestion(userQuestion, position);
    const result = searchPlayers({
      positionAny: resolvePositionSqlLikeTerms(position),
      page: 1,
      pageSize: CANDIDATE_CAP,
    });
    const candidates = result.items.map(mapCandidate);
    const filtered = filterCandidates(candidates, { maxAge, minAge, position });
    return {
      contextType,
      contextId: null,
      candidates: filtered.slice(0, CANDIDATE_CAP),
      poolSize: filtered.length,
      tooBroad: filtered.length > BROAD_POOL_THRESHOLD,
      filters: { maxAge, minAge, position, statFocus },
    };
  }

  return { invalid: true };
}

export { CANDIDATE_CAP, BROAD_POOL_THRESHOLD };
