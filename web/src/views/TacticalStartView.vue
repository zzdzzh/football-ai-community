<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { fetchMatches } from '@/api/matches';
import { searchTeams } from '@/api/teams';
import { createTacticalConversation } from '@/api/conversations';
import ListPagination from '@/components/common/ListPagination.vue';
import type { LeagueCode, MatchSummary, Team } from '@/types/stats';
import { LEAGUE_OPTIONS_SHORT } from '@/constants/leagues';

const PAGE_SIZE = 15;

const router = useRouter();

const loading = ref(false);
const teamSearching = ref(false);
const creating = ref(false);

const league = ref<LeagueCode>('PL');
const matchStatus = ref<'FINISHED' | 'LIVE' | 'SCHEDULED' | ''>('FINISHED');
const matches = ref<MatchSummary[]>([]);
const matchTotal = ref(0);
const matchPage = ref(1);
const syncWarnings = ref<string[]>([]);

const selectedTeamId = ref<string | null>(null);
const teamOptions = ref<Team[]>([]);

const selectedMatchId = ref<string | null>(null);
const initialQuestion = ref('');

const leagueOptions = LEAGUE_OPTIONS_SHORT;

function formatMatchLabel(match: MatchSummary) {
  const score =
    match.homeScore !== null && match.awayScore !== null
      ? ` ${match.homeScore}-${match.awayScore}`
      : '';
  const date = new Date(match.utcDate).toLocaleDateString('zh-CN');
  return `${match.homeTeam.name} vs ${match.awayTeam.name}${score} · ${date}`;
}

async function searchTeamOptions(query: string) {
  const q = query.trim();
  if (!q) {
    teamOptions.value = [];
    return;
  }
  teamSearching.value = true;
  try {
    const result = await searchTeams({
      q,
      league: league.value,
      pageSize: 20,
    });
    teamOptions.value = result.items;
  } catch {
    ElMessage.error('搜索球队失败');
  } finally {
    teamSearching.value = false;
  }
}

async function onLeagueChange() {
  selectedTeamId.value = null;
  teamOptions.value = [];
  await loadMatches(true);
}

async function loadMatches(resetPage = false) {
  if (resetPage) matchPage.value = 1;
  loading.value = true;
  try {
    const result = await fetchMatches({
      league: league.value,
      status: matchStatus.value || undefined,
      teamId: selectedTeamId.value || undefined,
      page: matchPage.value,
      pageSize: PAGE_SIZE,
    });
    matches.value = result.items;
    matchTotal.value = result.total;
    syncWarnings.value = result.warnings ?? [];
    selectedMatchId.value = result.items.length > 0 ? result.items[0].id : null;
    const maxPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE) || 1);
    if (matchPage.value > maxPage) {
      matchPage.value = maxPage;
      await loadMatches();
    }
  } catch {
    ElMessage.error('加载比赛列表失败');
  } finally {
    loading.value = false;
  }
}

function onMatchPageChange(nextPage: number) {
  matchPage.value = nextPage;
  loadMatches();
}

async function startConversation() {
  creating.value = true;
  try {
    if (!selectedMatchId.value) {
      ElMessage.warning('请先选择比赛');
      return;
    }

    const conversation = await createTacticalConversation({
      agentId: 'tactical',
      contextType: 'match',
      contextId: selectedMatchId.value,
      initialMessage: initialQuestion.value.trim() || undefined,
    });
    await router.push({
      path: `/conversations/${conversation.id}`,
      query: { from: 'tactical', matchId: selectedMatchId.value },
    });
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
    ElMessage.error(msg || '创建战术对话失败，请先登录');
  } finally {
    creating.value = false;
  }
}

onMounted(() => {
  loadMatches();
});
</script>

<template>
  <section class="tactical-start-view">
    <h1 class="page-title">Tactical 战术分析</h1>
    <p class="page-subtitle">选择比赛，获取阵型与战术阶段结构化分析</p>

    <el-alert
      v-for="(warning, idx) in syncWarnings"
      :key="idx"
      :title="warning"
      type="warning"
      show-icon
      :closable="false"
      class="sync-banner"
    />

    <div class="filter-panel">
      <div class="filter-grid">
        <div class="filter-field">
          <label class="field-label">联赛</label>
          <el-select v-model="league" @change="onLeagueChange">
            <el-option
              v-for="opt in leagueOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </div>
        <div class="filter-field">
          <label class="field-label">状态</label>
          <el-select v-model="matchStatus" @change="loadMatches(true)">
            <el-option label="已结束" value="FINISHED" />
            <el-option label="进行中" value="LIVE" />
            <el-option label="未开赛" value="SCHEDULED" />
            <el-option label="全部" value="" />
          </el-select>
        </div>
        <div class="filter-field filter-field-grow">
          <label class="field-label">球队（可选）</label>
          <el-select
            v-model="selectedTeamId"
            filterable
            remote
            clearable
            reserve-keyword
            placeholder="输入球队名筛选比赛"
            :remote-method="searchTeamOptions"
            :loading="teamSearching"
            @change="loadMatches(true)"
            @clear="loadMatches(true)"
          >
            <el-option
              v-for="team in teamOptions"
              :key="team.id"
              :label="`${team.name} (${team.leagueCode})`"
              :value="team.id"
            />
          </el-select>
        </div>
        <div class="filter-actions">
          <el-button :loading="loading" @click="loadMatches()">刷新</el-button>
        </div>
      </div>

      <div v-loading="loading" class="select-panel">
        <label class="field-label">选择比赛</label>
        <el-radio-group v-if="matches.length" v-model="selectedMatchId" class="option-list">
          <el-radio
            v-for="match in matches"
            :key="match.id"
            :label="match.id"
            class="option-item"
          >
            {{ formatMatchLabel(match) }}
            <el-tag
              v-if="match.dataCompleteness !== 'complete'"
              size="small"
              type="warning"
              class="data-tag"
            >
              数据不全
            </el-tag>
            <router-link
              class="match-link"
              :to="`/matches/${match.id}`"
              @click.stop
            >
              详情
            </router-link>
          </el-radio>
        </el-radio-group>
        <el-empty v-else description="暂无比赛数据" />
        <ListPagination
          :page="matchPage"
          :page-size="PAGE_SIZE"
          :total="matchTotal"
          @update:page="onMatchPageChange"
        />
      </div>
    </div>

    <div class="start-footer">
      <div class="question-field">
        <label class="field-label">首个问题（可选）</label>
        <el-input
          v-model="initialQuestion"
          type="textarea"
          :rows="2"
          placeholder="例如：主队是如何组织高位压迫的？"
          maxlength="2000"
        />
      </div>
      <el-button type="primary" size="large" :loading="creating" @click="startConversation">
        开始分析
      </el-button>
    </div>
  </section>
</template>

<style scoped>
.tactical-start-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sync-banner {
  margin-bottom: 0.25rem;
}

.filter-panel {
  background: var(--color-surface);
  padding: 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
  align-items: end;
  margin-bottom: 1rem;
}

.filter-field-grow {
  min-width: 180px;
}

.filter-actions {
  display: flex;
  align-items: flex-end;
}

.field-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 0.35rem;
  color: var(--color-text);
}

.select-panel {
  min-height: 160px;
}

.option-list {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  width: 100%;
}

.option-item {
  width: 100%;
  margin-right: 0;
  white-space: normal;
  height: auto;
  line-height: 1.4;
  padding: 0.35rem 0;
}

.match-link {
  margin-left: 0.5rem;
  font-size: 0.82rem;
  color: var(--color-primary);
}

.data-tag {
  margin-left: 0.35rem;
  vertical-align: middle;
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
