const PRECISION_RANK = {
  exact: 0,
  month: 1,
  year: 2,
  season: 3,
  open_ended: 4,
  unparseable: 5,
};

const OPEN_ENDED_RE = /^(至今|present|heute|aktuell|current|-+)$/i;

function resolveAsOfDate(asOf) {
  if (asOf) return String(asOf).slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function isOpenEndedText(raw) {
  if (raw == null) return false;
  const s = String(raw).trim();
  return s === '' || OPEN_ENDED_RE.test(s);
}

function pickLessPrecisePrecision(a, b) {
  return (PRECISION_RANK[a] ?? 5) >= (PRECISION_RANK[b] ?? 5) ? a : b;
}

function parseSeasonBounds(raw) {
  const match = String(raw).trim().match(/^(\d{4})[/-](\d{2,4})$/);
  if (!match) return null;

  const startYear = parseInt(match[1], 10);
  let endYear;
  const endPart = match[2];
  if (endPart.length === 2) {
    const century = Math.floor(startYear / 100) * 100;
    endYear = century + parseInt(endPart, 10);
    if (endYear < startYear) {
      endYear += 100;
    }
  } else {
    endYear = parseInt(endPart, 10);
  }

  return {
    joinedOn: `${startYear}-07-01`,
    leftOn: `${endYear}-06-30`,
    precision: 'season',
  };
}

/**
 * @param {string|null|undefined} raw
 * @param {{ role?: 'joined'|'left', asOf?: string }} [opts]
 * @returns {{ joinedOn: string|null, leftOn: string|null, precision: string, displayLeft?: string }}
 */
export function normalizeTimeBound(raw, { role = 'joined', asOf } = {}) {
  const asOfDate = resolveAsOfDate(asOf);

  if (raw == null || String(raw).trim() === '') {
    if (role === 'left') {
      return {
        joinedOn: null,
        leftOn: asOfDate,
        precision: 'open_ended',
        displayLeft: '至今',
      };
    }
    return { joinedOn: null, leftOn: null, precision: 'unparseable' };
  }

  const text = String(raw).trim();

  if (isOpenEndedText(text)) {
    return {
      joinedOn: null,
      leftOn: asOfDate,
      precision: 'open_ended',
      displayLeft: '至今',
    };
  }

  const exactMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (exactMatch) {
    return { joinedOn: text, leftOn: text, precision: 'exact' };
  }

  const monthMatch = text.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const year = parseInt(monthMatch[1], 10);
    const month = parseInt(monthMatch[2], 10);
    const joinedOn = `${monthMatch[1]}-${monthMatch[2]}-01`;
    const leftOn = lastDayOfMonth(year, month);
    return { joinedOn, leftOn, precision: 'month' };
  }

  const yearMatch = text.match(/^(\d{4})$/);
  if (yearMatch) {
    const year = yearMatch[1];
    return {
      joinedOn: `${year}-01-01`,
      leftOn: `${year}-12-31`,
      precision: 'year',
    };
  }

  const seasonBounds = parseSeasonBounds(text);
  if (seasonBounds) {
    return seasonBounds;
  }

  return { joinedOn: null, leftOn: null, precision: 'unparseable' };
}

/**
 * @param {{ joinedRaw?: string|null, leftRaw?: string|null, asOf?: string }} [opts]
 * @returns {{ joinedOn: string|null, leftOn: string|null, precision: string, displayLeft?: string }}
 */
export function normalizeStintInterval({ joinedRaw, leftRaw, asOf } = {}) {
  const joined = normalizeTimeBound(joinedRaw, { role: 'joined', asOf });

  if (joined.precision === 'unparseable' || !joined.joinedOn) {
    return { joinedOn: null, leftOn: null, precision: 'unparseable' };
  }

  if (leftRaw == null || String(leftRaw).trim() === '' || isOpenEndedText(leftRaw)) {
    const asOfDate = resolveAsOfDate(asOf);
    return {
      joinedOn: joined.joinedOn,
      leftOn: asOfDate,
      precision: 'open_ended',
      displayLeft: '至今',
    };
  }

  const left = normalizeTimeBound(leftRaw, { role: 'left', asOf });
  if (left.precision === 'unparseable' || !left.leftOn) {
    return { joinedOn: null, leftOn: null, precision: 'unparseable' };
  }

  return {
    joinedOn: joined.joinedOn,
    leftOn: left.leftOn,
    precision: pickLessPrecisePrecision(joined.precision, left.precision),
  };
}

/**
 * @param {{ joinedOn?: string|null, leftOn?: string|null, precision?: string }} a
 * @param {{ joinedOn?: string|null, leftOn?: string|null, precision?: string }} b
 * @returns {boolean}
 */
export function intervalsOverlap(a, b) {
  if (!a || !b) return false;
  if (a.precision === 'unparseable' || b.precision === 'unparseable') return false;
  if (!a.joinedOn || !a.leftOn || !b.joinedOn || !b.leftOn) return false;
  return a.joinedOn <= b.leftOn && b.joinedOn <= a.leftOn;
}
