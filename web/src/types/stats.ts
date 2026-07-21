import type { LeagueCode } from '@/constants/leagues';

import type { PlayerRecommendation, ScoutContextType } from '@/types/scout';
import type { TacticalAnalysis, TacticalContextType } from '@/types/tactical';

export type { LeagueCode } from '@/constants/leagues';
export { LEAGUE_CODES } from '@/constants/leagues';

export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';

export interface Team {
  id: string;
  name: string;
  shortName?: string;
  tla?: string;
  crestUrl?: string;
  leagueCode: LeagueCode;
}

export interface MatchSummary {
  id: string;
  leagueCode: LeagueCode;
  utcDate: string;
  status: MatchStatus;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  dataCompleteness: 'complete' | 'partial' | 'pending';
}

export interface MatchDetail extends MatchSummary {
  season?: string;
  matchday?: number;
  stats?: MatchStatItem[];
  events?: MatchEventItem[];
  syncMessage?: string;
  report?: MatchReportFeedItem;
}

export interface MatchReportSection {
  heading?: string;
  content?: string;
}

export interface MatchReportFeedItem {
  id: string;
  type: 'match_report' | 'brief_report';
  title: string;
  summary?: string;
  publishedAt: string;
  body?: {
    sections?: MatchReportSection[];
    timeline?: MatchEventItem[];
    missingFields?: string[];
  };
}

export interface MatchStatItem {
  name: string;
  homeValue?: number;
  awayValue?: number;
  unit?: string;
}

export interface MatchEventItem {
  minute?: number;
  type?: string;
  teamId?: string;
  playerName?: string;
}

export interface MatchListResponse {
  items: MatchSummary[];
  page: number;
  pageSize: number;
  total: number;
  syncStatus?: 'ok' | 'degraded' | 'down';
  warnings?: string[];
}

export interface TeamListResponse {
  items: Team[];
  page: number;
  pageSize: number;
  total: number;
}

export type ContextType = 'match' | 'team' | 'general';

export type AgentId = 'stats' | 'scout' | 'tactical';

export type MessageRole = 'user' | 'assistant';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface MetricCitation {
  name: string;
  value: number;
  unit?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  metrics?: MetricCitation[];
  confidence?: ConfidenceLevel;
  missingFields?: string[];
  recommendations?: PlayerRecommendation[];
  narrowHint?: string;
  tacticalAnalysis?: TacticalAnalysis;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  agentId: AgentId;
  contextType: ContextType | ScoutContextType | TacticalContextType;
  contextId: string | null;
  title: string;
  updatedAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: Message[];
}

export interface ConversationListResponse {
  items: ConversationSummary[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CreateConversationRequest {
  agentId: AgentId;
  contextType: ContextType | ScoutContextType | TacticalContextType;
  contextId?: string;
  initialMessage?: string;
}

export interface SendMessageResponse {
  userMessage: Message;
  assistantMessage: Message;
}
