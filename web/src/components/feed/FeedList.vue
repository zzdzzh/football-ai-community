<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchFeedList } from '@/api/feed';
import type { FeedItem } from '@/types/feed';
import FeedCard from './FeedCard.vue';
import SourceStatusBanner from './SourceStatusBanner.vue';

const newsItems = ref<FeedItem[]>([]);
const reportItems = ref<FeedItem[]>([]);
const communityItems = ref<FeedItem[]>([]);
const warnings = ref<string[]>([]);
const loading = ref(true);
const error = ref('');

const isEmpty = computed(
  () =>
    newsItems.value.length === 0
    && reportItems.value.length === 0
    && communityItems.value.length === 0,
);

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

onMounted(loadFeed);

defineExpose({ reload: loadFeed });
</script>

<template>
  <section class="feed-list">
    <SourceStatusBanner :warnings="warnings" />

    <el-skeleton v-if="loading" :rows="4" animated />

    <el-alert v-else-if="error" type="error" :title="error" show-icon :closable="false" />

    <el-empty v-else-if="isEmpty" description="暂无动态，请稍后刷新" />

    <template v-else>
      <section v-if="newsItems.length > 0" class="feed-section">
        <h2 class="feed-section__title">新闻摘要</h2>
        <div class="feed-list__items">
          <FeedCard v-for="item in newsItems" :key="item.id" :item="item" />
        </div>
      </section>

      <section v-if="reportItems.length > 0" class="feed-section">
        <h2 class="feed-section__title">赛后战报</h2>
        <div class="feed-list__items">
          <FeedCard v-for="item in reportItems" :key="item.id" :item="item" />
        </div>
      </section>

      <section v-if="communityItems.length > 0" class="feed-section">
        <h2 class="feed-section__title">社区动态</h2>
        <div class="feed-list__items">
          <FeedCard v-for="item in communityItems" :key="item.id" :item="item" />
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.feed-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.feed-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.feed-section__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text);
}

.feed-list__items {
  display: flex;
  flex-direction: column;
}
</style>
