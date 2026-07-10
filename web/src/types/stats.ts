export type LeagueCode = 'PL' | 'PD' | 'BL1' | 'SA' | 'FL1' | 'CL';

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
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  agentId: 'stats';
  contextType: ContextType;
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
  agentId: 'stats';
  contextType: ContextType;
  contextId?: string;
  initialMessage?: string;
}

export interface SendMessageResponse {
  userMessage: Message;
  assistantMessage: Message;
}
