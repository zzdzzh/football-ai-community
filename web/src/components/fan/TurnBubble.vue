<script setup lang="ts">
import type { FanDiscussionTurn } from '@/types/fan';

defineProps<{
  turn: FanDiscussionTurn;
}>();
</script>

<template>
  <article
    class="turn-bubble"
    :class="{
      'turn-bubble--user': turn.role === 'user',
      'turn-bubble--persona': turn.role === 'persona',
      'turn-bubble--hidden': turn.isHidden,
    }"
  >
    <header class="turn-bubble__header">
      <span v-if="turn.role === 'user'" class="turn-bubble__label">我</span>
      <template v-else>
        <span class="turn-bubble__label">{{ turn.personaDisplayName || 'Persona' }}</span>
        <el-tag v-if="turn.teamName" size="small" class="team-tag">{{ turn.teamName }}</el-tag>
      </template>
    </header>
    <p class="turn-bubble__content">
      {{ turn.isHidden ? '该发言已被隐藏' : turn.content }}
    </p>
  </article>
</template>

<style scoped>
.turn-bubble {
  max-width: min(100%, 720px);
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.turn-bubble--user {
  margin-left: auto;
  background: rgba(27, 94, 32, 0.06);
  border-color: rgba(27, 94, 32, 0.2);
}

.turn-bubble--persona {
  margin-right: auto;
}

.turn-bubble--hidden {
  opacity: 0.7;
  font-style: italic;
}

.turn-bubble__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.turn-bubble__label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #1b5e20;
}

.team-tag {
  --el-tag-bg-color: rgba(27, 94, 32, 0.1);
  --el-tag-border-color: rgba(27, 94, 32, 0.25);
  --el-tag-text-color: #1b5e20;
}

.turn-bubble__content {
  margin: 0;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
