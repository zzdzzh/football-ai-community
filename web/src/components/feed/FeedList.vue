<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchFeedList } from '@/api/feed';
import type { FeedItem } from '@/types/feed';
import FeedCard from './FeedCard.vue';
import SourceStatusBanner from './SourceStatusBanner.vue';
import ListPagination from '@/components/common/ListPagination.vue';

type FeedCategory = 'news' | 'report' | 'community';

const CATEGORIES: { key: FeedCategory; label: string; agentId: string }[] = [
  { key: 'news', label: '新闻', agentId: 'news' },
  { key: 'report', label: '战报', agentId: 'content' },
  { key: 'community', label: '社区动态', agentId: 'fan' },
];

const PAGE_SIZE = 10;

const route = useRoute();
const router = useRouter();

const items = ref<FeedItem[]>([]);
const warnings = ref<string[]>([]);
const loading = ref(true);
const error = ref('');
const page = ref(1);
const total = ref(0);
const categoryTotals = ref<Record<FeedCategory, number>>({
  news: 0,
  report: 0,
  community: 0,
});

const activeCategory = ref<FeedCategory>('news');

const activeMeta = computed(
  () => CATEGORIES.find((cat) => cat.key === activeCategory.value) ?? CATEGORIES[0],
);

const isEmpty = computed(() => !loading.value && total.value === 0 && !error.value);

const activeEmptyText = computed(() => {
  if (activeCategory.value === 'report') return '暂无赛后战报';
  if (activeCategory.value === 'community') return '暂无社区动态';
  return '暂无新闻摘要';
});

function parseCategory(value: unknown): FeedCategory | null {
  if (value === 'news' || value === 'report' || value === 'community') return value;
  return null;
}

function parsePage(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function syncFromRoute() {
  const fromQuery = parseCategory(route.query.tab);
  activeCategory.value = fromQuery ?? 'news';
  page.value = parsePage(route.query.page);
}

function replaceQuery(next: { tab?: FeedCategory; page?: number }) {
  const tab = next.tab ?? activeCategory.value;
  const nextPage = next.page ?? page.value;
  router.replace({
    path: route.path,
    query: {
      ...route.query,
      tab,
      page: String(nextPage),
    },
  });
}

function selectCategory(key: FeedCategory) {
  if (activeCategory.value === key) return;
  activeCategory.value = key;
  page.value = 1;
  replaceQuery({ tab: key, page: 1 });
}

function onPageChange(nextPage: number) {
  if (nextPage === page.value) return;
  page.value = nextPage;
  replaceQuery({ page: nextPage });
}

async function refreshCategoryTotals() {
  try {
    const results = await Promise.all(
      CATEGORIES.map((cat) => fetchFeedList({ page: 1, pageSize: 1, agentId: cat.agentId })),
    );
    const next = { ...categoryTotals.value };
    CATEGORIES.forEach((cat, index) => {
      next[cat.key] = results[index].total;
    });
    categoryTotals.value = next;
    const mergedWarnings = results.flatMap((result) => result.warnings ?? []);
    if (mergedWarnings.length > 0) {
      warnings.value = [...new Set([...(warnings.value ?? []), ...mergedWarnings])];
    }
  } catch {
    // 角标失败不影响主列表
  }
}

async function loadFeed() {
  loading.value = true;
  error.value = '';
  try {
    const result = await fetchFeedList({
      page: page.value,
      pageSize: PAGE_SIZE,
      agentId: activeMeta.value.agentId,
    });
    items.value = result.items;
    total.value = result.total;
    categoryTotals.value = {
      ...categoryTotals.value,
      [activeCategory.value]: result.total,
    };
    warnings.value = [...new Set([...(result.warnings ?? [])])];

    // 当前页超出总页数时回退到最后一页
    const maxPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE) || 1);
    if (page.value > maxPage) {
      page.value = maxPage;
      replaceQuery({ page: maxPage });
      return;
    }
  } catch {
    error.value = '加载动态失败，请稍后重试';
    items.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

watch(
  () => [route.query.tab, route.query.page],
  () => {
    syncFromRoute();
    loadFeed();
  },
);

onMounted(async () => {
  syncFromRoute();
  const needReplace = !parseCategory(route.query.tab) || route.query.page == null;
  if (needReplace) {
    replaceQuery({
      tab: activeCategory.value,
      page: page.value,
    });
  } else {
    await loadFeed();
  }
  await refreshCategoryTotals();
});

defineExpose({ reload: async () => {
  await Promise.all([loadFeed(), refreshCategoryTotals()]);
} });
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
        <span v-if="!loading || categoryTotals[cat.key] > 0" class="feed-tabs__count">
          {{ categoryTotals[cat.key] }}
        </span>
      </button>
    </nav>

    <el-skeleton v-if="loading" :rows="4" animated />

    <el-alert v-else-if="error" type="error" :title="error" show-icon :closable="false" />

    <el-empty v-else-if="isEmpty" :description="activeEmptyText" />

    <template v-else>
      <div class="feed-list__items">
        <FeedCard v-for="item in items" :key="item.id" :item="item" />
      </div>
      <ListPagination
        :page="page"
        :page-size="PAGE_SIZE"
        :total="total"
        @update:page="onPageChange"
      />
    </template>
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
