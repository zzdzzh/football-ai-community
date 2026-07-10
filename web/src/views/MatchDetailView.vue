<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { fetchMatchDetail } from '@/api/matches';
import { createTacticalConversation } from '@/api/conversations';
import type { MatchDetail } from '@/types/stats';

const route = useRoute();
const router = useRouter();

const matchId = computed(() => route.params.matchId as string);
const match = ref<MatchDetail | null>(null);
const loading = ref(false);
const creating = ref(false);
const initialQuestion = ref('');

const statusLabels: Record<string, string> = {
  SCHEDULED: '未开赛',
  LIVE: '进行中',
  FINISHED: '已结束',
  POSTPONED: '延期',
  CANCELLED: '取消',
};

const scoreText = computed(() => {
  if (!match.value) return '';
  if (match.value.homeScore !== null && match.value.awayScore !== null) {
    return `${match.value.homeScore} - ${match.value.awayScore}`;
  }
  return 'VS';
});

async function loadMatch() {
  loading.value = true;
  try {
    match.value = await fetchMatchDetail(matchId.value);
  } catch {
    ElMessage.error('加载比赛详情失败');
  } finally {
    loading.value = false;
  }
}

async function startTacticalAnalysis() {
  if (!match.value) return;
  creating.value = true;
  try {
    const conversation = await createTacticalConversation({
      agentId: 'tactical',
      contextType: 'match',
      contextId: match.value.id,
      initialMessage: initialQuestion.value.trim() || undefined,
    });
    await router.push({
      path: `/conversations/${conversation.id}`,
      query: { from: 'tactical', matchId: match.value.id },
    });
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
    ElMessage.error(msg || '创建战术分析失败，请先登录');
  } finally {
    creating.value = false;
  }
}

onMounted(() => {
  loadMatch();
});
</script>

<template>
  <section v-loading="loading" class="match-detail-view">
    <header class="match-header">
      <el-button text type="primary" @click="router.push('/tactical')">← 返回战术分析</el-button>
      <h1 v-if="match" class="page-title">
        {{ match.homeTeam.name }} vs {{ match.awayTeam.name }}
      </h1>
      <p v-if="match" class="page-subtitle">
        {{ match.leagueCode }} · {{ statusLabels[match.status] ?? match.status }} ·
        {{ new Date(match.utcDate).toLocaleString('zh-CN') }}
      </p>
    </header>

    <el-alert
      v-if="match?.syncMessage"
      :title="match.syncMessage"
      type="info"
      show-icon
      :closable="false"
    />

    <div v-if="match" class="score-board">
      <div class="team-block">
        <span class="team-name">{{ match.homeTeam.name }}</span>
      </div>
      <div class="score-center">{{ scoreText }}</div>
      <div class="team-block">
        <span class="team-name">{{ match.awayTeam.name }}</span>
      </div>
    </div>

    <section v-if="match?.stats?.length" class="stats-section">
      <h2 class="section-title">比赛统计</h2>
      <div class="stats-table">
        <div v-for="stat in match.stats" :key="stat.name" class="stats-row">
          <span class="stat-home">{{ stat.homeValue ?? '-' }}{{ stat.unit ?? '' }}</span>
          <span class="stat-name">{{ stat.name }}</span>
          <span class="stat-away">{{ stat.awayValue ?? '-' }}{{ stat.unit ?? '' }}</span>
        </div>
      </div>
    </section>

    <section v-if="match?.events?.length" class="events-section">
      <h2 class="section-title">关键事件</h2>
      <ul class="events-list">
        <li v-for="(event, idx) in match.events" :key="idx">
          {{ event.minute }}' · {{ event.type }} · {{ event.playerName }}
        </li>
      </ul>
    </section>

    <div class="tactical-entry">
      <div class="question-field">
        <label class="field-label">战术问题（可选）</label>
        <el-input
          v-model="initialQuestion"
          type="textarea"
          :rows="2"
          placeholder="例如：主队是如何组织高位压迫的？"
          maxlength="2000"
        />
      </div>
      <el-button type="primary" size="large" :loading="creating" @click="startTacticalAnalysis">
        战术分析
      </el-button>
    </div>
  </section>
</template>

<style scoped>
.match-detail-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 720px;
  margin: 0 auto;
}

.match-header .page-title {
  margin-top: 0.25rem;
}

.score-board {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1rem;
  align-items: center;
  padding: 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  text-align: center;
}

.team-name {
  font-weight: 600;
}

.score-center {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-primary-dark);
}

.section-title {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}

.stats-table {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.stats-row {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1fr;
  gap: 0.5rem;
  font-size: 0.9rem;
  padding: 0.35rem 0;
  border-bottom: 1px dashed var(--color-border);
}

.stat-name {
  text-align: center;
  color: var(--color-text-muted);
}

.stat-home {
  text-align: right;
}

.stat-away {
  text-align: left;
}

.events-list {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 0.9rem;
}

.tactical-entry {
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
}

@media (min-width: 768px) {
  .tactical-entry {
    flex-direction: row;
    align-items: flex-end;
  }

  .question-field {
    flex: 1;
  }
}
</style>
