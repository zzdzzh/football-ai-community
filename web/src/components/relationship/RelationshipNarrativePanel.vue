<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  createRelationshipNarrative,
  type RelationshipNarrativeResponse,
} from '@/api/relationship-narratives';

const props = defineProps<{
  playerIdA: string;
  playerIdB: string;
  analysisReady: boolean;
}>();

const loading = ref(false);
const narrative = ref<RelationshipNarrativeResponse | null>(null);
const errorMessage = ref('');
const errorKind = ref<'timeout' | 'rate_limited' | 'verification' | 'other' | ''>('');

const canGenerate = computed(() => props.analysisReady && !loading.value);

watch(
  () => [props.playerIdA, props.playerIdB] as const,
  () => {
    narrative.value = null;
    errorMessage.value = '';
    errorKind.value = '';
  },
);

function mapError(err: unknown): { message: string; kind: typeof errorKind.value } {
  const axiosErr =
    err && typeof err === 'object'
      ? (err as {
        response?: { status?: number; data?: { error?: string; message?: string } };
        code?: string;
      })
      : undefined;

  const status = axiosErr?.response?.status;
  const code = axiosErr?.response?.data?.error;
  const msg = axiosErr?.response?.data?.message;

  if (status === 429 || code === 'rate_limited') {
    return { message: msg || '提问过于频繁，请稍后再试', kind: 'rate_limited' };
  }
  if (status === 408 || code === 'timeout' || axiosErr?.code === 'ECONNABORTED') {
    return { message: msg || '生成超时，请稍后重试；下方结构化结论仍可查看', kind: 'timeout' };
  }
  if (status === 422 || code === 'narrative_verification_failed') {
    return { message: msg || '叙事未通过事实核验，未采信', kind: 'verification' };
  }
  if (status === 409) {
    return { message: msg || '分析尚未就绪，请稍候再生成', kind: 'other' };
  }
  return { message: msg || '生成失败，请稍后重试', kind: 'other' };
}

async function handleGenerate(force = false) {
  if (!props.analysisReady || loading.value) return;

  loading.value = true;
  errorMessage.value = '';
  errorKind.value = '';
  try {
    const result = await createRelationshipNarrative(
      props.playerIdA,
      props.playerIdB,
      { force },
    );
    narrative.value = result;
    errorMessage.value = '';
    errorKind.value = '';
  } catch (err) {
    const mapped = mapError(err);
    // 已有成功叙事时，「重新生成」失败不应盖住正文，避免成功+报错并存
    if (narrative.value) {
      ElMessage.error(mapped.message);
    } else {
      errorMessage.value = mapped.message;
      errorKind.value = mapped.kind;
    }
  } finally {
    loading.value = false;
  }
}

defineExpose({
  clear: () => {
    narrative.value = null;
    errorMessage.value = '';
    errorKind.value = '';
  },
});
</script>

<template>
  <section class="narrative-panel">
    <h2 class="section-title">关系解读</h2>

    <el-alert
      v-if="!analysisReady"
      type="info"
      title="分析就绪后可生成关系解读"
      description="请等待履历同步与结构化结论完成。"
      :closable="false"
      show-icon
    />

    <template v-else>
      <div v-if="!narrative && !loading && !errorMessage" class="empty-cta">
        <p class="hint">基于本页结构化结论，生成一次性简体中文关系介绍。</p>
        <el-button type="primary" :disabled="!canGenerate" @click="handleGenerate(false)">
          生成关系解读
        </el-button>
      </div>

      <div v-if="loading" class="loading-block">
        <el-skeleton :rows="4" animated />
        <p class="loading-hint">正在生成关系解读，可能需要数十秒…</p>
      </div>

      <div v-else-if="narrative" class="success-block">
        <el-tag type="warning" effect="plain" class="ai-badge">
          由 AI 基于本页结构化结论生成
        </el-tag>
        <p class="narrative-text">{{ narrative.narrativeText }}</p>
        <div class="actions">
          <el-button text type="primary" :disabled="loading" @click="handleGenerate(true)">
            重新生成
          </el-button>
        </div>
      </div>

      <el-alert
        v-else-if="errorMessage"
        :type="errorKind === 'rate_limited' ? 'warning' : 'error'"
        :title="errorMessage"
        show-icon
        :closable="false"
        class="error-alert"
      >
        <el-button type="primary" size="small" :loading="loading" @click="handleGenerate(true)">
          {{ errorKind === 'rate_limited' ? '稍后重试' : '重试' }}
        </el-button>
      </el-alert>
    </template>
  </section>
</template>

<style scoped>
.narrative-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.section-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.empty-cta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.hint {
  margin: 0;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.loading-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.loading-hint {
  margin: 0;
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
}

.success-block {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.ai-badge {
  align-self: flex-start;
}

.narrative-text {
  margin: 0;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.error-alert {
  width: 100%;
}
</style>
