<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { fetchConversations } from '@/api/conversations';
import type { AgentId, ConversationSummary } from '@/types/stats';

const router = useRouter();

const loading = ref(false);
const items = ref<ConversationSummary[]>([]);
const total = ref(0);
const agentFilter = ref<AgentId | ''>('');

const agentLabels: Record<AgentId, string> = {
  stats: '数据解读',
  scout: '球员推荐',
  tactical: '战术分析',
};

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN');
}

async function loadList() {
  loading.value = true;
  try {
    const result = await fetchConversations({
      agentId: agentFilter.value || undefined,
      page: 1,
      pageSize: 50,
    });
    items.value = result.items;
    total.value = result.total;
  } catch {
    ElMessage.error('加载对话列表失败');
  } finally {
    loading.value = false;
  }
}

function openConversation(item: ConversationSummary) {
  router.push({
    path: `/conversations/${item.id}`,
    query: { from: item.agentId },
  });
}

function startNew(agent: AgentId) {
  const path = agent === 'stats' ? '/stats' : agent === 'scout' ? '/scout' : '/tactical';
  router.push(path);
}

onMounted(() => {
  loadList();
});
</script>

<template>
  <section class="conversations-list-view">
    <header class="page-header">
      <div>
        <h1 class="page-title">我的对话</h1>
        <p class="page-subtitle">重入 Stats / Scout / Tactical 历史会话</p>
      </div>
      <div class="header-actions">
        <el-button size="small" @click="startNew('stats')">数据解读</el-button>
        <el-button size="small" @click="startNew('scout')">球员推荐</el-button>
        <el-button size="small" @click="startNew('tactical')">战术分析</el-button>
      </div>
    </header>

    <div class="filter-row">
      <label class="field-label">Agent 筛选</label>
      <el-select
        v-model="agentFilter"
        clearable
        placeholder="全部"
        style="width: 160px"
        @change="loadList"
      >
        <el-option label="数据解读" value="stats" />
        <el-option label="球员推荐" value="scout" />
        <el-option label="战术分析" value="tactical" />
      </el-select>
      <el-button :loading="loading" @click="loadList">刷新</el-button>
    </div>

    <div v-loading="loading" class="list-panel">
      <el-empty v-if="!items.length && !loading" description="暂无对话，可从上方入口发起" />
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="conv-item"
        @click="openConversation(item)"
      >
        <div class="conv-item__main">
          <el-tag size="small" type="info">{{ agentLabels[item.agentId] ?? item.agentId }}</el-tag>
          <span class="conv-item__title">{{ item.title }}</span>
        </div>
        <span class="conv-item__time">{{ formatTime(item.updatedAt) }}</span>
      </button>
      <p v-if="total > 0" class="list-meta">共 {{ total }} 条</p>
    </div>
  </section>
</template>

<style scoped>
.conversations-list-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.page-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
}

.field-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 0.35rem;
  width: 100%;
}

@media (min-width: 480px) {
  .field-label {
    width: auto;
    margin-bottom: 0;
    margin-right: 0.25rem;
  }
}

.list-panel {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.conv-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  text-align: left;
  padding: 0.85rem 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  color: inherit;
  font: inherit;
}

.conv-item:hover {
  border-color: var(--color-primary);
}

.conv-item__main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.conv-item__title {
  font-weight: 500;
  word-break: break-word;
}

.conv-item__time {
  flex-shrink: 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.list-meta {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
</style>
