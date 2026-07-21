<script setup lang="ts">
import { computed } from 'vue';
import type { FeedItem } from '@/types/feed';

const props = defineProps<{
  item: FeedItem;
}>();

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN');
}

const isFanDiscussion = computed(() => props.item.type === 'fan_discussion');
const isMatchReport = computed(
  () => props.item.type === 'match_report' || props.item.type === 'brief_report',
);

const detailLink = computed(() => {
  if (isMatchReport.value && props.item.matchId) {
    return `/matches/${props.item.matchId}`;
  }
  if (isFanDiscussion.value && props.item.body?.discussionId) {
    return `/discussions/${props.item.body.discussionId}`;
  }
  return `/feed/${props.item.id}`;
});

const detailLabel = computed(() => {
  if (isMatchReport.value) return '查看战报';
  if (isFanDiscussion.value) return '进入讨论';
  return '查看详情';
});

const typeTag = computed(() => {
  if (props.item.type === 'brief_report') return '简要战报';
  if (props.item.type === 'match_report') return '赛后战报';
  if (isFanDiscussion.value) return '球迷讨论';
  return null;
});
</script>

<template>
  <el-card class="feed-card" shadow="hover">
    <div class="feed-card__meta">
      <div class="feed-card__tags">
        <el-tag size="small" :type="isFanDiscussion ? 'warning' : isMatchReport ? 'danger' : 'success'">
          {{ item.agentDisplayName || item.agentId }}
        </el-tag>
        <el-tag v-if="typeTag" size="small" type="info">{{ typeTag }}</el-tag>
      </div>
      <span class="feed-card__time">{{ formatTime(item.publishedAt) }}</span>
    </div>
    <h3 class="feed-card__title">{{ item.title }}</h3>
    <p v-if="item.summary" class="feed-card__summary">{{ item.summary }}</p>
    <div class="feed-card__actions">
      <el-button type="primary" link tag="router-link" :to="detailLink">
        {{ detailLabel }}
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

.feed-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
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
