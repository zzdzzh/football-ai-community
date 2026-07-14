<script setup lang="ts">
import type { LeagueCode } from '@/constants/leagues';
import type { Team } from '@/types/stats';
import type { ScoutContextType } from '@/types/scout';
import { CLUB_LEAGUE_OPTIONS_SHORT } from '@/constants/leagues';

defineProps<{
  teams: Team[];
  loading?: boolean;
}>();

const tabModel = defineModel<ScoutContextType>('activeTab', { required: true });
const leagueModel = defineModel<LeagueCode>('league', { required: true });
const teamQueryModel = defineModel<string>('teamQuery', { required: true });
const selectedTeamIdModel = defineModel<string | null>('selectedTeamId', { required: true });

defineEmits<{
  searchTeams: [];
}>();

const leagueOptions = CLUB_LEAGUE_OPTIONS_SHORT;
</script>

<template>
  <el-tabs v-model="tabModel" class="scout-tabs">
    <el-tab-pane label="按联赛" name="league">
      <div class="filter-grid">
        <div class="filter-field">
          <label class="field-label">联赛</label>
          <el-select v-model="leagueModel">
            <el-option
              v-for="opt in leagueOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </div>
      </div>
      <p class="hint-text">将在此联赛范围内搜索候选球员并生成推荐。</p>
    </el-tab-pane>

    <el-tab-pane label="按球队" name="team">
      <div class="filter-grid">
        <div class="filter-field">
          <label class="field-label">联赛</label>
          <el-select v-model="leagueModel">
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
            v-model="teamQueryModel"
            placeholder="输入球队名称搜索"
            clearable
            @keyup.enter="$emit('searchTeams')"
          />
        </div>
        <div class="filter-actions">
          <el-button type="primary" :loading="loading" @click="$emit('searchTeams')">搜索</el-button>
        </div>
      </div>

      <div v-loading="loading" class="select-panel">
        <label class="field-label">选择球队</label>
        <el-radio-group v-if="teams.length" v-model="selectedTeamIdModel" class="option-list">
          <el-radio v-for="team in teams" :key="team.id" :label="team.id" class="option-item">
            {{ team.name }} ({{ team.leagueCode }})
          </el-radio>
        </el-radio-group>
        <el-empty v-else description="搜索球队后限定推荐范围" />
      </div>
    </el-tab-pane>

    <el-tab-pane label="不限范围" name="general">
      <p class="hint-text">在全库候选球员中推荐，建议首条消息补充位置、年龄等条件。</p>
    </el-tab-pane>
  </el-tabs>
</template>

<style scoped>
.scout-tabs {
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
  margin-bottom: 0.75rem;
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

.hint-text {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.select-panel {
  min-height: 120px;
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
</style>
