import apiClient from './client';
import type { LeagueCode, MatchDetail, MatchListResponse, MatchStatus } from '@/types/stats';

export async function fetchMatches(params?: {
  league?: LeagueCode;
  status?: MatchStatus;
  teamId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}): Promise<MatchListResponse> {
  const { data } = await apiClient.get<MatchListResponse>('/matches', { params });
  return data;
}

export async function fetchMatchDetail(matchId: string): Promise<MatchDetail> {
  const { data } = await apiClient.get<MatchDetail>(`/matches/${matchId}`);
  return data;
}
