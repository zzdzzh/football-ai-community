<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { addFanDiscussionTurn, fetchFanDiscussion } from '@/api/fan-discussions';
import TurnBubble from '@/components/fan/TurnBubble.vue';
import ReportDialog from '@/components/fan/ReportDialog.vue';
import ChatInput from '@/components/conversation/ChatInput.vue';
import type { FanDiscussionDetail, FanDiscussionTurn } from '@/types/fan';

const route = useRoute();
const router = useRouter();

const discussionId = computed(() => route.params.discussionId as string);
const discussion = ref<FanDiscussionDetail | null>(null);
const turns = ref<FanDiscussionTurn[]>([]);
const loading = ref(false);
const sending = ref(false);
const errorMessage = ref('');

const reportVisible = ref(false);
const reportTarget = ref<{ type: 'fan_discussion' | 'fan_discussion_turn'; id: string; label: string } | null>(
  null,
);

async function loadDiscussion() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const detail = await fetchFanDiscussion(discussionId.value);
    discussion.value = detail;
    turns.value = detail.turns;
  } catch (err: unknown) {
    const response =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number; data?: { message?: string } } }).response
        : undefined;
    if (response?.status === 403) {
      errorMessage.value = '讨论已隐藏或无权访问';
    } else if (response?.status === 404) {
      errorMessage.value = '讨论不存在';
    } else {
      errorMessage.value = '加载讨论失败';
    }
  } finally {
    loading.value = false;
  }
}

async function handleSend(content: string) {
  sending.value = true;
  try {
    const result = await addFanDiscussionTurn(discussionId.value, content);
    turns.value = [...turns.value, result.userTurn, ...result.personaTurns];
  } catch (err: unknown) {
    const response =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number; data?: { message?: string; error?: string } } }).response
        : undefined;
    if (response?.status === 422 || response?.data?.error === 'content_policy_violation') {
      ElMessage.error(response?.data?.message || '内容违反社区规范，请修改后重试');
    } else if (response?.status === 408) {
      ElMessage.error('Fan Agent 续写超时，请重试');
    } else if (response?.status === 403) {
      ElMessage.error('无权插话或讨论已关闭');
    } else {
      ElMessage.error(response?.data?.message || '发送失败');
    }
  } finally {
    sending.value = false;
  }
}

function openReportTurn(turn: FanDiscussionTurn) {
  reportTarget.value = {
    type: 'fan_discussion_turn',
    id: turn.id,
    label: turn.role === 'persona' ? turn.personaDisplayName || 'Persona 发言' : '用户发言',
  };
  reportVisible.value = true;
}

function openReportDiscussion() {
  if (!discussion.value) return;
  reportTarget.value = {
    type: 'fan_discussion',
    id: discussion.value.id,
    label: discussion.value.topic,
  };
  reportVisible.value = true;
}

function goBack() {
  router.push('/fan');
}

onMounted(() => {
  loadDiscussion();
});
</script>

<template>
  <section v-loading="loading" class="fan-discussion-view">
    <header class="discussion-header">
      <div>
        <el-button text type="primary" @click="goBack">← 返回 Fan 入口</el-button>
        <h1 class="page-title">{{ discussion?.topic ?? 'Fan 讨论' }}</h1>
        <p v-if="discussion" class="page-subtitle">
          讨论 ID：{{ discussion.id }} · 轮次 {{ discussion.turnCount }}
        </p>
      </div>
      <el-button v-if="discussion" size="small" @click="openReportDiscussion">举报讨论</el-button>
    </header>

    <el-alert
      v-if="discussion?.disclaimer"
      :title="discussion.disclaimer"
      type="info"
      show-icon
      :closable="false"
      class="disclaimer"
    />

    <el-alert
      v-if="errorMessage"
      :title="errorMessage"
      type="error"
      show-icon
      :closable="false"
    />

    <template v-else>
      <div class="turn-list">
        <div v-for="turn in turns" :key="turn.id" class="turn-row">
          <TurnBubble :turn="turn" />
          <el-button
            v-if="turn.role === 'persona' && !turn.isHidden"
            text
            type="danger"
            size="small"
            class="report-btn"
            @click="openReportTurn(turn)"
          >
            举报
          </el-button>
        </div>
        <el-empty v-if="!turns.length && !loading" description="暂无发言" />
      </div>

      <ChatInput
        :loading="sending"
        :disabled="discussion?.status !== 'active'"
        placeholder="插话参与讨论，Fan Persona 将参考你的观点回应"
        @send="handleSend"
      />
    </template>

    <ReportDialog
      v-if="reportTarget"
      v-model:visible="reportVisible"
      :target-type="reportTarget.type"
      :target-id="reportTarget.id"
      :target-label="reportTarget.label"
    />
  </section>
</template>

<style scoped>
.fan-discussion-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.discussion-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.disclaimer {
  margin-bottom: 0;
}

.turn-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 240px;
}

.turn-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.report-btn {
  align-self: flex-start;
  margin-left: 0.25rem;
}
</style>
