import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import AppLayout from '@/components/layout/AppLayout.vue';

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

export default router;
