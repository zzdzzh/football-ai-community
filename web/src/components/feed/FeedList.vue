<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { fetchFeedList } from '@/api/feed';
import type { FeedItem } from '@/types/feed';
import FeedCard from './FeedCard.vue';
import SourceStatusBanner from './SourceStatusBanner.vue';

const items = ref<FeedItem[]>([]);
const warnings = ref<string[]>([]);
const loading = ref(true);
const error = ref('');

async function loadFeed() {
  loading.value = true;
  error.value = '';
  try {
    const data = await fetchFeedList({ page: 1, pageSize: 20 });
    items.value = data.items;
    warnings.value = data.warnings ?? [];
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

    <el-empty v-else-if="items.length === 0" description="暂无动态，请稍后刷新" />

    <div v-else class="feed-list__items">
      <FeedCard v-for="item in items" :key="item.id" :item="item" />
    </div>
  </section>
</template>

<style scoped>
.feed-list__items {
  display: flex;
  flex-direction: column;
}
</style>
