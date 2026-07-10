<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import type { Message } from '@/types/stats';
import MetricCitation from './MetricCitation.vue';

const props = defineProps<{
  messages: Message[];
  loading?: boolean;
}>();

const listRef = ref<HTMLElement | null>(null);

const confidenceLabels: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

function scrollToBottom() {
  nextTick(() => {
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight;
    }
  });
}

watch(
  () => [props.messages.length, props.loading],
  () => scrollToBottom(),
  { immediate: true },
);
</script>

<template>
  <div ref="listRef" class="message-list">
    <div v-if="messages.length === 0 && !loading" class="empty-hint">
      发送第一个问题，Stats Agent 将基于比赛/球队数据为你解读。
    </div>

    <article
      v-for="msg in messages"
      :key="msg.id"
      class="message-item"
      :class="msg.role"
    >
      <header class="message-header">
        <span class="message-role">{{ msg.role === 'user' ? '你' : 'Stats Agent' }}</span>
        <span v-if="msg.confidence" class="confidence-tag">
          置信度：{{ confidenceLabels[msg.confidence] ?? msg.confidence }}
        </span>
      </header>
      <p class="message-content">{{ msg.content }}</p>
      <MetricCitation v-if="msg.role === 'assistant' && msg.metrics?.length" :metrics="msg.metrics" />
      <ul v-if="msg.missingFields?.length" class="missing-fields">
        <li v-for="field in msg.missingFields" :key="field">缺失数据：{{ field }}</li>
      </ul>
    </article>

    <div v-if="loading" class="loading-row">
      <span>Stats Agent 正在分析…</span>
    </div>
  </div>
</template>

<style scoped>
.message-list {
  flex: 1;
  min-height: 280px;
  max-height: min(60vh, 520px);
  overflow-y: auto;
  padding: 1rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.empty-hint {
  color: var(--color-text-muted);
  text-align: center;
  padding: 2rem 1rem;
}

.message-item {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.message-item.user {
  border-left: 3px solid var(--color-primary);
}

.message-item.assistant {
  border-left: 3px solid var(--color-accent);
}

.message-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.message-role {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.confidence-tag {
  font-size: 0.75rem;
  color: var(--color-primary-dark);
  background: rgba(26, 127, 55, 0.1);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  white-space: nowrap;
}

.message-content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.missing-fields {
  margin: 0.75rem 0 0;
  padding-left: 1.2rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.loading-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text-muted);
  padding: 0.5rem;
}
</style>
