import type { LeagueCode } from '@/constants/leagues';
import type { ConfidenceLevel, MessageRole } from '@/types/stats';

export type ScoutContextType = 'general' | 'league' | 'team';

export interface PlayerStat {
  name: string;
  value: number | string;
  unit?: string;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  position?: string;
  age?: number | null;
  nationality?: string;
  leagueCode: LeagueCode;
}

export interface PlayerDetail extends Player {
  dateOfBirth?: string | null;
  stats: PlayerStat[];
  syncMessage?: string;
}

export interface PlayerListResponse {
  items: Player[];
  page: number;
  pageSize: number;
  total: number;
  syncStatus?: 'ok' | 'degraded' | 'down';
}

export interface PlayerRecommendation {
  playerId: string;
  playerName: string;
  teamName: string;
  position?: string;
  matchReason: string;
  keyStats: PlayerStat[];
}

export interface ScoutMessage {
  id: string;
  role: MessageRole;
  content: string;
  recommendations?: PlayerRecommendation[];
  narrowHint?: string;
  confidence?: ConfidenceLevel;
  metrics?: { name: string; value: number | string }[];
  createdAt: string;
}

export interface ScoutConversationSummary {
  id: string;
  agentId: 'scout';
  contextType: ScoutContextType;
  contextId: string | null;
  title: string;
  updatedAt: string;
}

export interface ScoutConversationDetail extends ScoutConversationSummary {
  messages: ScoutMessage[];
}

export interface CreateScoutConversationRequest {
  agentId: 'scout';
  contextType: ScoutContextType;
  contextId?: string;
  initialMessage?: string;
}

export interface MessageFeedbackResponse {
  messageId: string;
  helpful: boolean;
  recordedAt: string;
}
