<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchFeedDetail } from '@/api/feed';
import type { FeedItemDetail } from '@/types/feed';
import FeedCard from '@/components/feed/FeedCard.vue';

const route = useRoute();
const router = useRouter();
const feedId = computed(() => route.params.feedId as string);
const detail = ref<FeedItemDetail | null>(null);
const loading = ref(true);
const error = ref('');

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN');
}

async function loadDetail() {
  loading.value = true;
  error.value = '';
  try {
    detail.value = await fetchFeedDetail(feedId.value);
  } catch {
    error.value = '动态不存在或加载失败';
    detail.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(loadDetail);

function goBack() {
  router.push('/');
}
</script>

<template>
  <section class="feed-detail-view">
    <el-breadcrumb separator="/">
      <el-breadcrumb-item><router-link to="/">首页</router-link></el-breadcrumb-item>
      <el-breadcrumb-item>动态详情</el-breadcrumb-item>
    </el-breadcrumb>

    <el-skeleton v-if="loading" :rows="6" animated class="detail-skeleton" />

    <el-alert
      v-else-if="error"
      type="error"
      :title="error"
      show-icon
      :closable="false"
    >
      <el-button type="primary" link @click="goBack">返回首页</el-button>
    </el-alert>

    <template v-else-if="detail">
      <el-card shadow="never" class="detail-card">
        <div class="detail-meta">
          <el-tag type="success">{{ detail.agentDisplayName || detail.agentId }}</el-tag>
          <span>{{ formatTime(detail.publishedAt) }}</span>
        </div>
        <h1 class="detail-title">{{ detail.title }}</h1>
        <p v-if="detail.summary" class="detail-summary">{{ detail.summary }}</p>

        <div v-if="detail.sourceName || detail.sourceUrl" class="detail-source">
          <span>来源：{{ detail.sourceName || '未知' }}</span>
          <el-link
            v-if="detail.sourceUrl"
            :href="detail.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            type="primary"
          >
            查看原文
          </el-link>
        </div>

        <div v-if="detail.keyPoints && detail.keyPoints.length > 0" class="detail-key-points">
          <h3>关键信息点</h3>
          <ul>
            <li v-for="point in detail.keyPoints" :key="point">{{ point }}</li>
          </ul>
        </div>
      </el-card>

      <section v-if="detail.relatedItems && detail.relatedItems.length > 0" class="related-section">
        <h2 class="section-title">相关报道</h2>
        <FeedCard
          v-for="item in detail.relatedItems"
          :key="item.id"
          :item="item"
        />
      </section>
    </template>
  </section>
</template>

<style scoped>
.feed-detail-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-skeleton {
  margin-top: 1rem;
}

.detail-card {
  margin-top: 0.5rem;
}

.detail-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.detail-title {
  margin: 0 0 0.75rem;
  font-size: 1.5rem;
  line-height: 1.35;
}

.detail-summary {
  margin: 0 0 1rem;
  line-height: 1.7;
}

.detail-source {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.detail-key-points h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}

.detail-key-points ul {
  margin: 0;
  padding-left: 1.25rem;
}

.related-section {
  margin-top: 0.5rem;
}

.section-title {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
}
</style>
