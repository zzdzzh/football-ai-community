<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { fetchMatches } from '@/api/matches';
import { searchTeams } from '@/api/teams';
import { createConversation } from '@/api/conversations';
import type { LeagueCode, MatchSummary, Team } from '@/types/stats';
import { LEAGUE_OPTIONS_SHORT } from '@/constants/leagues';

const router = useRouter();

const activeTab = ref<'match' | 'team'>('match');
const loading = ref(false);
const creating = ref(false);

const league = ref<LeagueCode>('PL');
const matchStatus = ref<'FINISHED' | 'LIVE' | 'SCHEDULED' | ''>('FINISHED');
const matches = ref<MatchSummary[]>([]);
const syncWarnings = ref<string[]>([]);

const teamQuery = ref('');
const teams = ref<Team[]>([]);

const selectedMatchId = ref<string | null>(null);
const selectedTeamId = ref<string | null>(null);
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

async function loadMatches() {
  loading.value = true;
  try {
    const result = await fetchMatches({
      league: league.value,
      status: matchStatus.value || undefined,
      pageSize: 30,
    });
    matches.value = result.items;
    syncWarnings.value = result.warnings ?? [];
    if (result.items.length > 0 && !selectedMatchId.value) {
      selectedMatchId.value = result.items[0].id;
    }
  } catch {
    ElMessage.error('加载比赛列表失败');
  } finally {
    loading.value = false;
  }
}

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
    if (result.items.length > 0 && !selectedTeamId.value) {
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
    const payload =
      activeTab.value === 'match'
        ? {
            agentId: 'stats' as const,
            contextType: 'match' as const,
            contextId: selectedMatchId.value ?? undefined,
            initialMessage: initialQuestion.value.trim() || undefined,
          }
        : {
            agentId: 'stats' as const,
            contextType: 'team' as const,
            contextId: selectedTeamId.value ?? undefined,
            initialMessage: initialQuestion.value.trim() || undefined,
          };

    if (!payload.contextId) {
      ElMessage.warning('请先选择比赛或球队');
      return;
    }

    const conversation = await createConversation(payload);
    await router.push({ path: `/conversations/${conversation.id}`, query: { from: 'stats' } });
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
    ElMessage.error(msg || '创建对话失败，请先登录或检查所选上下文');
  } finally {
    creating.value = false;
  }
}

onMounted(() => {
  loadMatches();
});
</script>

<template>
  <section class="stats-start-view">
    <h1 class="page-title">Stats 数据问答</h1>
    <p class="page-subtitle">选择比赛或球队，向 Stats Agent 提问关键数据指标</p>

    <el-alert
      v-for="(warning, idx) in syncWarnings"
      :key="idx"
      :title="warning"
      type="warning"
      show-icon
      :closable="false"
      class="sync-banner"
    />

    <el-tabs v-model="activeTab" class="stats-tabs">
      <el-tab-pane label="按比赛" name="match">
        <div class="filter-grid">
          <div class="filter-field">
            <label class="field-label">联赛</label>
            <el-select v-model="league" @change="loadMatches">
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
            <el-select v-model="matchStatus" @change="loadMatches">
              <el-option label="已结束" value="FINISHED" />
              <el-option label="进行中" value="LIVE" />
              <el-option label="未开赛" value="SCHEDULED" />
              <el-option label="全部" value="" />
            </el-select>
          </div>
          <div class="filter-actions">
            <el-button :loading="loading" @click="loadMatches">刷新</el-button>
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
              <el-tag v-if="match.dataCompleteness === 'pending'" size="small" type="info">
                同步中
              </el-tag>
            </el-radio>
          </el-radio-group>
          <el-empty v-else description="暂无比赛数据，请确认后台已同步" />
        </div>
      </el-tab-pane>

      <el-tab-pane label="按球队" name="team">
        <div class="filter-grid">
          <div class="filter-field">
            <label class="field-label">联赛</label>
            <el-select v-model="league">
              <el-option
                v-for="opt in leagueOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
          <div class="filter-field filter-field-grow">
            <label class="field-label">球队名称</label>
            <el-input
              v-model="teamQuery"
              placeholder="输入球队名称搜索"
              clearable
              @keyup.enter="loadTeams"
            />
          </div>
          <div class="filter-actions">
            <el-button type="primary" :loading="loading" @click="loadTeams">搜索</el-button>
          </div>
        </div>

        <div v-loading="loading" class="select-panel">
          <label class="field-label">选择球队</label>
          <el-radio-group v-if="teams.length" v-model="selectedTeamId" class="option-list">
            <el-radio v-for="team in teams" :key="team.id" :label="team.id" class="option-item">
              {{ team.name }} ({{ team.leagueCode }})
            </el-radio>
          </el-radio-group>
          <el-empty v-else description="搜索球队后开始对话" />
        </div>
      </el-tab-pane>
    </el-tabs>

    <div class="start-footer">
      <div class="question-field">
        <label class="field-label">首个问题（可选）</label>
        <el-input
          v-model="initialQuestion"
          type="textarea"
          :rows="2"
          placeholder="例如：这场比赛控球与射门表现如何？"
          maxlength="2000"
        />
      </div>
      <el-button type="primary" size="large" :loading="creating" @click="startConversation">
        开始对话
      </el-button>
    </div>
  </section>
</template>

<style scoped>
.stats-start-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sync-banner {
  margin-bottom: 0.25rem;
}

.stats-tabs {
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
