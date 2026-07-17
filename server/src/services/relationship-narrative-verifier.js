const VERDICT_RANK = {
  unknown: 0,
  not_established: 1,
  no_path: 1,
  skipped: 1,
  established: 2,
  found: 2,
};

const HONOR_TYPES = new Set(['honor', 'trophy', 'award']);

const CLUBMATE_UPGRADE_HINT = /队友|同队|并肩|共同效力|一起效力/;

function normalizeName(name) {
  return String(name ?? '').trim().toLowerCase();
}

function verdictStatus(value) {
  if (!value) return 'unknown';
  if (typeof value === 'string') return value;
  return value.status ?? 'unknown';
}

export function buildAllowedFacts(result = {}) {
  const clubNames = new Set();
  const pathNodeIds = new Set();
  const pathNodeNames = new Set();
  const clubmateKeys = new Set();

  for (const detail of result.clubmateDetails ?? []) {
    if (detail.clubName) clubNames.add(detail.clubName);
    if (detail.clubId) clubNames.add(detail.clubId);
    clubmateKeys.add([
      normalizeName(detail.clubName),
      detail.overlapFrom ?? '',
      detail.overlapTo ?? '',
    ].join('|'));
  }

  for (const detail of result.nationalTeammateDetails ?? []) {
    if (detail.nationName) clubNames.add(detail.nationName);
    if (detail.clubName) clubNames.add(detail.clubName);
  }

  for (const node of result.indirectPath?.nodes ?? []) {
    if (node.id) pathNodeIds.add(node.id);
    if (node.name) {
      pathNodeNames.add(node.name);
      clubNames.add(node.name);
    }
  }

  return {
    verdicts: {
      clubmates: verdictStatus(result.clubmates),
      nationalTeammates: verdictStatus(result.nationalTeammates),
      pathStatus: result.pathStatus ?? 'skipped',
    },
    clubNames: [...clubNames],
    clubNameSet: new Set([...clubNames].map(normalizeName)),
    clubmateKeys,
    pathNodeIds: [...pathNodeIds],
    pathNodeIdSet: pathNodeIds,
    pathNodeNames: [...pathNodeNames],
    pathNodeNameSet: new Set([...pathNodeNames].map(normalizeName)),
    transfer: result.transfer ?? {
      directTransferLink: false,
      successiveSameClub: false,
      evidence: [],
    },
  };
}

function fail(reason) {
  return {
    ok: false,
    reason,
    errorCode: 'narrative_verification_failed',
  };
}

function isStatusUpgrade(allowedStatus, claimedStatus) {
  const allowedRank = VERDICT_RANK[allowedStatus] ?? 0;
  const claimedRank = VERDICT_RANK[claimedStatus] ?? 0;
  return claimedRank > allowedRank;
}

function hasTransferEvidence(transfer) {
  return Boolean(
    transfer?.directTransferLink
    || transfer?.successiveSameClub
    || (Array.isArray(transfer?.evidence) && transfer.evidence.length > 0),
  );
}

function validateClaim(claim, facts) {
  if (!claim || typeof claim !== 'object') {
    return fail('claim 格式无效');
  }

  const type = claim.type;
  if (HONOR_TYPES.has(type)) {
    return fail('禁止荣誉类主张');
  }

  if (type === 'verdict') {
    const aspect = claim.aspect;
    const allowed = aspect === 'path'
      ? facts.verdicts.pathStatus
      : facts.verdicts[aspect];
    if (!allowed) {
      return fail(`未知 verdict aspect: ${aspect}`);
    }
    if (isStatusUpgrade(allowed, claim.status)) {
      return fail(`不得将 ${aspect} 从 ${allowed} 升级为 ${claim.status}`);
    }
    return null;
  }

  if (type === 'clubmate' || type === 'nationmate') {
    if (type === 'clubmate' && isStatusUpgrade(facts.verdicts.clubmates, claim.status)) {
      return fail('不得升级 clubmates 结论');
    }
    if (type === 'nationmate' && isStatusUpgrade(facts.verdicts.nationalTeammates, claim.status)) {
      return fail('不得升级 nationalTeammates 结论');
    }
    if (claim.status === 'established') {
      const clubKey = normalizeName(claim.clubName);
      if (!clubKey || !facts.clubNameSet.has(clubKey)) {
        return fail(`俱乐部名不在允许集合: ${claim.clubName}`);
      }
      if (type === 'clubmate') {
        const overlapKey = [
          clubKey,
          claim.overlapFrom ?? '',
          claim.overlapTo ?? '',
        ].join('|');
        if (claim.overlapFrom && claim.overlapTo && !facts.clubmateKeys.has(overlapKey)) {
          // 允许仅俱乐部名匹配（重叠区间可选核对）
          const nameOnly = [...facts.clubmateKeys].some((k) => k.startsWith(`${clubKey}|`));
          if (!nameOnly) {
            return fail('俱乐部队友重叠证据不匹配');
          }
        }
      }
    }
    return null;
  }

  if (type === 'transfer') {
    if (claim.status === 'established' && !hasTransferEvidence(facts.transfer)) {
      return fail('无转会证据却声明成立');
    }
    return null;
  }

  if (type === 'path') {
    if (isStatusUpgrade(facts.verdicts.pathStatus, claim.status)) {
      return fail('不得升级 pathStatus');
    }
    if (claim.status === 'found') {
      for (const id of claim.nodeIds ?? []) {
        if (!facts.pathNodeIdSet.has(id)) {
          return fail(`路径节点不在允许集合: ${id}`);
        }
      }
      for (const name of claim.nodeNames ?? []) {
        if (!facts.pathNodeNameSet.has(normalizeName(name))) {
          return fail(`路径节点名不在允许集合: ${name}`);
        }
      }
    }
    return null;
  }

  return fail(`不支持的 claim type: ${type}`);
}

function narrativeContradictsNotEstablished(narrative, facts) {
  const text = String(narrative ?? '');
  if (facts.verdicts.clubmates === 'not_established' && CLUBMATE_UPGRADE_HINT.test(text)) {
    return true;
  }
  return false;
}

/**
 * @returns {{ ok: true } | { ok: false, reason: string, errorCode: string }}
 */
export function verifyNarrativeOutput({
  result,
  narrative,
  claims,
  playerNames = [],
} = {}) {
  if (!narrative || typeof narrative !== 'string' || !narrative.trim()) {
    return fail('叙事正文为空');
  }

  const facts = buildAllowedFacts(result);
  const claimList = Array.isArray(claims) ? claims : [];

  for (const claim of claimList) {
    const err = validateClaim(claim, facts);
    if (err) return err;
  }

  if (narrativeContradictsNotEstablished(narrative, facts)) {
    return fail('叙事与 not_established 俱乐部队友结论矛盾');
  }

  return { ok: true };
}
