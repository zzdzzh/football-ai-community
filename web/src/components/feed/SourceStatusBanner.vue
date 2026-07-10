<script setup lang="ts">
defineProps<{
  warnings: string[];
}>();
</script>

<template>
  <el-alert
    v-if="warnings.length > 0"
    class="source-status-banner"
    type="warning"
    :closable="false"
    show-icon
    title="新闻源状态提示"
  >
    <ul class="warning-list">
      <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
    </ul>
  </el-alert>
</template>

<style scoped>
.source-status-banner {
  margin-bottom: 1rem;
}

.warning-list {
  margin: 0.25rem 0 0;
  padding-left: 1.25rem;
}
</style>
