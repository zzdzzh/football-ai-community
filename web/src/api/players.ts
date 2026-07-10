import apiClient from './client';
import type { LeagueCode } from '@/constants/leagues';
import type { PlayerDetail, PlayerListResponse } from '@/types/scout';

export async function fetchPlayers(params?: {
  league?: LeagueCode;
  teamId?: string;
  position?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<PlayerListResponse> {
  const { data } = await apiClient.get<PlayerListResponse>('/players', { params });
  return data;
}

export async function fetchPlayer(playerId: string): Promise<PlayerDetail> {
  const { data } = await apiClient.get<PlayerDetail>(`/players/${playerId}`);
  return data;
}
