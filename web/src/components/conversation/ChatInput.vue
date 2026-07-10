<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  disabled?: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{
  send: [content: string];
}>();

const content = ref('');

function handleSend() {
  const text = content.value.trim();
  if (!text || props.disabled || props.loading) return;
  emit('send', text);
  content.value = '';
}
</script>

<template>
  <div class="chat-input">
    <label class="field-label" for="stats-chat-input">向 Stats Agent 提问</label>
    <div class="input-row">
      <el-input
        id="stats-chat-input"
        v-model="content"
        type="textarea"
        :rows="3"
        :disabled="disabled || loading"
        placeholder="例如：这场比赛控球与射门表现如何？"
        maxlength="2000"
        show-word-limit
        @keydown.ctrl.enter="handleSend"
      />
      <el-button
        type="primary"
        :loading="loading"
        :disabled="disabled || !content.trim()"
        @click="handleSend"
      >
        发送
      </el-button>
    </div>
    <p class="hint">Ctrl + Enter 快捷发送 · 回复通常在 30 秒内返回</p>
  </div>
</template>

<style scoped>
.chat-input {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text);
}

.input-row {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

@media (min-width: 640px) {
  .input-row {
    flex-direction: row;
    align-items: flex-end;
  }

  .input-row :deep(.el-textarea) {
    flex: 1;
  }
}

.hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
</style>
