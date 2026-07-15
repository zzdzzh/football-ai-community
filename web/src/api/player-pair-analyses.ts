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
  result?: {
    clubmates: DirectRelationVerdict;
    nationalTeammates: DirectRelationVerdict;
    clubmateDetails?: OverlapDetail[];
    nationalTeammateDetails?: OverlapDetail[];
    transfer?: {
      directTransferLink: boolean;
      successiveSameClub: boolean;
      evidence: string[];
    };
    pathStatus?: string;
    relationDistance?: number | null;
    indirectPath?: unknown;
  } | null;
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
