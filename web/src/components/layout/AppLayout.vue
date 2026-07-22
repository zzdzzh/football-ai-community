<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const mobileMenuOpen = ref(false);

const baseNavItems = [
  { label: '首页', path: '/' },
  { label: '数据解读', path: '/stats' },
  { label: '我的对话', path: '/conversations' },
  { label: '球迷对话', path: '/fan' },
  { label: '球员推荐', path: '/scout' },
  { label: '战术分析', path: '/tactical' },
  { label: '球员关系', path: '/relationships' },
  { label: '偏好设置', path: '/settings/preferences' },
];

const navItems = computed(() => {
  const items = [...baseNavItems];
  if (authStore.isAuthenticated && ['moderator', 'admin'].includes(authStore.user?.role ?? '')) {
    items.push({ label: '举报审核', path: '/admin/reports' });
  }
  if (authStore.isAuthenticated) {
    return items;
  }
  return [
    ...items,
    { label: '登录', path: '/login' },
    { label: '注册', path: '/register' },
  ];
});

const activePath = computed(() => route.path);

function isNavActive(path: string) {
  return (
    activePath.value === path
    || (path === '/fan'
      && (activePath.value === '/fan' || activePath.value.startsWith('/discussions/')))
    || (path === '/admin/reports' && activePath.value.startsWith('/admin/reports'))
    || (path === '/stats' && activePath.value.startsWith('/stats'))
    || (path === '/conversations'
      && (activePath.value === '/conversations' || activePath.value.startsWith('/conversations/')))
    || (path === '/scout'
      && (activePath.value.startsWith('/scout')
        || (activePath.value.startsWith('/conversations/') && route.query.from === 'scout')))
    || (path === '/tactical'
      && (activePath.value.startsWith('/tactical')
        || activePath.value.startsWith('/matches/')
        || (activePath.value.startsWith('/conversations/') && route.query.from === 'tactical')))
    || (path === '/relationships' && activePath.value.startsWith('/relationships'))
  );
}

function navigate(path: string) {
  const authPaths = ['/settings/preferences', '/stats', '/conversations', '/scout', '/tactical', '/fan', '/relationships', '/admin/reports'];
  if (authPaths.includes(path) && !authStore.isAuthenticated) {
    mobileMenuOpen.value = false;
    router.push({ path: '/login', query: { redirect: path } });
    return;
  }
  if (path === '/admin/reports' && !['moderator', 'admin'].includes(authStore.user?.role ?? '')) {
    mobileMenuOpen.value = false;
    router.push('/');
    return;
  }
  mobileMenuOpen.value = false;
  router.push(path);
}

function handleLogout() {
  authStore.logout();
  mobileMenuOpen.value = false;
  router.push('/');
}

watch(
  () => route.fullPath,
  () => {
    mobileMenuOpen.value = false;
  },
);

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
          <nav class="main-nav desktop-nav" aria-label="主导航">
            <button
              v-for="item in navItems"
              :key="item.path"
              type="button"
              class="nav-link"
              :class="{ active: isNavActive(item.path) }"
              @click="navigate(item.path)"
            >
              {{ item.label }}
            </button>
          </nav>

          <div v-if="authStore.isAuthenticated" class="user-panel desktop-only">
            <span class="user-name">{{ authStore.user?.nickname }}</span>
            <el-button size="small" text @click="handleLogout">退出</el-button>
          </div>

          <button
            type="button"
            class="menu-toggle"
            :aria-expanded="mobileMenuOpen"
            aria-label="打开菜单"
            @click="mobileMenuOpen = true"
          >
            <span class="menu-toggle__bar" />
            <span class="menu-toggle__bar" />
            <span class="menu-toggle__bar" />
          </button>
        </div>
      </div>
    </header>

    <el-drawer
      v-model="mobileMenuOpen"
      direction="rtl"
      size="280px"
      :with-header="false"
      class="mobile-nav-drawer"
    >
      <div class="mobile-drawer">
        <div class="mobile-drawer__header">
          <span class="mobile-drawer__title">菜单</span>
          <el-button text @click="mobileMenuOpen = false">关闭</el-button>
        </div>

        <div v-if="authStore.isAuthenticated" class="mobile-drawer__user">
          <span class="user-name">{{ authStore.user?.nickname }}</span>
        </div>

        <nav class="mobile-nav" aria-label="移动端导航">
          <button
            v-for="item in navItems"
            :key="item.path"
            type="button"
            class="mobile-nav__link"
            :class="{ active: isNavActive(item.path) }"
            @click="navigate(item.path)"
          >
            {{ item.label }}
          </button>
        </nav>

        <div v-if="authStore.isAuthenticated" class="mobile-drawer__footer">
          <el-button type="danger" plain @click="handleLogout">退出登录</el-button>
        </div>
      </div>
    </el-drawer>

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
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height);
  padding-top: 0;
  padding-bottom: 0;
  gap: 0.75rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
  min-width: 0;
}

.brand-icon {
  font-size: 1.25rem;
}

.brand-name {
  font-size: 1.05rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.main-nav {
  display: none;
  gap: 0.25rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.nav-link {
  border: none;
  background: transparent;
  color: var(--color-header-text);
  padding: 0.35rem 0.6rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.9rem;
  white-space: nowrap;
}

.nav-link:hover,
.nav-link.active {
  background: rgba(255, 255, 255, 0.15);
}

.user-panel {
  display: none;
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

.menu-toggle {
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  width: 40px;
  height: 40px;
  padding: 8px;
  border: none;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.08);
  cursor: pointer;
}

.menu-toggle:hover {
  background: rgba(255, 255, 255, 0.16);
}

.menu-toggle__bar {
  display: block;
  width: 100%;
  height: 2px;
  background: var(--color-header-text);
  border-radius: 1px;
}

.mobile-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 0.75rem;
}

.mobile-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mobile-drawer__title {
  font-size: 1.05rem;
  font-weight: 600;
}

.mobile-drawer__user {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

.mobile-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  overflow-y: auto;
}

.mobile-nav__link {
  border: none;
  background: transparent;
  text-align: left;
  padding: 0.75rem 0.85rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 1rem;
  color: var(--color-text);
}

.mobile-nav__link:hover,
.mobile-nav__link.active {
  background: rgba(26, 127, 55, 0.1);
  color: var(--color-primary-dark);
  font-weight: 600;
}

.mobile-drawer__footer {
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
}

.app-main {
  flex: 1;
  padding: 1rem 0;
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

@media (min-width: 960px) {
  .main-nav {
    display: flex;
  }

  .user-panel.desktop-only {
    display: flex;
  }

  .menu-toggle {
    display: none;
  }

  .app-main {
    padding: 1.5rem 0;
  }

  .brand-name {
    font-size: 1.1rem;
  }

  .nav-link {
    padding: 0.4rem 0.75rem;
    font-size: 0.95rem;
  }
}

@media (max-width: 380px) {
  .brand-name {
    font-size: 0.95rem;
  }
}
</style>
