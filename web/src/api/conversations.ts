import apiClient from './client';
import type {
  ConversationDetail,
  ConversationListResponse,
  CreateConversationRequest,
  SendMessageResponse,
} from '@/types/stats';

export async function fetchConversations(params?: {
  agentId?: 'stats';
  page?: number;
  pageSize?: number;
}): Promise<ConversationListResponse> {
  const { data } = await apiClient.get<ConversationListResponse>('/conversations', { params });
  return data;
}

export async function fetchConversation(conversationId: string): Promise<ConversationDetail> {
  const { data } = await apiClient.get<ConversationDetail>(`/conversations/${conversationId}`);
  return data;
}

export async function createConversation(
  payload: CreateConversationRequest,
): Promise<ConversationDetail> {
  const { data } = await apiClient.post<ConversationDetail>('/conversations', payload);
  return data;
}

export async function sendMessage(
  conversationId: string,
  content: string,
): Promise<SendMessageResponse> {
  const { data } = await apiClient.post<SendMessageResponse>(
    `/conversations/${conversationId}/messages`,
    { content },
    { timeout: 35000 },
  );
  return data;
}
