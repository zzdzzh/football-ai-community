<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchPlayer } from '@/api/players';
import type { PlayerDetail } from '@/types/scout';

const route = useRoute();
const router = useRouter();

const playerId = computed(() => route.params.playerId as string);
const player = ref<PlayerDetail | null>(null);
const loading = ref(false);
const errorMessage = ref('');

async function loadPlayer() {
  if (!playerId.value) {
    errorMessage.value = '缺少球员 ID';
    return;
  }
  loading.value = true;
  errorMessage.value = '';
  try {
    player.value = await fetchPlayer(playerId.value);
  } catch (err: unknown) {
    const response =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number; data?: { message?: string } } }).response
        : undefined;
    if (response?.status === 404) {
      errorMessage.value = '未找到该统计域球员';
    } else {
      errorMessage.value = response?.data?.message || '加载球员信息失败';
    }
    player.value = null;
  } finally {
    loading.value = false;
  }
}

function goScout() {
  const name = player.value?.name || playerId.value;
  router.push({
    path: '/scout',
    query: {
      q: name,
      playerId: playerId.value,
      hint: `围绕统计域球员「${name}」进行推荐与分析`,
    },
  });
}

function goBack() {
  router.back();
}

onMounted(loadPlayer);
watch(playerId, loadPlayer);
</script>

<template>
  <section class="player-stats-entry">
    <div class="page-nav">
      <el-button text type="primary" @click="goBack">← 返回</el-button>
    </div>
    <h1 class="page-title">统计域球员</h1>
    <p class="page-subtitle">球员 ID：{{ playerId }}</p>

    <el-skeleton v-if="loading" :rows="4" animated />

    <el-alert
      v-else-if="errorMessage"
      type="error"
      :title="errorMessage"
      show-icon
      :closable="false"
    />

    <template v-else-if="player">
      <div class="info-block">
        <h2 class="player-name">{{ player.name }}</h2>
        <p class="meta-line">
          <span>{{ player.teamName }}</span>
          <span v-if="player.position"> · {{ player.position }}</span>
          <span v-if="player.nationality"> · {{ player.nationality }}</span>
          <span v-if="player.age != null"> · {{ player.age }} 岁</span>
        </p>
        <p class="meta-line muted">联赛：{{ player.leagueCode }}</p>
      </div>

      <div v-if="player.stats?.length" class="stats-block">
        <h3 class="section-title">关键统计</h3>
        <ul class="stat-list">
          <li v-for="stat in player.stats.slice(0, 8)" :key="stat.name">
            <span class="stat-name">{{ stat.name }}</span>
            <span class="stat-value">{{ stat.value }}{{ stat.unit || '' }}</span>
          </li>
        </ul>
      </div>

      <div class="actions">
        <el-button type="primary" @click="goScout">用 Scout 分析该球员</el-button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.player-stats-entry {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px 20px 40px;
}

.page-nav {
  margin-bottom: 8px;
}

.page-title {
  margin: 0 0 4px;
  font-size: 22px;
  font-weight: 700;
}

.page-subtitle {
  margin: 0 0 20px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  word-break: break-all;
}

.info-block {
  margin-bottom: 20px;
}

.player-name {
  margin: 0 0 8px;
  font-size: 20px;
}

.meta-line {
  margin: 0 0 4px;
  font-size: 14px;
}

.meta-line.muted {
  color: var(--el-text-color-secondary);
}

.section-title {
  margin: 0 0 10px;
  font-size: 16px;
}

.stat-list {
  list-style: none;
  margin: 0 0 20px;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px 16px;
  max-width: 360px;
}

.stat-list li {
  display: contents;
}

.stat-name {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.stat-value {
  font-size: 13px;
  font-weight: 600;
  text-align: right;
}

.actions {
  margin-top: 8px;
}
</style>
