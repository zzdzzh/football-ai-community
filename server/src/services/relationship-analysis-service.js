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

export function createRelationshipAnalysisService(deps = {}) {
  return { analyzeDirectRelations };
}
