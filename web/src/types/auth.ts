export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
  role: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface UserPreference {
  followedTeams: string[];
  followedLeagues: string[];
  enabledAgents: string[];
  notifyMatchReport?: boolean;
}
