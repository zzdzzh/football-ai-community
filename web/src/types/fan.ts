import type { LeagueCode } from '@/constants/leagues';

export interface FanPersona {
  id: string;
  displayName: string;
  teamId: string;
  teamName: string;
  leagueCode: LeagueCode;
  styleTraits: string[];
  accentPhrases?: string[];
}

export interface FanPersonaListResponse {
  items: FanPersona[];
}

export interface FanDiscussionTurn {
  id: string;
  sequence: number;
  role: 'persona' | 'user';
  personaId?: string | null;
  personaDisplayName?: string | null;
  teamName?: string | null;
  userId?: string | null;
  content: string;
  isHidden?: boolean;
  createdAt: string;
}

export interface FanDiscussionDetail {
  id: string;
  topic: string;
  matchId?: string | null;
  status: 'active' | 'hidden' | 'archived';
  personas: FanPersona[];
  turns: FanDiscussionTurn[];
  turnCount: number;
  feedItemId?: string | null;
  disclaimer?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFanDiscussionRequest {
  topic: string;
  personaIds: string[];
  matchId?: string;
}

export interface AddFanTurnResponse {
  userTurn: FanDiscussionTurn;
  personaTurns: FanDiscussionTurn[];
}

export interface ContentReport {
  id: string;
  targetType: 'fan_discussion' | 'fan_discussion_turn';
  targetId: string;
  reason: string;
  status: 'pending' | 'hidden' | 'dismissed';
  reporterUserId?: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  targetSummary?: string | null;
  createdAt: string;
}

export interface CreateContentReportRequest {
  targetType: 'fan_discussion' | 'fan_discussion_turn';
  targetId: string;
  reason: string;
}

export interface ContentReportListResponse {
  items: ContentReport[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ContentReportActionResponse {
  report: ContentReport;
  message: string;
}
