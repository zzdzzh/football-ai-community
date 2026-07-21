<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { searchTeams } from '@/api/teams';
import { createScoutConversation } from '@/api/conversations';
import ScoutFilterForm from '@/components/scout/ScoutFilterForm.vue';
import type { LeagueCode } from '@/constants/leagues';
import type { Team } from '@/types/stats';
import type { ScoutContextType } from '@/types/scout';

const route = useRoute();
const router = useRouter();

const activeTab = ref<ScoutContextType>('league');
const loading = ref(false);
const creating = ref(false);

const league = ref<LeagueCode>('PL');
const teamQuery = ref('');
const teams = ref<Team[]>([]);
const selectedTeamId = ref<string | null>(null);
const initialQuestion = ref('');

async function loadTeams() {
  if (!teamQuery.value.trim()) {
    teams.value = [];
    return;
  }
  loading.value = true;
  try {
    const result = await searchTeams({
      q: teamQuery.value.trim(),
      league: league.value,
      pageSize: 20,
    });
    teams.value = result.items;
    if (result.items.length > 0) {
      selectedTeamId.value = result.items[0].id;
    }
  } catch {
    ElMessage.error('搜索球队失败');
  } finally {
    loading.value = false;
  }
}

async function startConversation() {
  creating.value = true;
  try {
    let contextId: string | undefined;
    if (activeTab.value === 'league') {
      contextId = league.value;
    } else if (activeTab.value === 'team') {
      if (!selectedTeamId.value) {
        ElMessage.warning('请先选择球队');
        return;
      }
      contextId = selectedTeamId.value;
    }

    const conversation = await createScoutConversation({
      agentId: 'scout',
      contextType: activeTab.value,
      contextId,
      initialMessage: initialQuestion.value.trim() || undefined,
    });
    await router.push({ path: `/conversations/${conversation.id}`, query: { from: 'scout' } });
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
    ElMessage.error(msg || '创建 Scout 对话失败，请先登录');
  } finally {
    creating.value = false;
  }
}

onMounted(() => {
  const q = typeof route.query.q === 'string' ? route.query.q.trim() : '';
  const hint = typeof route.query.hint === 'string' ? route.query.hint.trim() : '';
  if (hint) {
    initialQuestion.value = hint;
  } else if (q) {
    initialQuestion.value = `推荐与「${q}」风格或能力接近的球员`;
  }
});
</script>

<template>
  <section class="scout-start-view">
    <h1 class="page-title">Scout 球员推荐</h1>
    <p class="page-subtitle">选择联赛或球队范围，描述需求获取 AI 球员推荐</p>

    <ScoutFilterForm
      v-model:active-tab="activeTab"
      v-model:league="league"
      v-model:team-query="teamQuery"
      v-model:selected-team-id="selectedTeamId"
      :teams="teams"
      :loading="loading"
      @search-teams="loadTeams"
    />

    <div class="start-footer">
      <div class="question-field">
        <label class="field-label">首个问题（可选）</label>
        <el-input
          v-model="initialQuestion"
          type="textarea"
          :rows="2"
          placeholder="例如：需要一名擅长压迫的中场，25岁以下"
          maxlength="2000"
        />
      </div>
      <el-button type="primary" size="large" :loading="creating" @click="startConversation">
        开始推荐
      </el-button>
    </div>
  </section>
</template>

<style scoped>
.scout-start-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.start-footer {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.field-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 0.35rem;
  color: var(--color-text);
}

@media (min-width: 768px) {
  .start-footer {
    flex-direction: row;
    align-items: flex-end;
  }

  .question-field {
    flex: 1;
  }
}
</style>
