<script setup lang="ts">
import type { TacticalAnalysis } from '@/types/tactical';
import { ANALYSIS_TYPE_LABELS, PHASE_KEY_LABELS } from '@/types/tactical';
import FormationBadge from './FormationBadge.vue';

defineProps<{
  analysis: TacticalAnalysis;
}>();

function phaseLabel(key: string, fallback: string) {
  return PHASE_KEY_LABELS[key as keyof typeof PHASE_KEY_LABELS] ?? fallback;
}
</script>

<template>
  <section class="tactical-phase-panel">
    <header class="panel-header">
      <span class="analysis-type-tag">
        {{ ANALYSIS_TYPE_LABELS[analysis.analysisType] }}
      </span>
      <FormationBadge v-if="analysis.formation" :formation="analysis.formation" />
    </header>

    <div class="phases-list">
      <article v-for="phase in analysis.phases" :key="phase.key" class="phase-card">
        <h4 class="phase-title">{{ phase.label || phaseLabel(phase.key, phase.key) }}</h4>
        <p class="phase-summary">{{ phase.summary }}</p>
        <p v-if="phase.keyPlayerNames?.length" class="phase-players">
          关键球员：{{ phase.keyPlayerNames.join('、') }}
        </p>
      </article>
    </div>

    <div v-if="analysis.keyPlayers?.length" class="key-players">
      <h4 class="section-title">核心球员</h4>
      <ul>
        <li v-for="player in analysis.keyPlayers" :key="`${player.name}-${player.role}`">
          <strong>{{ player.name }}</strong>
          <span class="player-role">{{ player.role }}</span>
        </li>
      </ul>
    </div>

    <el-alert
      v-for="(limitation, idx) in analysis.dataLimitations"
      :key="idx"
      :title="limitation"
      type="warning"
      show-icon
      :closable="false"
      class="limitation-alert"
    />
  </section>
</template>

<style scoped>
.tactical-phase-panel {
  margin-top: 0.75rem;
  padding: 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
}

.panel-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.analysis-type-tag {
  font-size: 0.8rem;
  font-weight: 600;
  color: #fff;
  background: var(--color-primary);
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
}

.phases-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.phase-card {
  padding: 0.65rem 0.75rem;
  border-left: 3px solid var(--color-accent);
  background: var(--color-surface);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.phase-title {
  margin: 0 0 0.35rem;
  font-size: 0.95rem;
}

.phase-summary {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.45;
}

.phase-players {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.key-players {
  margin-top: 0.85rem;
}

.section-title {
  margin: 0 0 0.35rem;
  font-size: 0.9rem;
}

.key-players ul {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.88rem;
}

.player-role {
  margin-left: 0.35rem;
  color: var(--color-text-muted);
}

.limitation-alert {
  margin-top: 0.65rem;
}
</style>
