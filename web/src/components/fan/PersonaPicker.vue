<script setup lang="ts">
import type { FanPersona } from '@/types/fan';
import type { LeagueCode } from '@/constants/leagues';
import { LEAGUE_OPTIONS_SHORT } from '@/constants/leagues';

defineProps<{
  personas: FanPersona[];
  loading?: boolean;
}>();

const league = defineModel<LeagueCode>('league', { required: true });
const selectedIds = defineModel<string[]>('selectedIds', { required: true });

const leagueOptions = LEAGUE_OPTIONS_SHORT;

function togglePersona(personaId: string, checked: boolean) {
  if (checked) {
    if (!selectedIds.value.includes(personaId)) {
      selectedIds.value = [...selectedIds.value, personaId];
    }
    return;
  }
  selectedIds.value = selectedIds.value.filter((id) => id !== personaId);
}

function isSelected(personaId: string) {
  return selectedIds.value.includes(personaId);
}
</script>

<template>
  <section v-loading="loading" class="persona-picker">
    <div class="filter-row">
      <label class="field-label">筛选联赛</label>
      <el-select v-model="league" class="league-select">
        <el-option
          v-for="opt in leagueOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
    </div>

    <p class="hint">至少选择 2 个不同球队的 Fan Persona（已选 {{ selectedIds.length }} 个）</p>

    <div v-if="personas.length" class="persona-grid">
      <label
        v-for="persona in personas"
        :key="persona.id"
        class="persona-card"
        :class="{ selected: isSelected(persona.id) }"
      >
        <el-checkbox
          :model-value="isSelected(persona.id)"
          @change="(val: boolean) => togglePersona(persona.id, val)"
        />
        <div class="persona-body">
          <div class="persona-header">
            <span class="persona-name">{{ persona.displayName }}</span>
            <el-tag size="small" class="team-tag">{{ persona.teamName }}</el-tag>
          </div>
          <div class="trait-row">
            <el-tag
              v-for="trait in persona.styleTraits"
              :key="trait"
              size="small"
              type="info"
              effect="plain"
            >
              {{ trait }}
            </el-tag>
          </div>
        </div>
      </label>
    </div>
    <el-empty v-else description="当前联赛暂无可用 Persona" />
  </section>
</template>

<style scoped>
.persona-picker {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.filter-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text);
}

.league-select {
  width: 100%;
  max-width: 280px;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.persona-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

@media (min-width: 768px) {
  .persona-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.persona-card {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  background: #fff;
}

.persona-card.selected {
  border-color: #1b5e20;
  box-shadow: 0 0 0 1px rgba(27, 94, 32, 0.15);
}

.persona-body {
  flex: 1;
  min-width: 0;
}

.persona-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.persona-name {
  font-weight: 600;
}

.team-tag {
  --el-tag-bg-color: rgba(27, 94, 32, 0.1);
  --el-tag-border-color: rgba(27, 94, 32, 0.25);
  --el-tag-text-color: #1b5e20;
}

.trait-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
</style>
