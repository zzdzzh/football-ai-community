<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { IdentityLinkState, PlayerIdentityLinkStatusItem } from '@/api/player-identity-links';

const props = defineProps<{
  status: PlayerIdentityLinkStatusItem | null;
  loading?: boolean;
}>();

const router = useRouter();

const linkState = computed<IdentityLinkState | 'loading'>(() => {
  if (props.loading) return 'loading';
  return props.status?.linkState ?? 'unlinked';
});

const label = computed(() => {
  switch (linkState.value) {
    case 'linked':
      return '统计域已关联';
    case 'pending_confirmation':
      return '待确认';
    case 'loading':
      return '关联状态加载中…';
    default:
      return '暂未关联统计库';
  }
});

const tagType = computed(() => {
  switch (linkState.value) {
    case 'linked':
      return 'success';
    case 'pending_confirmation':
      return 'warning';
    default:
      return 'info';
  }
});

const canNavigate = computed(() => {
  const state = linkState.value;
  const path = props.status?.statsEntryPath;
  const statsId = props.status?.statsPlayerId;
  return (state === 'linked' || state === 'pending_confirmation') && Boolean(path) && Boolean(statsId);
});

function goStatsEntry() {
  if (!canNavigate.value || !props.status?.statsPlayerId) return;
  router.push(`/players/${props.status.statsPlayerId}`);
}
</script>

<template>
  <div class="identity-badge">
    <el-tag :type="tagType" size="small" effect="plain">{{ label }}</el-tag>
    <a
      v-if="canNavigate"
      class="identity-badge__link"
      href="#"
      @click.prevent="goStatsEntry"
    >
      查看统计入口
    </a>
    <!-- unlinked：故意不渲染 <a>，避免失效链接 -->
  </div>
</template>

<style scoped>
.identity-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  max-width: 100%;
}

.identity-badge__link {
  font-size: 13px;
  color: var(--el-color-primary);
  text-decoration: none;
  white-space: nowrap;
}

.identity-badge__link:hover {
  text-decoration: underline;
}
</style>
