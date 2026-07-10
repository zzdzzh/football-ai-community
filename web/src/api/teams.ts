import apiClient from './client';
import type { LeagueCode, Team, TeamListResponse } from '@/types/stats';

export async function searchTeams(params?: {
  q?: string;
  league?: LeagueCode;
  page?: number;
  pageSize?: number;
}): Promise<TeamListResponse> {
  const { data } = await apiClient.get<TeamListResponse>('/teams', { params });
  return data;
}

export async function fetchTeamDetail(teamId: string): Promise<Team & { recentMatches?: unknown[] }> {
  const { data } = await apiClient.get(`/teams/${teamId}`);
  return data;
}
