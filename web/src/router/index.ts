import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import AppLayout from '@/components/layout/AppLayout.vue';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/views/HomeView.vue'),
      },
      {
        path: 'feed/:feedId',
        name: 'feed-detail',
        component: () => import('@/views/FeedDetailView.vue'),
      },
      {
        path: 'stats',
        name: 'stats-start',
        meta: { requiresAuth: true },
        component: () => import('@/views/StatsStartView.vue'),
      },
      {
        path: 'scout',
        name: 'scout-start',
        meta: { requiresAuth: true },
        component: () => import('@/views/ScoutStartView.vue'),
      },
      {
        path: 'tactical',
        name: 'tactical-start',
        meta: { requiresAuth: true },
        component: () => import('@/views/TacticalStartView.vue'),
      },
      {
        path: 'matches/:matchId',
        name: 'match-detail',
        meta: { requiresAuth: true },
        component: () => import('@/views/MatchDetailView.vue'),
      },
      {
        path: 'conversations/:conversationId',
        name: 'conversation',
        meta: { requiresAuth: true },
        component: () => import('@/views/ConversationView.vue'),
      },
      {
        path: 'login',
        name: 'login',
        component: () => import('@/views/LoginView.vue'),
      },
      {
        path: 'register',
        name: 'register',
        component: () => import('@/views/RegisterView.vue'),
      },
      {
        path: 'settings/preferences',
        name: 'preferences',
        component: () => import('@/views/PreferencesView.vue'),
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  if (!to.meta.requiresAuth) return true;
  const authStore = useAuthStore();
  if (authStore.isAuthenticated) return true;
  return {
    path: '/login',
    query: { redirect: to.fullPath },
  };
});

export default router;
