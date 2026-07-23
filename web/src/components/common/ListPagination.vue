<script setup lang="ts">
defineProps<{
  page: number;
  pageSize: number;
  total: number;
}>();

const emit = defineEmits<{
  'update:page': [page: number];
}>();
</script>

<template>
  <div v-if="total > 0" class="list-pagination">
    <el-pagination
      background
      layout="total, prev, pager, next"
      :current-page="page"
      :page-size="pageSize"
      :total="total"
      :hide-on-single-page="false"
      @current-change="emit('update:page', $event)"
    />
  </div>
</template>

<style scoped>
.list-pagination {
  display: flex;
  justify-content: center;
  padding: 0.75rem 0 0.25rem;
  overflow-x: auto;
}
</style>
