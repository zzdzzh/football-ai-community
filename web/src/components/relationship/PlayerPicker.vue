<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { searchCareerPlayers, type CareerPlayerCandidate } from '@/api/career-players';

defineProps<{
  label: string;
}>();

const modelValue = defineModel<CareerPlayerCandidate | null>('modelValue', { default: null });

const query = ref('');
const candidates = ref<CareerPlayerCandidate[]>([]);
const searching = ref(false);
const showCandidates = ref(false);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function formatDisambiguation(candidate: CareerPlayerCandidate): string {
  const parts: string[] = [];
  if (candidate.dateOfBirth) parts.push(candidate.dateOfBirth);
  if (candidate.primaryClubHint) parts.push(candidate.primaryClubHint);
  else if (candidate.currentClubName) parts.push(candidate.currentClubName);
  return parts.join(' · ');
}

async function doSearch(keyword: string) {
  if (!keyword.trim()) {
    candidates.value = [];
    showCandidates.value = false;
    return;
  }
  searching.value = true;
  try {
    const result = await searchCareerPlayers(keyword.trim(), 10);
    candidates.value = result.items;
    showCandidates.value = true;
  } catch {
    ElMessage.error('搜索球员失败');
    candidates.value = [];
  } finally {
    searching.value = false;
  }
}

watch(query, (value) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (!value.trim()) {
    candidates.value = [];
    showCandidates.value = false;
    return;
  }
  debounceTimer = setTimeout(() => doSearch(value), 300);
});

function selectCandidate(candidate: CareerPlayerCandidate) {
  modelValue.value = candidate;
  query.value = '';
  candidates.value = [];
  showCandidates.value = false;
}

function clearSelection() {
  modelValue.value = null;
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<template>
  <div class="player-picker">
    <label class="field-label">{{ label }}</label>

    <div v-if="modelValue" class="selected-row">
      <el-tag closable type="success" @close="clearSelection">
        {{ modelValue.name }}
        <span v-if="formatDisambiguation(modelValue)" class="chip-hint">
          （{{ formatDisambiguation(modelValue) }}）
        </span>
      </el-tag>
    </div>

    <template v-else>
      <el-input
        v-model="query"
        placeholder="输入球员姓名搜索"
        clearable
        :loading="searching"
        @focus="showCandidates = candidates.length > 0"
      />

      <ul v-if="showCandidates && candidates.length" class="candidate-list">
        <li
          v-for="candidate in candidates"
          :key="candidate.id"
          class="candidate-item"
          @click="selectCandidate(candidate)"
        >
          <span class="candidate-name">{{ candidate.name }}</span>
          <span v-if="formatDisambiguation(candidate)" class="candidate-hint">
            {{ formatDisambiguation(candidate) }}
          </span>
        </li>
      </ul>
      <p v-else-if="showCandidates && query.trim() && !searching" class="empty-hint">
        未找到匹配球员，请换个关键字
      </p>
    </template>
  </div>
</template>

<style scoped>
.player-picker {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.field-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text);
}

.selected-row {
  min-height: 32px;
}

.chip-hint {
  font-weight: 400;
  opacity: 0.85;
}

.candidate-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: #fff;
  max-height: 240px;
  overflow-y: auto;
}

.candidate-item {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
}

.candidate-item:last-child {
  border-bottom: none;
}

.candidate-item:hover {
  background: rgba(27, 94, 32, 0.06);
}

.candidate-name {
  display: block;
  font-weight: 600;
}

.candidate-hint {
  display: block;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: 0.15rem;
}

.empty-hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
</style>
