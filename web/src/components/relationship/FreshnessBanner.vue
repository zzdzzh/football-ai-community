<script setup lang="ts">
defineProps<{
  summary: string;
  usedCacheOnly?: boolean;
}>();
</script>

<template>
  <el-alert type="info" :closable="false" show-icon class="freshness-banner">
    <template #title>
      <span>{{ summary }}</span>
      <span v-if="usedCacheOnly" class="cache-note">（仅使用本地缓存，未触发外部同步）</span>
    </template>
  </el-alert>
</template>

<style scoped>
.freshness-banner {
  margin-bottom: 0.5rem;
}

.cache-note {
  font-weight: 400;
  opacity: 0.85;
}
</style>
