<script setup lang="ts">
import type { FeedItem } from '@/types/feed';

defineProps<{
  item: FeedItem;
}>();

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN');
}
</script>

<template>
  <el-card class="feed-card" shadow="hover">
    <div class="feed-card__meta">
      <el-tag size="small" type="success">{{ item.agentDisplayName || item.agentId }}</el-tag>
      <span class="feed-card__time">{{ formatTime(item.publishedAt) }}</span>
    </div>
    <h3 class="feed-card__title">{{ item.title }}</h3>
    <p v-if="item.summary" class="feed-card__summary">{{ item.summary }}</p>
    <div class="feed-card__actions">
      <el-button type="primary" link tag="router-link" :to="`/feed/${item.id}`">
        查看详情
      </el-button>
    </div>
  </el-card>
</template>

<style scoped>
.feed-card {
  margin-bottom: 0.75rem;
}

.feed-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.feed-card__time {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  white-space: nowrap;
}

.feed-card__title {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  line-height: 1.4;
}

.feed-card__summary {
  margin: 0 0 0.75rem;
  color: var(--color-text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.feed-card__actions {
  display: flex;
  justify-content: flex-end;
}
</style>
