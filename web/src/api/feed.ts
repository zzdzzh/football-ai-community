import apiClient from './client';
import type { FeedItemDetail, FeedListResponse } from '@/types/feed';

export async function fetchFeedList(params?: {
  page?: number;
  pageSize?: number;
  agentId?: string;
}): Promise<FeedListResponse> {
  const { data } = await apiClient.get<FeedListResponse>('/feed', { params });
  return data;
}

export async function fetchFeedDetail(feedId: string): Promise<FeedItemDetail> {
  const { data } = await apiClient.get<FeedItemDetail>(`/feed/${feedId}`);
  return data;
}
