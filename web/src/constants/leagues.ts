export const LEAGUE_CODES = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'CL', 'WC'] as const;

export type LeagueCode = (typeof LEAGUE_CODES)[number];

/** Scout 仅五大联赛（不含欧冠/世界杯，避免俱乐部归属混乱） */
export const CLUB_LEAGUE_CODES = ['PL', 'PD', 'BL1', 'SA', 'FL1'] as const;

export type ClubLeagueCode = (typeof CLUB_LEAGUE_CODES)[number];

export const LEAGUE_OPTIONS: { value: LeagueCode; label: string }[] = [
  { value: 'PL', label: '英超 (PL)' },
  { value: 'PD', label: '西甲 (PD)' },
  { value: 'BL1', label: '德甲 (BL1)' },
  { value: 'SA', label: '意甲 (SA)' },
  { value: 'FL1', label: '法甲 (FL1)' },
  { value: 'CL', label: '欧冠 (CL)' },
  { value: 'WC', label: '世界杯 (WC)' },
];

export const LEAGUE_OPTIONS_SHORT: { value: LeagueCode; label: string }[] = [
  { value: 'PL', label: '英超 PL' },
  { value: 'PD', label: '西甲 PD' },
  { value: 'BL1', label: '德甲 BL1' },
  { value: 'SA', label: '意甲 SA' },
  { value: 'FL1', label: '法甲 FL1' },
  { value: 'CL', label: '欧冠 CL' },
  { value: 'WC', label: '世界杯 WC' },
];

export const CLUB_LEAGUE_OPTIONS_SHORT: { value: ClubLeagueCode; label: string }[] = [
  { value: 'PL', label: '英超 PL' },
  { value: 'PD', label: '西甲 PD' },
  { value: 'BL1', label: '德甲 BL1' },
  { value: 'SA', label: '意甲 SA' },
  { value: 'FL1', label: '法甲 FL1' },
];
