<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { submitContentReport } from '@/api/content-reports';

const props = defineProps<{
  visible: boolean;
  targetType: 'fan_discussion' | 'fan_discussion_turn';
  targetId: string;
  targetLabel?: string;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  submitted: [];
}>();

const reason = ref('');
const submitting = ref(false);

watch(
  () => props.visible,
  (open) => {
    if (open) reason.value = '';
  },
);

function closeDialog() {
  emit('update:visible', false);
}

async function handleSubmit() {
  const text = reason.value.trim();
  if (!text) {
    ElMessage.warning('请填写举报原因');
    return;
  }
  submitting.value = true;
  try {
    await submitContentReport({
      targetType: props.targetType,
      targetId: props.targetId,
      reason: text,
    });
    ElMessage.success('举报已提交，感谢反馈');
    emit('submitted');
    closeDialog();
  } catch (err: unknown) {
    const response =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number; data?: { message?: string } } }).response
        : undefined;
    if (response?.status === 409) {
      ElMessage.warning('24 小时内不可重复举报同一内容');
    } else {
      ElMessage.error(response?.data?.message || '提交举报失败');
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="举报不当内容"
    width="min(520px, 92vw)"
    @update:model-value="emit('update:visible', $event)"
  >
    <p v-if="targetLabel" class="target-label">举报对象：{{ targetLabel }}</p>
    <div class="field-block">
      <label class="field-label">举报原因</label>
      <el-input
        v-model="reason"
        type="textarea"
        :rows="4"
        maxlength="500"
        show-word-limit
        placeholder="请描述不当内容（1–500 字）"
      />
    </div>
    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">提交举报</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.target-label {
  margin: 0 0 0.75rem;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.85rem;
  font-weight: 500;
}
</style>
