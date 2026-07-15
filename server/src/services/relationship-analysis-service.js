import { intervalsOverlap } from './time-normalize.js';

const PRECISION_RANK = {
  exact: 0,
  month: 1,
  year: 2,
  season: 3,
  open_ended: 4,
  unparseable: 5,
};

function pickLessPrecisePrecision(a, b) {
  return (PRECISION_RANK[a] ?? 5) >= (PRECISION_RANK[b] ?? 5) ? a : b;
}

function isUsableStint(stint) {
  if (stint.timePrecision === 'unparseable') return false;
  if (!stint.joinedOn || !stint.leftOn) return false;
  return true;
}

function toInterval(stint) {
  return {
    joinedOn: stint.joinedOn,
    leftOn: stint.leftOn,
    precision: stint.timePrecision,
  };
}

function analyzeStintRelations(stintsA, stintsB, sameEntity, buildDetail) {
  if (stintsA.length === 0 || stintsB.length === 0) {
    return { status: 'unknown', details: [] };
  }

  const usableA = stintsA.filter(isUsableStint);
  const usableB = stintsB.filter(isUsableStint);

  if (usableA.length === 0 || usableB.length === 0) {
    return { status: 'unknown', details: [] };
  }

  const details = [];

  for (const stintA of usableA) {
    for (const stintB of usableB) {
      if (!sameEntity(stintA, stintB)) continue;

      const intervalA = toInterval(stintA);
      const intervalB = toInterval(stintB);

      if (!intervalsOverlap(intervalA, intervalB)) continue;

      details.push(buildDetail(stintA, stintB, intervalA, intervalB));
    }
  }

  if (details.length > 0) {
    return { status: 'established', details };
  }

  return { status: 'not_established', details: [] };
}

function buildClubDetail(stintA, stintB, intervalA, intervalB) {
  const clubId = stintA.clubId;
  const clubName = stintA.clubName;
  return {
    clubId,
    clubName,
    entityId: clubId,
    entityName: clubName,
    overlapFrom: intervalA.joinedOn > intervalB.joinedOn ? intervalA.joinedOn : intervalB.joinedOn,
    overlapTo: intervalA.leftOn < intervalB.leftOn ? intervalA.leftOn : intervalB.leftOn,
    precision: pickLessPrecisePrecision(intervalA.precision, intervalB.precision),
  };
}

function buildNationalDetail(stintA, stintB, intervalA, intervalB) {
  return {
    entityId: stintA.nationKey,
    entityName: stintA.nationName,
    overlapFrom: intervalA.joinedOn > intervalB.joinedOn ? intervalA.joinedOn : intervalB.joinedOn,
    overlapTo: intervalA.leftOn < intervalB.leftOn ? intervalA.leftOn : intervalB.leftOn,
    precision: pickLessPrecisePrecision(intervalA.precision, intervalB.precision),
  };
}

/**
 * @param {{ playerA: object, playerB: object }} params
 */
export function analyzeDirectRelations({ playerA, playerB }) {
  const clubResult = analyzeStintRelations(
    playerA.clubStints ?? [],
    playerB.clubStints ?? [],
    (stintA, stintB) => stintA.clubId === stintB.clubId,
    buildClubDetail,
  );

  const nationalResult = analyzeStintRelations(
    playerA.nationalTeamStints ?? [],
    playerB.nationalTeamStints ?? [],
    (stintA, stintB) => stintA.nationKey === stintB.nationKey,
    buildNationalDetail,
  );

  return {
    clubmates: { status: clubResult.status },
    nationalTeammates: { status: nationalResult.status },
    clubmateDetails: clubResult.details,
    nationalTeammateDetails: nationalResult.details,
  };
}

function collectSharedClubs(stintsA, stintsB) {
  const clubIdsB = new Set(stintsB.map((s) => s.clubId));
  const shared = [];
  const seen = new Set();

  for (const stint of stintsA) {
    if (!clubIdsB.has(stint.clubId) || seen.has(stint.clubId)) continue;
    seen.add(stint.clubId);
    shared.push({ clubId: stint.clubId, clubName: stint.clubName });
  }

  return shared;
}

function hasExplicitTransferLink(stintsA, stintsB, playerIdA, playerIdB) {
  const allStints = [...stintsA, ...stintsB];

  for (const stint of allStints) {
    if (stint.transferFromPlayerId === playerIdA || stint.transferFromPlayerId === playerIdB) {
      return true;
    }
    if (stint.transferToPlayerId === playerIdA || stint.transferToPlayerId === playerIdB) {
      return true;
    }
  }

  return false;
}

/**
 * @param {{ playerA: object, playerB: object }} params
 */
export function analyzeTransferLink({ playerA, playerB }) {
  const stintsA = playerA.clubStints ?? [];
  const stintsB = playerB.clubStints ?? [];
  const sharedClubs = collectSharedClubs(stintsA, stintsB);
  const evidence = [];

  const successiveSameClub = sharedClubs.length > 0;
  if (successiveSameClub) {
    for (const club of sharedClubs) {
      evidence.push(`双方均曾效力 ${club.clubName}`);
    }
  }

  const explicitLink = hasExplicitTransferLink(
    stintsA,
    stintsB,
    playerA.id,
    playerB.id,
  );

  let directTransferLink = false;
  if (explicitLink) {
    directTransferLink = true;
    evidence.push('数据源含显式球员关联字段（transferFromPlayerId/transferToPlayerId）');
  } else if (successiveSameClub) {
    evidence.push('insufficient_source_fields: 无显式转会关联字段，无法判定直接转会关联');
  }

  return {
    directTransferLink,
    successiveSameClub,
    evidence,
  };
}

