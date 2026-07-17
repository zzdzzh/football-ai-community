import apiClient from './client';

export interface RelationshipNarrativeResponse {
  status: 'ready';
  id?: string;
  playerIdA: string;
  playerIdB: string;
  analysisId: string;
  analysisComputedAt: string;
  narrativeText: string;
  aiGenerated: boolean;
  reused: boolean;
  model?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface NarrativeGenerateRequest {
  force?: boolean;
}

/** 叙事生成可能接近 60s+，单独放宽超时 */
const NARRATIVE_TIMEOUT_MS = 180000;

export async function getRelationshipNarrative(
  playerIdA: string,
  playerIdB: string,
): Promise<RelationshipNarrativeResponse> {
  const { data } = await apiClient.get<RelationshipNarrativeResponse>(
    `/player-pair-analyses/${playerIdA}/${playerIdB}/narrative`,
  );
  return data;
}

export async function createRelationshipNarrative(
  playerIdA: string,
  playerIdB: string,
  body: NarrativeGenerateRequest = {},
): Promise<RelationshipNarrativeResponse> {
  const { data } = await apiClient.post<RelationshipNarrativeResponse>(
    `/player-pair-analyses/${playerIdA}/${playerIdB}/narrative`,
    body,
    { timeout: NARRATIVE_TIMEOUT_MS },
  );
  return data;
}
