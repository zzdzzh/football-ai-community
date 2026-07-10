import apiClient from './client';
import type {
  ConversationDetail,
  ConversationListResponse,
  CreateConversationRequest,
  SendMessageResponse,
} from '@/types/stats';
import type { MessageFeedbackResponse, CreateScoutConversationRequest } from '@/types/scout';
import type { CreateTacticalConversationRequest } from '@/types/tactical';

export async function fetchConversations(params?: {
  agentId?: 'stats' | 'scout' | 'tactical';
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

export async function submitMessageFeedback(
  conversationId: string,
  messageId: string,
  helpful: boolean,
): Promise<MessageFeedbackResponse> {
  const { data } = await apiClient.post<MessageFeedbackResponse>(
    `/conversations/${conversationId}/messages/${messageId}/feedback`,
    { helpful },
  );
  return data;
}

export async function createScoutConversation(
  payload: CreateScoutConversationRequest,
): Promise<ConversationDetail> {
  return createConversation(payload);
}

export async function createTacticalConversation(
  payload: CreateTacticalConversationRequest,
): Promise<ConversationDetail> {
  return createConversation(payload);
}
