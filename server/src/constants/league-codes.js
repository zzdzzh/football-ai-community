/** football-data.org 竞赛白名单（联赛 + 世界杯） */
export const LEAGUE_CODES = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'CL', 'WC'];

export const ALLOWED_LEAGUES = LEAGUE_CODES;

/** 需要显式 season 参数的竞赛（如世界杯） */
export const SEASON_REQUIRED_LEAGUES = ['WC'];

export const LEAGUE_DISPLAY_NAMES = {
  PL: '英超',
  PD: '西甲',
  BL1: '德甲',
  SA: '意甲',
  FL1: '法甲',
  CL: '欧冠',
  WC: '世界杯',
};

export function getLeagueDisplayName(code) {
  return LEAGUE_DISPLAY_NAMES[code] ?? code;
}

export function isAllowedLeague(code) {
  return ALLOWED_LEAGUES.includes(code);
}
