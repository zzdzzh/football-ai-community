<script setup lang="ts">
defineProps<{
  formation: string;
}>();
</script>

<template>
  <span class="formation-badge" :title="`阵型 ${formation}`">
    {{ formation }}
  </span>
</template>

<style scoped>
.formation-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  background: rgba(27, 94, 32, 0.12);
  border: 1px solid rgba(27, 94, 32, 0.25);
}
</style>
