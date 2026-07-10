<script setup lang="ts">
import type { MetricCitation } from '@/types/stats';

defineProps<{
  metrics: MetricCitation[];
}>();

function formatValue(metric: MetricCitation) {
  const unit = metric.unit ?? '';
  return `${metric.value}${unit}`;
}
</script>

<template>
  <div v-if="metrics.length > 0" class="metric-list">
    <div v-for="(metric, index) in metrics" :key="`${metric.name}-${index}`" class="metric-chip">
      <span class="metric-name">{{ metric.name }}</span>
      <span class="metric-value">{{ formatValue(metric) }}</span>
    </div>
  </div>
</template>

<style scoped>
.metric-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.metric-chip {
  display: inline-flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.35rem 0.6rem;
  background: rgba(26, 127, 55, 0.08);
  border: 1px solid rgba(26, 127, 55, 0.2);
  border-radius: var(--radius-md);
  min-width: 72px;
}

.metric-name {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.metric-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-primary-dark);
}
</style>
