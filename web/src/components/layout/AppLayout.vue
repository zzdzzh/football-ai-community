<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const baseNavItems = [
  { label: '首页', path: '/' },
  { label: '数据问答', path: '/stats' },
  { label: '球员推荐', path: '/scout' },
  { label: '战术分析', path: '/tactical' },
  { label: '偏好设置', path: '/settings/preferences' },
];

const navItems = computed(() => {
  if (authStore.isAuthenticated) {
    return baseNavItems;
  }
  return [
    ...baseNavItems,
    { label: '登录', path: '/login' },
    { label: '注册', path: '/register' },
  ];
});

const activePath = computed(() => route.path);

function navigate(path: string) {
  const authPaths = ['/settings/preferences', '/stats', '/scout', '/tactical'];
  if (authPaths.includes(path) && !authStore.isAuthenticated) {
    router.push({ path: '/login', query: { redirect: path } });
    return;
  }
  router.push(path);
}

function handleLogout() {
  authStore.logout();
  router.push('/');
}

onMounted(() => {
  authStore.initialize();
});
</script>

<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="header-inner page-container">
        <div class="brand" @click="navigate('/')">
          <span class="brand-icon">⚽</span>
          <span class="brand-name">足球 AI 社区</span>
        </div>

        <div class="header-actions">
          <nav class="main-nav">
            <button
              v-for="item in navItems"
              :key="item.path"
              type="button"
              class="nav-link"
              :class="{
                active:
                  activePath === item.path
                  || (item.path === '/stats'
                    && activePath.startsWith('/conversations/')
                    && route.query.from !== 'scout'
                    && route.query.from !== 'tactical')
                  || (item.path === '/scout'
                    && activePath.startsWith('/conversations/')
                    && route.query.from === 'scout')
                  || (item.path === '/tactical'
                    && (activePath.startsWith('/tactical')
                      || activePath.startsWith('/matches/')
                      || (activePath.startsWith('/conversations/')
                        && route.query.from === 'tactical'))),
              }"
              @click="navigate(item.path)"
            >
              {{ item.label }}
            </button>
          </nav>

          <div v-if="authStore.isAuthenticated" class="user-panel">
            <span class="user-name">{{ authStore.user?.nickname }}</span>
            <el-button size="small" text @click="handleLogout">退出</el-button>
          </div>
        </div>
      </div>
    </header>

    <main class="app-main">
      <div class="page-container">
        <router-view />
      </div>
    </main>

    <footer class="app-footer">
      <div class="page-container footer-inner">
        <span>足球 Multi-Agent 社区 · MVP-2</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  height: var(--header-height);
  background: var(--color-header-bg);
  color: var(--color-header-text);
  box-shadow: var(--shadow-sm);
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height);
  padding-top: 0;
  padding-bottom: 0;
  gap: 1rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
}

.brand-icon {
  font-size: 1.25rem;
}

.brand-name {
  font-size: 1.1rem;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.main-nav {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.nav-link {
  border: none;
  background: transparent;
  color: var(--color-header-text);
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.95rem;
  white-space: nowrap;
}

.nav-link:hover,
.nav-link.active {
  background: rgba(255, 255, 255, 0.15);
}

.user-panel {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.user-name {
  font-size: 0.9rem;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-main {
  flex: 1;
  padding: 1.5rem 0;
}

.app-footer {
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.footer-inner {
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
}
</style>
