<script setup lang="ts">
import type { PlayerRecommendation } from '@/types/scout';

defineProps<{
  recommendation: PlayerRecommendation;
}>();
</script>

<template>
  <article class="recommendation-card">
    <header class="card-header">
      <div>
        <h3 class="player-name">{{ recommendation.playerName }}</h3>
        <p class="player-meta">
          <span v-if="recommendation.position">{{ recommendation.position }}</span>
          <span v-if="recommendation.position && recommendation.teamName"> · </span>
          <span>{{ recommendation.teamName }}</span>
        </p>
      </div>
    </header>

    <p class="match-reason">{{ recommendation.matchReason }}</p>

    <ul v-if="recommendation.keyStats?.length" class="key-stats">
      <li v-for="(stat, idx) in recommendation.keyStats" :key="`${stat.name}-${idx}`">
        <span class="stat-name">{{ stat.name }}</span>
        <span class="stat-value">
          {{ stat.value }}<span v-if="stat.unit">{{ stat.unit }}</span>
        </span>
      </li>
    </ul>
  </article>
</template>

<style scoped>
.recommendation-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.85rem 1rem;
  background: var(--color-bg);
}

.card-header {
  margin-bottom: 0.5rem;
}

.player-name {
  margin: 0;
  font-size: 1rem;
  color: var(--color-primary-dark);
}

.player-meta {
  margin: 0.2rem 0 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.match-reason {
  margin: 0 0 0.75rem;
  font-size: 0.92rem;
  line-height: 1.5;
}

.key-stats {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 0.5rem;
}

.key-stats li {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.45rem 0.55rem;
  border-radius: var(--radius-sm);
  background: rgba(27, 94, 32, 0.06);
}

.stat-name {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.stat-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-primary-dark);
}
</style>