function nodeKey(type, id) {
  return `${type}:${id}`;
}

function parseNodeKey(key) {
  const idx = key.indexOf(':');
  return { type: key.slice(0, idx), id: key.slice(idx + 1) };
}

function buildBipartiteAdjacency(graphPlayers) {
  const adj = new Map();
  const clubNames = new Map();
  const playerNames = new Map();

  function addEdge(fromKey, toKey) {
    if (!adj.has(fromKey)) adj.set(fromKey, []);
    adj.get(fromKey).push(toKey);
  }

  for (const p of graphPlayers) {
    playerNames.set(p.id, p.name);
    for (const stint of p.clubStints ?? []) {
      clubNames.set(stint.clubId, stint.clubName);
      const playerKey = nodeKey('player', p.id);
      const clubNodeKey = nodeKey('club', stint.clubId);
      addEdge(playerKey, clubNodeKey);
      addEdge(clubNodeKey, playerKey);
    }
  }

  return { adj, clubNames, playerNames };
}

function rebuildPath(goalKey, parent) {
  const nodes = [];
  const edges = [];
  let current = goalKey;

  while (current) {
    const { type, id } = parseNodeKey(current);
    nodes.unshift({ type, id, name: '' });
    const prev = parent.get(current);
    if (prev) {
      edges.unshift({ from: prev.from, to: current });
      current = prev.from;
    } else {
      current = null;
    }
  }

  return { nodes, edges };
}

/**
 * @param {{
 *   playerIdA: string,
 *   playerIdB: string,
 *   playerNameA: string,
 *   playerNameB: string,
 *   graphPlayers: Array<{ id: string, name: string, clubStints?: object[] }>,
 *   maxHops?: number,
 * }} params
 */
export function findShortestRelationPath({
  playerIdA,
  playerIdB,
  playerNameA,
  playerNameB,
  graphPlayers,
  maxHops = 6,
}) {
  if (playerIdA === playerIdB) {
    return { pathStatus: 'no_path', relationDistance: null, indirectPath: null };
  }

  const { adj, clubNames, playerNames } = buildBipartiteAdjacency(graphPlayers);
  playerNames.set(playerIdA, playerNameA);
  playerNames.set(playerIdB, playerNameB);

  const startKey = nodeKey('player', playerIdA);
  const goalKey = nodeKey('player', playerIdB);

  const queue = [{ key: startKey, depth: 0 }];
  const visited = new Set([startKey]);
  const parent = new Map();

  let foundDepth = null;

  while (queue.length > 0) {
    const { key, depth } = queue.shift();

    if (key === goalKey) {
      foundDepth = depth;
      break;
    }

    if (depth >= maxHops) continue;

    for (const neighbor of adj.get(key) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, { from: key });
      queue.push({ key: neighbor, depth: depth + 1 });

      if (neighbor === goalKey) {
        foundDepth = depth + 1;
        queue.length = 0;
        break;
      }
    }
  }

  if (foundDepth === null) {
    return { pathStatus: 'no_path', relationDistance: null, indirectPath: null };
  }

  const { nodes, edges } = rebuildPath(goalKey, parent);

  for (const node of nodes) {
    if (node.type === 'player') {
      node.name = playerNames.get(node.id) ?? node.id;
    } else {
      node.name = clubNames.get(node.id) ?? node.id;
    }
  }

  return {
    pathStatus: 'found',
    relationDistance: foundDepth,
    indirectPath: {
      distance: foundDepth,
      nodes,
      edges,
    },
  };
}

function mapClubStintsToTimelineTrack(stints) {
  return (stints ?? [])
    .filter((s) => s.joinedOn && s.leftOn)
    .map((s) => ({
      clubId: s.clubId ?? null,
      clubName: s.clubName ?? 'Unknown Club',
      from: s.joinedOn,
      to: s.leftOn,
      timePrecision: s.timePrecision ?? null,
    }));
}

/**
 * @param {{ id: string, name: string, clubStints?: object[] }} playerA
 * @param {{ id: string, name: string, clubStints?: object[] }} playerB
 * @param {object[]} [clubmateDetails]
 */
export function buildTimelinePayload(playerA, playerB, clubmateDetails = []) {
  return {
    playerATrack: mapClubStintsToTimelineTrack(playerA.clubStints),
    playerBTrack: mapClubStintsToTimelineTrack(playerB.clubStints),
    sharedHighlights: clubmateDetails,
  };
}

/**
 * @param {{ id: string, name: string }} playerA
 * @param {{ id: string, name: string }} playerB
 * @param {{ pathStatus: string, indirectPath?: object | null }} pathResult
 */
export function buildGraphPayload(playerA, playerB, pathResult) {
  if (pathResult.pathStatus === 'found' && pathResult.indirectPath) {
    return {
      nodes: pathResult.indirectPath.nodes,
      edges: pathResult.indirectPath.edges,
    };
  }

  return {
    nodes: [
      { type: 'player', id: playerA.id, name: playerA.name },
      { type: 'player', id: playerB.id, name: playerB.name },
    ],
    edges: [],
  };
}

export function createRelationshipAnalysisService(deps = {}) {
  return {
    analyzeDirectRelations,
    analyzeTransferLink,
    findShortestRelationPath,
    buildTimelinePayload,
    buildGraphPayload,
  };
}
