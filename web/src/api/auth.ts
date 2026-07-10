import apiClient from './client';
import type { AuthResponse, AuthUser, UserPreference } from '@/types/auth';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

export async function register(
  email: string,
  password: string,
  nickname: string,
): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', {
    email,
    password,
    nickname,
  });
  return data;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const { data } = await apiClient.get<AuthUser>('/auth/me');
  return data;
}

export async function fetchPreferences(): Promise<UserPreference> {
  const { data } = await apiClient.get<UserPreference>('/users/me/preferences');
  return data;
}

export async function updatePreferences(payload: UserPreference): Promise<UserPreference> {
  const { data } = await apiClient.put<UserPreference>('/users/me/preferences', payload);
  return data;
}
