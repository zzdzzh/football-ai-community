<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchFeedList } from '@/api/feed';
import type { FeedItem } from '@/types/feed';
import FeedCard from './FeedCard.vue';
import SourceStatusBanner from './SourceStatusBanner.vue';

type FeedCategory = 'news' | 'report' | 'community';

const CATEGORIES: { key: FeedCategory; label: string }[] = [
  { key: 'news', label: '新闻' },
  { key: 'report', label: '战报' },
  { key: 'community', label: '社区动态' },
];

const route = useRoute();
const router = useRouter();

const newsItems = ref<FeedItem[]>([]);
const reportItems = ref<FeedItem[]>([]);
const communityItems = ref<FeedItem[]>([]);
const warnings = ref<string[]>([]);
const loading = ref(true);
const error = ref('');

const activeCategory = ref<FeedCategory>('news');

const isEmpty = computed(
  () =>
    newsItems.value.length === 0
    && reportItems.value.length === 0
    && communityItems.value.length === 0,
);

const categoryCounts = computed(() => ({
  news: newsItems.value.length,
  report: reportItems.value.length,
  community: communityItems.value.length,
}));

const activeItems = computed(() => {
  if (activeCategory.value === 'report') return reportItems.value;
  if (activeCategory.value === 'community') return communityItems.value;
  return newsItems.value;
});

const activeEmptyText = computed(() => {
  if (activeCategory.value === 'report') return '暂无赛后战报';
  if (activeCategory.value === 'community') return '暂无社区动态';
  return '暂无新闻摘要';
});

function parseCategory(value: unknown): FeedCategory | null {
  if (value === 'news' || value === 'report' || value === 'community') return value;
  return null;
}

function syncCategoryFromRoute() {
  const fromQuery = parseCategory(route.query.tab);
  if (fromQuery) {
    activeCategory.value = fromQuery;
    return;
  }
  activeCategory.value = 'news';
}

function selectCategory(key: FeedCategory) {
  if (activeCategory.value === key) return;
  activeCategory.value = key;
  router.replace({
    path: route.path,
    query: { ...route.query, tab: key },
  });
}

async function loadFeed() {
  loading.value = true;
  error.value = '';
  try {
    const [news, reports, community] = await Promise.all([
      fetchFeedList({ page: 1, pageSize: 15, agentId: 'news' }),
      fetchFeedList({ page: 1, pageSize: 10, agentId: 'content' }),
      fetchFeedList({ page: 1, pageSize: 5, agentId: 'fan' }),
    ]);
    newsItems.value = news.items;
    reportItems.value = reports.items;
    communityItems.value = community.items;
    warnings.value = [
      ...new Set([
        ...(news.warnings ?? []),
        ...(reports.warnings ?? []),
        ...(community.warnings ?? []),
      ]),
    ];
  } catch {
    error.value = '加载动态失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

watch(
  () => route.query.tab,
  () => {
    syncCategoryFromRoute();
  },
);

onMounted(() => {
  syncCategoryFromRoute();
  if (!parseCategory(route.query.tab)) {
    router.replace({
      path: route.path,
      query: { ...route.query, tab: 'news' },
    });
  }
  loadFeed();
});

defineExpose({ reload: loadFeed });
</script>

<template>
  <section class="feed-list">
    <SourceStatusBanner :warnings="warnings" />

    <nav class="feed-tabs" aria-label="内容分类">
      <button
        v-for="cat in CATEGORIES"
        :key="cat.key"
        type="button"
        class="feed-tabs__item"
        :class="{ active: activeCategory === cat.key }"
        @click="selectCategory(cat.key)"
      >
        <span>{{ cat.label }}</span>
        <span v-if="!loading" class="feed-tabs__count">{{ categoryCounts[cat.key] }}</span>
      </button>
    </nav>

    <el-skeleton v-if="loading" :rows="4" animated />

    <el-alert v-else-if="error" type="error" :title="error" show-icon :closable="false" />

    <el-empty v-else-if="isEmpty" description="暂无动态，请稍后刷新" />

    <el-empty v-else-if="activeItems.length === 0" :description="activeEmptyText" />

    <div v-else class="feed-list__items">
      <FeedCard v-for="item in activeItems" :key="item.id" :item="item" />
    </div>
  </section>
</template>

<style scoped>
.feed-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.feed-tabs {
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  position: sticky;
  top: var(--header-height);
  z-index: 5;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.feed-tabs::-webkit-scrollbar {
  display: none;
}

.feed-tabs__item {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  padding: 0.55rem 0.75rem;
  border-radius: calc(var(--radius-md) - 2px);
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease;
}

.feed-tabs__item:hover {
  color: var(--color-text);
  background: rgba(26, 127, 55, 0.06);
}

.feed-tabs__item.active {
  color: var(--color-primary-dark);
  background: rgba(26, 127, 55, 0.12);
  font-weight: 600;
}

.feed-tabs__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.06);
  color: inherit;
}

.feed-tabs__item.active .feed-tabs__count {
  background: rgba(26, 127, 55, 0.18);
}

.feed-list__items {
  display: flex;
  flex-direction: column;
}

@media (max-width: 480px) {
  .feed-tabs__item {
    padding: 0.5rem 0.55rem;
    font-size: 0.9rem;
  }
}
</style>
