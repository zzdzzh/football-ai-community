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
const searchedOnce = ref(false);

/** 少于此字数不发请求，减少噪声命中 */
const MIN_QUERY_LEN = 2;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let searchSeq = 0;

function formatDisambiguation(candidate: CareerPlayerCandidate): string {
  const parts: string[] = [];
  if (candidate.dateOfBirth) parts.push(candidate.dateOfBirth);
  if (candidate.primaryClubHint) parts.push(candidate.primaryClubHint);
  else if (candidate.currentClubName) parts.push(candidate.currentClubName);
  return parts.join(' · ');
}

async function doSearch(keyword: string) {
  const trimmed = keyword.trim();
  if (trimmed.length < MIN_QUERY_LEN) {
    candidates.value = [];
    showCandidates.value = false;
    searchedOnce.value = false;
    return;
  }
  const seq = ++searchSeq;
  searching.value = true;
  searchedOnce.value = true;
  try {
    const result = await searchCareerPlayers(trimmed, 15);
    if (seq !== searchSeq) return;
    candidates.value = result.items;
    showCandidates.value = true;
  } catch (err: unknown) {
    if (seq !== searchSeq) return;
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 503) {
      ElMessage.error('外部球员库暂不可用，请稍后重试或换英文名关键字');
    } else {
      ElMessage.error('搜索球员失败');
    }
    candidates.value = [];
    showCandidates.value = true;
  } finally {
    if (seq === searchSeq) searching.value = false;
  }
}

watch(query, (value) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  const trimmed = value.trim();
  if (trimmed.length < MIN_QUERY_LEN) {
    candidates.value = [];
    showCandidates.value = false;
    searchedOnce.value = false;
    return;
  }
  debounceTimer = setTimeout(() => doSearch(value), 400);
});

function selectCandidate(candidate: CareerPlayerCandidate) {
  modelValue.value = candidate;
  query.value = '';
  candidates.value = [];
  showCandidates.value = false;
  searchedOnce.value = false;
}

function clearSelection() {
  modelValue.value = null;
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  searchSeq += 1;
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
        placeholder="英文名，如 Messi / Haaland"
        clearable
        :loading="searching"
        @focus="showCandidates = candidates.length > 0 || searchedOnce"
        @keyup.enter="doSearch(query)"
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
      <p v-else-if="searching" class="empty-hint">正在搜索…</p>
      <p v-else-if="showCandidates && query.trim().length >= MIN_QUERY_LEN && !searching" class="empty-hint">
        未找到匹配球员。建议用英文名（如 Messi），并尽量写全姓或名
      </p>
      <p v-else-if="query.trim().length > 0 && query.trim().length < MIN_QUERY_LEN" class="empty-hint">
        请至少输入 {{ MIN_QUERY_LEN }} 个字符
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
  max-height: 280px;
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
