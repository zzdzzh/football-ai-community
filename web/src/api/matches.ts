import apiClient from './client';
import type { LeagueCode, MatchListResponse, MatchStatus, MatchSummary } from '@/types/stats';

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

export async function fetchMatchDetail(matchId: string): Promise<MatchSummary> {
  const { data } = await apiClient.get<MatchSummary>(`/matches/${matchId}`);
  return data;
}
