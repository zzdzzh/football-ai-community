<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { fetchConversation, sendMessage } from '@/api/conversations';
import MessageList from '@/components/conversation/MessageList.vue';
import ChatInput from '@/components/conversation/ChatInput.vue';
import type { AgentId, ConversationDetail, Message } from '@/types/stats';

const route = useRoute();
const router = useRouter();

const conversationId = computed(() => route.params.conversationId as string);
const conversation = ref<ConversationDetail | null>(null);
const messages = ref<Message[]>([]);
const loading = ref(false);
const sending = ref(false);
const errorMessage = ref('');

const agentId = computed<AgentId>(() => conversation.value?.agentId ?? 'stats');
const isScout = computed(() => agentId.value === 'scout');
const isTactical = computed(() => agentId.value === 'tactical');

const backPath = computed(() => {
  if (isScout.value) return '/scout';
  if (isTactical.value) {
    const matchId = route.query.matchId as string | undefined;
    if (matchId) return `/matches/${matchId}`;
    return '/tactical';
  }
  return '/stats';
});
const defaultTitle = computed(() => {
  if (isScout.value) return 'Scout 对话';
  if (isTactical.value) return 'Tactical 对话';
  return 'Stats 对话';
});

async function loadConversation() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const detail = await fetchConversation(conversationId.value);
    conversation.value = detail;
    messages.value = detail.messages;
  } catch (err: unknown) {
    const status =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number; data?: { message?: string } } }).response?.status
        : undefined;
    if (status === 403 || status === 401) {
      errorMessage.value = '无权访问此对话，请确认已登录且为对话创建者';
    } else if (status === 404) {
      errorMessage.value = '对话不存在';
    } else {
      errorMessage.value = '加载对话失败';
    }
  } finally {
    loading.value = false;
  }
}

async function handleSend(content: string) {
  sending.value = true;
  try {
    const result = await sendMessage(conversationId.value, content);
    messages.value = [...messages.value, result.userMessage, result.assistantMessage];
  } catch (err: unknown) {
    const response =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number; data?: { message?: string } } }).response
        : undefined;
    if (response?.status === 503) {
      ElMessage.warning(response.data?.message || '数据同步中，请稍后再试');
    } else if (response?.status === 408) {
      const label = isScout.value ? 'Scout' : isTactical.value ? 'Tactical' : 'Stats';
      ElMessage.error(`${label} Agent 响应超时，请重试`);
    } else {
      ElMessage.error(response?.data?.message || '发送失败');
    }
  } finally {
    sending.value = false;
  }
}

function goBack() {
  router.push(backPath.value);
}

onMounted(() => {
  loadConversation();
});
</script>

<template>
  <section v-loading="loading" class="conversation-view">
    <header class="conversation-header">
      <div>
        <el-button text type="primary" @click="goBack">← 返回选择</el-button>
        <h1 class="page-title">{{ conversation?.title ?? defaultTitle }}</h1>
        <p v-if="conversation" class="page-subtitle">
          对话 ID：{{ conversation.id }} · Agent：{{ conversation.agentId }} · 上下文：{{
            conversation.contextType
          }}
        </p>
      </div>
    </header>

    <el-alert
      v-if="errorMessage"
      :title="errorMessage"
      type="error"
      show-icon
      :closable="false"
    />

    <template v-else>
      <MessageList
        :messages="messages"
        :loading="sending"
        :agent-id="agentId"
        :conversation-id="conversationId"
      />
      <ChatInput
        :loading="sending"
        :placeholder="
          isScout
            ? '补充位置、年龄或风格要求…'
            : isTactical
              ? '追问压迫、出球或转换阶段…'
              : '输入关于比赛数据的问题…'
        "
        @send="handleSend"
      />
    </template>
  </section>
</template>

<style scoped>
.conversation-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 900px;
  margin: 0 auto;
}

.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.conversation-header .page-title {
  margin-top: 0.25rem;
}
</style>
