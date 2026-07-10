export const LEAGUE_CODES = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'CL', 'WC'] as const;

export type LeagueCode = (typeof LEAGUE_CODES)[number];

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
