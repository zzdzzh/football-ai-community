<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { createFanDiscussion, fetchFanPersonas } from '@/api/fan-discussions';
import PersonaPicker from '@/components/fan/PersonaPicker.vue';
import type { FanPersona } from '@/types/fan';
import type { LeagueCode } from '@/constants/leagues';

const router = useRouter();
const route = useRoute();

const league = ref<LeagueCode>('PL');
const personas = ref<FanPersona[]>([]);
const selectedPersonaIds = ref<string[]>([]);
const topic = ref('');
const matchId = ref('');
const loadingPersonas = ref(false);
const creating = ref(false);

async function loadPersonas() {
  loadingPersonas.value = true;
  try {
    const result = await fetchFanPersonas({ league: league.value });
    personas.value = result.items;
    selectedPersonaIds.value = selectedPersonaIds.value.filter((id) =>
      result.items.some((persona) => persona.id === id),
    );
  } catch {
    ElMessage.error('加载 Fan Persona 失败，请先登录');
  } finally {
    loadingPersonas.value = false;
  }
}

async function startDiscussion() {
  const trimmedTopic = topic.value.trim();
  if (!trimmedTopic) {
    ElMessage.warning('请输入讨论主题');
    return;
  }
  if (selectedPersonaIds.value.length < 2) {
    ElMessage.warning('请至少选择 2 个 Fan Persona');
    return;
  }

  creating.value = true;
  try {
    const discussion = await createFanDiscussion({
      topic: trimmedTopic,
      personaIds: selectedPersonaIds.value,
      matchId: matchId.value.trim() || undefined,
    });
    await router.push(`/discussions/${discussion.id}`);
  } catch (err: unknown) {
    const response =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number; data?: { message?: string; error?: string } } }).response
        : undefined;
    if (response?.status === 422 || response?.data?.error === 'content_policy_violation') {
      ElMessage.error(response?.data?.message || '内容违反社区规范，请修改后重试');
    } else if (response?.status === 408) {
      ElMessage.error('Fan Agent 响应超时，请重试');
    } else if (response?.status === 503 || response?.data?.error === 'service_unavailable') {
      ElMessage.warning(response?.data?.message || 'AI 服务暂不可用，请稍后再试');
    } else {
      ElMessage.error(response?.data?.message || '创建讨论失败');
    }
  } finally {
    creating.value = false;
  }
}

watch(league, () => {
  loadPersonas();
});

onMounted(() => {
  const queryTopic = route.query.topic;
  const queryMatchId = route.query.matchId;
  if (typeof queryTopic === 'string') topic.value = queryTopic;
  if (typeof queryMatchId === 'string') matchId.value = queryMatchId;
  loadPersonas();
});
</script>

<template>
  <section class="fan-start-view">
    <h1 class="page-title">Fan 模拟讨论</h1>
    <p class="page-subtitle">选择 ≥2 个球队 Persona，围绕赛后话题生成模拟球迷交锋</p>

    <div class="form-grid">
      <div class="field-block">
        <label class="field-label">讨论主题</label>
        <el-input
          v-model="topic"
          type="textarea"
          :rows="2"
          maxlength="200"
          show-word-limit
          placeholder="例如：曼联 vs 利物浦赛后谁更强"
        />
      </div>

      <div class="field-block">
        <label class="field-label">关联比赛 ID（可选）</label>
        <el-input v-model="matchId" placeholder="填写 matchId 可注入赛后上下文" clearable />
      </div>
    </div>

    <PersonaPicker
      v-model:league="league"
      v-model:selected-ids="selectedPersonaIds"
      :personas="personas"
      :loading="loadingPersonas"
    />

    <div class="actions">
      <el-button type="primary" size="large" :loading="creating" @click="startDiscussion">
        开始模拟讨论
      </el-button>
      <p class="hint">首轮生成约需 60 秒，请耐心等待</p>
    </div>
  </section>
</template>

<style scoped>
.fan-start-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 768px) {
  .form-grid {
    grid-template-columns: 2fr 1fr;
  }
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.85rem;
  font-weight: 500;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  align-items: flex-start;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
</style>
