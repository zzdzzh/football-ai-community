import apiClient from './client';

export interface DirectRelationVerdict {
  status: 'established' | 'not_established' | 'unknown';
  reason?: string | null;
}

export interface OverlapDetail {
  entityId: string;
  entityName: string;
  overlapFrom: string;
  overlapTo: string;
  precision?: string;
}

export interface TransferLink {
  directTransferLink: boolean;
  successiveSameClub: boolean;
  evidence: string[];
}

export interface PathNode {
  type: 'player' | 'club';
  id: string;
  name: string;
}

export interface PathEdge {
  from: string;
  to: string;
}

export interface RelationPath {
  distance: number;
  nodes: PathNode[];
  edges: PathEdge[];
}

export interface PlayerPairResult {
  clubmates: DirectRelationVerdict;
  nationalTeammates: DirectRelationVerdict;
  clubmateDetails?: OverlapDetail[];
  nationalTeammateDetails?: OverlapDetail[];
  transfer?: TransferLink;
  pathStatus?: 'found' | 'no_path' | 'skipped';
  relationDistance?: number | null;
  indirectPath?: RelationPath | null;
}

export interface PlayerPairAnalysisResponse {
  status: 'ready' | 'computing' | 'failed';
  analysisId?: string | null;
  playerIdA: string;
  playerIdB: string;
  computedAt?: string | null;
  dataFreshness?: {
    playerASyncedAt?: string | null;
    playerBSyncedAt?: string | null;
    summary: string;
    usedCacheOnly?: boolean;
  };
  result?: PlayerPairResult | null;
  error?: string | null;
}

export async function getPlayerPairAnalysis(
  playerIdA: string,
  playerIdB: string,
): Promise<PlayerPairAnalysisResponse> {
  const { data } = await apiClient.get<PlayerPairAnalysisResponse>(
    `/player-pair-analyses/${playerIdA}/${playerIdB}`,
  );
  return data;
}

export async function createPlayerPairAnalysis(
  playerIdA: string,
  playerIdB: string,
): Promise<PlayerPairAnalysisResponse> {
  const { data } = await apiClient.post<PlayerPairAnalysisResponse>('/player-pair-analyses', {
    playerIdA,
    playerIdB,
  });
  return data;
}
