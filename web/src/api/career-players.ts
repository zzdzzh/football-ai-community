import apiClient from './client';

export interface CareerPlayerCandidate {
  id: string;
  name: string;
  dateOfBirth?: string | null;
  nationality?: string | null;
  currentClubName?: string | null;
  primaryClubHint?: string | null;
  externalId?: string | null;
}

export interface CareerPlayerSearchResponse {
  items: CareerPlayerCandidate[];
  sourceNote: string;
}

export interface ClubStintDto {
  id: string;
  clubId: string;
  clubName: string;
  joinedOn?: string | null;
  leftOn?: string | null;
  joinedRaw?: string | null;
  leftRaw?: string | null;
  timePrecision: string;
  transferType?: string | null;
  transferFee?: string | null;
}

export interface NationalTeamStintDto {
  id: string;
  nationKey: string;
  nationName: string;
  joinedOn?: string | null;
  leftOn?: string | null;
  timePrecision: string;
}

export interface CareerPlayerDetail {
  id: string;
  name: string;
  dateOfBirth?: string | null;
  nationality?: string | null;
  position?: string | null;
  currentClubName?: string | null;
  syncedAt?: string | null;
  syncStatus: string;
  lastSyncError?: string | null;
  dataFreshnessLabel?: string | null;
  clubStints: ClubStintDto[];
  nationalTeamStints: NationalTeamStintDto[];
}

export async function searchCareerPlayers(
  q: string,
  limit?: number,
): Promise<CareerPlayerSearchResponse> {
  const { data } = await apiClient.get<CareerPlayerSearchResponse>('/career-players', {
    params: { q, limit },
  });
  return data;
}

export async function fetchCareerPlayer(playerId: string): Promise<CareerPlayerDetail> {
  const { data } = await apiClient.get<CareerPlayerDetail>(`/career-players/${playerId}`);
  return data;
}

export async function syncCareerPlayer(playerId: string): Promise<CareerPlayerDetail> {
  const { data } = await apiClient.post<CareerPlayerDetail>(`/career-players/${playerId}/sync`);
  return data;
}
