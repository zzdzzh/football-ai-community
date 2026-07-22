<script setup lang="ts">
import FeedList from '@/components/feed/FeedList.vue';
</script>

<template>
  <section class="home-view">
    <h1 class="page-title">社区首页</h1>
    <p class="page-subtitle">新闻、赛后战报与社区动态分区展示</p>
    <FeedList />
  </section>
</template>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

@media (max-width: 640px) {
  .home-view .page-title {
    font-size: 1.25rem;
  }

  .home-view .page-subtitle {
    font-size: 0.9rem;
  }
}
</style>
