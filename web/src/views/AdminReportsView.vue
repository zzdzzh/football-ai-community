<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  dismissContentReport,
  fetchAdminContentReports,
  hideContentReport,
} from '@/api/content-reports';
import type { ContentReport } from '@/types/fan';

type ReportStatus = 'pending' | 'hidden' | 'dismissed';

const status = ref<ReportStatus>('pending');
const items = ref<ContentReport[]>([]);
const loading = ref(false);
const actingReportId = ref<string | null>(null);

const statusOptions: { value: ReportStatus; label: string }[] = [
  { value: 'pending', label: '待处理' },
  { value: 'hidden', label: '已隐藏' },
  { value: 'dismissed', label: '已驳回' },
];

const emptyText = computed(() => {
  if (status.value === 'pending') return '暂无待处理举报';
  if (status.value === 'hidden') return '暂无已隐藏记录';
  return '暂无已驳回记录';
});

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN');
}

function formatTargetType(value: ContentReport['targetType']) {
  return value === 'fan_discussion' ? '整段讨论' : '单条发言';
}

async function loadReports() {
  loading.value = true;
  try {
    const result = await fetchAdminContentReports({ status: status.value, page: 1, pageSize: 50 });
    items.value = result.items;
  } catch (err: unknown) {
    const response =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number; data?: { message?: string } } }).response
        : undefined;
    if (response?.status === 403) {
      ElMessage.error('无权限访问举报审核');
    } else {
      ElMessage.error(response?.data?.message || '加载举报列表失败');
    }
    items.value = [];
  } finally {
    loading.value = false;
  }
}

async function handleHide(report: ContentReport) {
  try {
    await ElMessageBox.confirm(
      report.targetType === 'fan_discussion'
        ? '隐藏整段讨论后，首页 Feed 将不再展示该条目。'
        : '隐藏该条发言后，公众将不再看到此内容。',
      '确认隐藏',
      { type: 'warning', confirmButtonText: '隐藏', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }

  actingReportId.value = report.id;
  try {
    await hideContentReport(report.id);
    ElMessage.success('内容已隐藏');
    await loadReports();
  } catch (err: unknown) {
    const response =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response
        : undefined;
    ElMessage.error(response?.data?.message || '隐藏失败');
  } finally {
    actingReportId.value = null;
  }
}

async function handleDismiss(report: ContentReport) {
  actingReportId.value = report.id;
  try {
    await dismissContentReport(report.id);
    ElMessage.success('举报已驳回');
    await loadReports();
  } catch (err: unknown) {
    const response =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response
        : undefined;
    ElMessage.error(response?.data?.message || '驳回失败');
  } finally {
    actingReportId.value = null;
  }
}

watch(status, loadReports);
onMounted(loadReports);
</script>

<template>
  <section class="admin-reports-view">
    <h1 class="page-title">举报审核</h1>
    <p class="page-subtitle">处理用户举报的 Fan 讨论内容，隐藏后 Feed 将不再展示</p>

    <el-tabs v-model="status" class="status-tabs">
      <el-tab-pane
        v-for="option in statusOptions"
        :key="option.value"
        :label="option.label"
        :name="option.value"
      />
    </el-tabs>

    <el-table v-loading="loading" :data="items" stripe empty-text=" ">
      <template #empty>
        <el-empty :description="emptyText" />
      </template>
      <el-table-column label="类型" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="row.targetType === 'fan_discussion' ? 'danger' : 'warning'">
            {{ formatTargetType(row.targetType) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="目标摘要" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.targetSummary || row.targetId }}
        </template>
      </el-table-column>
      <el-table-column label="举报原因" min-width="180" show-overflow-tooltip prop="reason" />
      <el-table-column label="提交时间" width="170">
        <template #default="{ row }">
          {{ formatTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column v-if="status === 'pending'" label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button
            type="danger"
            link
            :loading="actingReportId === row.id"
            @click="handleHide(row)"
          >
            隐藏
          </el-button>
          <el-button
            type="primary"
            link
            :loading="actingReportId === row.id"
            @click="handleDismiss(row)"
          >
            驳回
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </section>
</template>

<style scoped>
.admin-reports-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.status-tabs {
  margin-top: -0.25rem;
}
</style>
