/** football-data.org / 爬虫竞赛白名单（俱乐部联赛 + 杯赛） */
export const LEAGUE_CODES = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'CL', 'WC'];

export const ALLOWED_LEAGUES = LEAGUE_CODES;

/** 五大联赛（球员归属与 Scout 推荐用；不含欧冠/世界杯） */
export const CLUB_LEAGUES = ['PL', 'PD', 'BL1', 'SA', 'FL1'];

/** 杯赛/国家队赛事（球员 team_id 易与俱乐部混淆，不参与球员归属同步与 Scout） */
export const COMPETITION_LEAGUES = ['CL', 'WC'];

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

export function isClubLeague(code) {
  return CLUB_LEAGUES.includes(code);
}

export function isCompetitionLeague(code) {
  return COMPETITION_LEAGUES.includes(code);
}
