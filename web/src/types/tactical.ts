import type { ConfidenceLevel, MessageRole } from '@/types/stats';

export type TacticalContextType = 'match' | 'team';

export type TacticalPhaseKey = 'build_up' | 'pressing' | 'transition' | 'set_piece';

export type AnalysisType = 'post_match' | 'pre_match_prediction';

export interface TacticalPhase {
  key: TacticalPhaseKey;
  label: string;
  summary: string;
  keyPlayerNames?: string[];
}

export interface TacticalKeyPlayer {
  name: string;
  role: string;
}

export interface TacticalAnalysis {
  analysisType: AnalysisType;
  formation: string;
  phases: TacticalPhase[];
  keyPlayers?: TacticalKeyPlayer[];
  dataLimitations?: string[];
}

export interface CreateTacticalConversationRequest {
  agentId: 'tactical';
  contextType: TacticalContextType;
  contextId: string;
  initialMessage?: string;
}

export interface MessageFeedbackResponse {
  messageId: string;
  helpful: boolean;
  recordedAt: string;
}

export const ANALYSIS_TYPE_LABELS: Record<AnalysisType, string> = {
  post_match: '赛后复盘',
  pre_match_prediction: '赛前战术预判',
};

export const PHASE_KEY_LABELS: Record<TacticalPhaseKey, string> = {
  build_up: '出球组织',
  pressing: '高位压迫',
  transition: '攻守转换',
  set_piece: '定位球',
};

export type { ConfidenceLevel, MessageRole };
