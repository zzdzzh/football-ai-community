import apiClient from './client';

export type IdentityLinkState = 'linked' | 'unlinked' | 'pending_confirmation';

export interface PlayerIdentityLink {
  id: string;
  statsPlayerId: string;
  careerPlayerId: string;
  matchBasis: 'transfermarkt_id';
  matchKey: string;
  confidence: 'high' | 'medium' | 'low';
  status: 'active' | 'conflict_shelved' | 'invalid';
  createdAt: string;
  updatedAt: string;
}

export interface PlayerIdentityLinkStatusItem {
  careerPlayerId: string;
  linkState: IdentityLinkState;
  link?: PlayerIdentityLink | null;
  statsPlayerId?: string | null;
  statsEntryPath?: string | null;
}

export interface PlayerIdentityLinkBatchResponse {
  items: PlayerIdentityLinkStatusItem[];
}

export interface AlignPlayerIdentityResult {
  runId: string;
  created: number;
  conflict: number;
  skipped: number;
  finishedAt: string;
  notes?: string | null;
}

export async function fetchPlayerIdentityLinks(
  careerPlayerIds: string[],
): Promise<PlayerIdentityLinkBatchResponse> {
  const { data } = await apiClient.get<PlayerIdentityLinkBatchResponse>('/player-identity-links', {
    params: { careerPlayerIds: careerPlayerIds.join(',') },
  });
  return data;
}

export async function resolvePlayerIdentityLink(params: {
  statsPlayerId?: string;
  careerPlayerId?: string;
}): Promise<PlayerIdentityLink> {
  const { data } = await apiClient.get<PlayerIdentityLink>('/player-identity-links/resolve', {
    params,
  });
  return data;
}

export async function alignPlayerIdentityLinks(body?: {
  statsPlayerId?: string;
  careerPlayerId?: string;
}): Promise<AlignPlayerIdentityResult> {
  const { data } = await apiClient.post<AlignPlayerIdentityResult>(
    '/player-identity-links/align',
    body ?? {},
  );
  return data;
}
