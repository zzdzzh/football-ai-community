import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as authApi from '@/api/auth';
import type { AuthUser } from '@/types/auth';

const TOKEN_KEY = 'auth_token';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) || '');
  const user = ref<AuthUser | null>(null);
  const isAuthenticated = computed(() => Boolean(token.value));

  function setSession(newToken: string, newUser: AuthUser) {
    token.value = newToken;
    user.value = newUser;
    localStorage.setItem(TOKEN_KEY, newToken);
  }

  function logout() {
    token.value = '';
    user.value = null;
    localStorage.removeItem(TOKEN_KEY);
  }

  async function login(email: string, password: string) {
    const result = await authApi.login(email, password);
    setSession(result.token, result.user);
    return result;
  }

  async function register(email: string, password: string, nickname: string) {
    const result = await authApi.register(email, password, nickname);
    setSession(result.token, result.user);
    return result;
  }

  async function fetchMe() {
    if (!token.value) return null;
    const currentUser = await authApi.fetchCurrentUser();
    user.value = currentUser;
    return currentUser;
  }

  async function initialize() {
    if (!token.value) return;
    try {
      await fetchMe();
    } catch {
      logout();
    }
  }

  return {
    token,
    user,
    isAuthenticated,
    login,
    register,
    logout,
    fetchMe,
    initialize,
    setSession,
  };
});
