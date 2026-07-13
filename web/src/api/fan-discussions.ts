import apiClient from './client';
import type {
  AddFanTurnResponse,
  CreateFanDiscussionRequest,
  FanDiscussionDetail,
  FanPersonaListResponse,
} from '@/types/fan';
import type { LeagueCode } from '@/constants/leagues';

export async function fetchFanPersonas(params?: {
  league?: LeagueCode;
  teamId?: string;
}): Promise<FanPersonaListResponse> {
  const { data } = await apiClient.get<FanPersonaListResponse>('/fan-personas', { params });
  return data;
}

export async function createFanDiscussion(
  payload: CreateFanDiscussionRequest,
): Promise<FanDiscussionDetail> {
  const { data } = await apiClient.post<FanDiscussionDetail>('/fan-discussions', payload, {
    timeout: 65000,
  });
  return data;
}

export async function fetchFanDiscussion(discussionId: string): Promise<FanDiscussionDetail> {
  const { data } = await apiClient.get<FanDiscussionDetail>(`/fan-discussions/${discussionId}`);
  return data;
}

export async function addFanDiscussionTurn(
  discussionId: string,
  content: string,
): Promise<AddFanTurnResponse> {
  const { data } = await apiClient.post<AddFanTurnResponse>(
    `/fan-discussions/${discussionId}/turns`,
    { content },
    { timeout: 35000 },
  );
  return data;
}
