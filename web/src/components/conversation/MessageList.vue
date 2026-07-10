<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { Message, AgentId } from '@/types/stats';
import { submitMessageFeedback } from '@/api/conversations';
import MetricCitation from './MetricCitation.vue';
import PlayerRecommendationCard from '@/components/scout/PlayerRecommendationCard.vue';
import TacticalPhasePanel from '@/components/tactical/TacticalPhasePanel.vue';

const props = defineProps<{
  messages: Message[];
  loading?: boolean;
  agentId?: AgentId;
  conversationId?: string;
}>();

const listRef = ref<HTMLElement | null>(null);
const feedbackSubmitted = ref<Record<string, boolean>>({});

const confidenceLabels: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

const agentLabel = computed(() => {
  if (props.agentId === 'scout') return 'Scout Agent';
  if (props.agentId === 'tactical') return 'Tactical Agent';
  return 'Stats Agent';
});

function scrollToBottom() {
  nextTick(() => {
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight;
    }
  });
}

async function handleFeedback(messageId: string, helpful: boolean) {
  if (!props.conversationId || feedbackSubmitted.value[messageId]) return;
  try {
    await submitMessageFeedback(props.conversationId, messageId, helpful);
    feedbackSubmitted.value[messageId] = true;
    ElMessage.success('感谢反馈');
  } catch {
    ElMessage.error('提交反馈失败');
  }
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
      <template v-if="agentId === 'scout'">
        描述你的球员需求，Scout Agent 将返回推荐卡片与关键数据。
      </template>
      <template v-else-if="agentId === 'tactical'">
        描述战术问题，Tactical Agent 将返回阵型与战术阶段分析。
      </template>
      <template v-else>
        发送第一个问题，Stats Agent 将基于比赛/球队数据为你解读。
      </template>
    </div>

    <article
      v-for="msg in messages"
      :key="msg.id"
      class="message-item"
      :class="msg.role"
    >
      <header class="message-header">
        <span class="message-role">{{ msg.role === 'user' ? '你' : agentLabel }}</span>
        <span v-if="msg.confidence" class="confidence-tag">
          置信度：{{ confidenceLabels[msg.confidence] ?? msg.confidence }}
        </span>
      </header>
      <p class="message-content">{{ msg.content }}</p>

      <el-alert
        v-if="msg.role === 'assistant' && msg.narrowHint"
        :title="msg.narrowHint"
        type="info"
        show-icon
        :closable="false"
        class="narrow-hint"
      />

      <div
        v-if="msg.role === 'assistant' && msg.recommendations?.length"
        class="recommendations-grid"
      >
        <PlayerRecommendationCard
          v-for="rec in msg.recommendations"
          :key="rec.playerId"
          :recommendation="rec"
        />
      </div>

      <TacticalPhasePanel
        v-if="msg.role === 'assistant' && msg.tacticalAnalysis"
        :analysis="msg.tacticalAnalysis"
      />

      <MetricCitation
        v-if="msg.role === 'assistant' && msg.metrics?.length && agentId === 'stats'"
        :metrics="msg.metrics"
      />

      <ul v-if="msg.missingFields?.length" class="missing-fields">
        <li v-for="field in msg.missingFields" :key="field">缺失数据：{{ field }}</li>
      </ul>

      <div
        v-if="(agentId === 'scout' || agentId === 'tactical') && msg.role === 'assistant' && conversationId"
        class="feedback-row"
      >
        <span class="feedback-label">
          {{ agentId === 'scout' ? '这条推荐有帮助吗？' : '这条分析有帮助吗？' }}
        </span>
        <el-button
          size="small"
          :disabled="feedbackSubmitted[msg.id]"
          @click="handleFeedback(msg.id, true)"
        >
          有帮助
        </el-button>
        <el-button
          size="small"
          :disabled="feedbackSubmitted[msg.id]"
          @click="handleFeedback(msg.id, false)"
        >
          无帮助
        </el-button>
      </div>
    </article>

    <div v-if="loading" class="loading-row">
      <span>{{
        agentId === 'scout'
          ? 'Scout Agent 正在推荐…'
          : agentId === 'tactical'
            ? 'Tactical Agent 正在分析…'
            : 'Stats Agent 正在分析…'
      }}</span>
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

.narrow-hint {
  margin: 0.75rem 0;
}

.recommendations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.missing-fields {
  margin: 0.75rem 0 0;
  padding-left: 1.2rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.feedback-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--color-border);
}

.feedback-label {
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
