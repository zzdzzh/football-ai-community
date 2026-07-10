<script setup lang="ts">
import FeedList from '@/components/feed/FeedList.vue';
</script>

<template>
  <section class="home-view">
    <h1 class="page-title">社区首页</h1>
    <p class="page-subtitle">浏览 News Agent 抓取并摘要的最新足球新闻</p>
    <FeedList />
  </section>
</template>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
