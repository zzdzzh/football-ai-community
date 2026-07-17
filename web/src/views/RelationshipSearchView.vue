<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import PlayerPicker from '@/components/relationship/PlayerPicker.vue';
import type { CareerPlayerCandidate } from '@/api/career-players';

const router = useRouter();

const playerA = ref<CareerPlayerCandidate | null>(null);
const playerB = ref<CareerPlayerCandidate | null>(null);

const canSubmit = computed(() => {
  if (!playerA.value || !playerB.value) return false;
  return playerA.value.id !== playerB.value.id;
});

function submit() {
  if (!canSubmit.value || !playerA.value || !playerB.value) return;
  router.push(`/relationships/${playerA.value.id}/${playerB.value.id}`);
}
</script>

<template>
  <section class="relationship-search-view">
    <h1 class="page-title">球员关系分析</h1>
    <p class="page-subtitle">用英文名搜索并选定两名球员，分析俱乐部队友与国家队队友关系</p>

    <div class="picker-row">
      <PlayerPicker v-model="playerA" label="球员 A" />
      <PlayerPicker v-model="playerB" label="球员 B" />
    </div>

    <div class="actions">
      <el-button type="primary" size="large" :disabled="!canSubmit" @click="submit">
        开始分析
      </el-button>
      <p v-if="playerA && playerB && playerA.id === playerB.id" class="hint warn">
        请选择两名不同的球员
      </p>
      <p v-else class="hint">重名球员须从候选列表中点击选定，不可自动选取</p>
    </div>
  </section>
</template>

<style scoped>
.relationship-search-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.picker-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  padding: 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

@media (min-width: 768px) {
  .picker-row {
    grid-template-columns: 1fr 1fr;
  }
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

.hint.warn {
  color: #c62828;
}
</style>
