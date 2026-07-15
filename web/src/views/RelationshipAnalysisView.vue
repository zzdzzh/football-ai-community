<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { fetchCareerPlayer } from '@/api/career-players';
import {
  createPlayerPairAnalysis,
  getPlayerPairAnalysis,
  type DirectRelationVerdict,
  type GraphPayload,
  type OverlapDetail,
  type PathNode,
  type PlayerPairAnalysisResponse,
  type TimelinePayload,
} from '@/api/player-pair-analyses';
import FreshnessBanner from '@/components/relationship/FreshnessBanner.vue';
import RelationGraph from '@/components/relationship/RelationGraph.vue';
import RelationshipTimeline from '@/components/relationship/RelationshipTimeline.vue';

const route = useRoute();

const playerIdA = computed(() => route.params.playerIdA as string);
const playerIdB = computed(() => route.params.playerIdB as string);

const analysis = ref<PlayerPairAnalysisResponse | null>(null);
const loading = ref(false);
const retrying = ref(false);
const errorMessage = ref('');
const playerAName = ref('');
const playerBName = ref('');
const fallbackTimeline = ref<TimelinePayload | null>(null);
const timelineLoading = ref(false);

let pollTimer: ReturnType<typeof setTimeout> | null = null;

function verdictLabel(verdict: DirectRelationVerdict): string {
  switch (verdict.status) {
    case 'established':
      return '成立';
    case 'not_established':
      return '不成立';
    default:
      return '无法判定';
  }
}

function verdictTagType(verdict: DirectRelationVerdict): 'success' | 'info' | 'warning' {
  switch (verdict.status) {
    case 'established':
      return 'success';
    case 'not_established':
      return 'info';
    default:
      return 'warning';
  }
}

function formatOverlap(detail: OverlapDetail): string {
  const precision = detail.precision ? `（${detail.precision}）` : '';
  return `${detail.entityName}：${detail.overlapFrom} ～ ${detail.overlapTo}${precision}`;
}

function transferLinkLabel(linked: boolean): string {
  return linked ? '是' : '否';
}

function formatPathNodes(nodes: PathNode[]): string {
  return nodes.map((n) => n.name).join(' → ');
}

const timelineData = computed<TimelinePayload | null>(() => {
  if (analysis.value?.status !== 'ready' || !analysis.value.result) return null;
  if (analysis.value.result.timeline) return analysis.value.result.timeline;
  return fallbackTimeline.value;
});

const graphData = computed<GraphPayload | null>(() => {
  if (analysis.value?.status !== 'ready' || !analysis.value.result) return null;
  if (analysis.value.result.graph) return analysis.value.result.graph;
  const result = analysis.value.result;
  if (result.indirectPath) {
    return {
      nodes: result.indirectPath.nodes,
      edges: result.indirectPath.edges,
    };
  }
  return {
    nodes: [
      { type: 'player', id: playerIdA.value, name: playerAName.value || playerIdA.value },
      { type: 'player', id: playerIdB.value, name: playerBName.value || playerIdB.value },
    ],
    edges: [],
  };
});

async function loadPlayerNamesAndFallbackTimeline() {
  if (analysis.value?.status !== 'ready' || !analysis.value.result) return;

  timelineLoading.value = true;
  try {
    const [playerA, playerB] = await Promise.all([
      fetchCareerPlayer(playerIdA.value),
      fetchCareerPlayer(playerIdB.value),
    ]);
    playerAName.value = playerA.name;
    playerBName.value = playerB.name;

    if (!analysis.value.result.timeline) {
      fallbackTimeline.value = {
        playerATrack: playerA.clubStints.map((s) => ({
          clubId: s.clubId,
          clubName: s.clubName,
          from: s.joinedOn ?? '',
          to: s.leftOn ?? '',
          timePrecision: s.timePrecision,
        })).filter((s) => s.from && s.to),
        playerBTrack: playerB.clubStints.map((s) => ({
          clubId: s.clubId,
          clubName: s.clubName,
          from: s.joinedOn ?? '',
          to: s.leftOn ?? '',
          timePrecision: s.timePrecision,
        })).filter((s) => s.from && s.to),
        sharedHighlights: analysis.value.result.clubmateDetails ?? [],
      };
    }
  } catch {
    playerAName.value = playerIdA.value;
    playerBName.value = playerIdB.value;
  } finally {
    timelineLoading.value = false;
  }
}

watch(
  () => analysis.value?.status === 'ready' && analysis.value?.result,
  (ready) => {
    if (ready) {
      loadPlayerNamesAndFallbackTimeline();
    } else {
      fallbackTimeline.value = null;
      playerAName.value = '';
      playerBName.value = '';
    }
  },
);

function clearPoll() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function schedulePoll() {
  clearPoll();
  pollTimer = setTimeout(() => loadAnalysis(false), 2000);
}

async function loadAnalysis(showSkeleton = true) {
  if (showSkeleton) {
    loading.value = true;
    errorMessage.value = '';
  }
  try {
    const result = await getPlayerPairAnalysis(playerIdA.value, playerIdB.value);
    analysis.value = result;
    if (result.status === 'computing') {
      schedulePoll();
    } else {
      clearPoll();
    }
  } catch (err: unknown) {
    clearPoll();
    const response =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number; data?: { message?: string } } }).response
        : undefined;
    if (response?.status === 404) {
      errorMessage.value = '球员或分析记录不存在';
    } else if (response?.status === 400) {
      errorMessage.value = response?.data?.message || '请求参数无效（不可分析同一球员）';
    } else {
      errorMessage.value = response?.data?.message || '加载分析失败';
    }
  } finally {
    if (showSkeleton) loading.value = false;
  }
}

async function handleRetry() {
  retrying.value = true;
  errorMessage.value = '';
  try {
    const result = await createPlayerPairAnalysis(playerIdA.value, playerIdB.value);
    analysis.value = result;
    if (result.status === 'computing') {
      schedulePoll();
    }
  } catch (err: unknown) {
    const response =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response
        : undefined;
    ElMessage.error(response?.data?.message || '重试失败');
  } finally {
    retrying.value = false;
  }
}

onMounted(() => {
  loadAnalysis();
});

onBeforeUnmount(() => {
  clearPoll();
});
</script>

<template>
  <section class="relationship-analysis-view">
    <h1 class="page-title">球员关系分析</h1>
    <p class="page-subtitle">
      球员 A：{{ playerIdA }} · 球员 B：{{ playerIdB }}
    </p>

    <el-skeleton v-if="loading" :rows="6" animated />

    <el-alert v-else-if="errorMessage" type="error" :title="errorMessage" show-icon>
      <el-button type="primary" :loading="retrying" @click="handleRetry">重试</el-button>
    </el-alert>

    <template v-else-if="analysis">
      <FreshnessBanner
        v-if="analysis.dataFreshness?.summary"
        :summary="analysis.dataFreshness.summary"
        :used-cache-only="analysis.dataFreshness.usedCacheOnly"
      />

      <el-alert
        v-if="analysis.status === 'computing'"
        type="info"
        title="正在同步履历并计算关系，请稍候…"
        show-icon
        :closable="false"
      />

      <el-alert
        v-else-if="analysis.status === 'failed'"
        type="error"
        :title="analysis.error || '分析失败'"
        show-icon
      >
        <el-button type="primary" :loading="retrying" @click="handleRetry">重新分析</el-button>
      </el-alert>

      <template v-if="analysis.status === 'ready' && analysis.result">
        <div class="verdict-section">
          <h2 class="section-title">直接关系结论</h2>

          <div class="verdict-row">
            <span class="verdict-label">俱乐部队友</span>
            <el-tag :type="verdictTagType(analysis.result.clubmates)" size="large">
              {{ verdictLabel(analysis.result.clubmates) }}
            </el-tag>
            <span v-if="analysis.result.clubmates.reason" class="verdict-reason">
              {{ analysis.result.clubmates.reason }}
            </span>
          </div>

          <div class="verdict-row">
            <span class="verdict-label">国家队队友</span>
            <el-tag :type="verdictTagType(analysis.result.nationalTeammates)" size="large">
              {{ verdictLabel(analysis.result.nationalTeammates) }}
            </el-tag>
            <span v-if="analysis.result.nationalTeammates.reason" class="verdict-reason">
              {{ analysis.result.nationalTeammates.reason }}
            </span>
          </div>
        </div>

        <div
          v-if="analysis.result.clubmateDetails?.length"
          class="details-section"
        >
          <h3 class="subsection-title">共同俱乐部与共同时段</h3>
          <ul class="detail-list">
            <li v-for="detail in analysis.result.clubmateDetails" :key="detail.entityId">
              {{ formatOverlap(detail) }}
            </li>
          </ul>
        </div>

        <div
          v-if="analysis.result.nationalTeammateDetails?.length"
          class="details-section"
        >
          <h3 class="subsection-title">共同国家队与共同时段</h3>
          <ul class="detail-list">
            <li
              v-for="detail in analysis.result.nationalTeammateDetails"
              :key="detail.entityId"
            >
              {{ formatOverlap(detail) }}
            </li>
          </ul>
        </div>

        <el-empty
          v-if="
            !analysis.result.clubmateDetails?.length
              && !analysis.result.nationalTeammateDetails?.length
              && analysis.result.clubmates.status !== 'established'
              && analysis.result.nationalTeammates.status !== 'established'
          "
          description="未发现可展示的共同效力详情"
        />

        <div v-if="analysis.result.transfer" class="verdict-section">
          <h2 class="section-title">转会与先后加盟</h2>

          <div class="verdict-row">
            <span class="verdict-label">先后加盟同一球队</span>
            <el-tag
              :type="analysis.result.transfer.successiveSameClub ? 'success' : 'info'"
              size="large"
            >
              {{ transferLinkLabel(analysis.result.transfer.successiveSameClub) }}
            </el-tag>
          </div>

          <div class="verdict-row">
            <span class="verdict-label">直接转会关联</span>
            <el-tag
              :type="analysis.result.transfer.directTransferLink ? 'success' : 'info'"
              size="large"
            >
              {{ transferLinkLabel(analysis.result.transfer.directTransferLink) }}
            </el-tag>
          </div>

          <div
            v-if="analysis.result.transfer.evidence?.length"
            class="details-section inner-details"
          >
            <h3 class="subsection-title">依据摘要</h3>
            <ul class="detail-list">
              <li v-for="(item, idx) in analysis.result.transfer.evidence" :key="idx">
                {{ item }}
              </li>
            </ul>
          </div>
        </div>

        <div
          v-if="analysis.result.pathStatus && analysis.result.pathStatus !== 'skipped'"
          class="verdict-section"
        >
          <h2 class="section-title">间接关系路径</h2>

          <template v-if="analysis.result.pathStatus === 'found' && analysis.result.indirectPath">
            <div class="verdict-row">
              <span class="verdict-label">关系距离</span>
              <el-tag type="success" size="large">
                {{ analysis.result.relationDistance }}
              </el-tag>
            </div>
            <p class="path-sequence">
              {{ formatPathNodes(analysis.result.indirectPath.nodes) }}
            </p>
          </template>

          <el-alert
            v-else-if="analysis.result.pathStatus === 'no_path'"
            type="info"
            title="在跳数上限内未找到可达的间接关系路径"
            :closable="false"
            show-icon
          />
        </div>

        <div class="viz-section">
          <h2 class="section-title">关系时间线</h2>
          <el-skeleton v-if="timelineLoading && !timelineData" :rows="3" animated />
          <RelationshipTimeline
            v-else-if="timelineData"
            :player-a-name="playerAName || playerIdA"
            :player-b-name="playerBName || playerIdB"
            :player-a-track="timelineData.playerATrack"
            :player-b-track="timelineData.playerBTrack"
            :shared-highlights="timelineData.sharedHighlights"
          />
        </div>

        <div class="viz-section">
          <h2 class="section-title">关系图</h2>
          <RelationGraph
            v-if="graphData"
            :nodes="graphData.nodes"
            :edges="graphData.edges"
            :path-status="analysis.result.pathStatus"
          />
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped>
.relationship-analysis-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.verdict-section {
  padding: 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.subsection-title {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
  font-weight: 600;
}

.verdict-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.verdict-label {
  font-weight: 500;
  min-width: 6rem;
}

.verdict-reason {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.details-section {
  padding: 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.detail-list {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
}

.inner-details {
  padding: 0.75rem 0 0;
  background: transparent;
  border: none;
}

.path-sequence {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  word-break: break-word;
}

.viz-section {
  padding: 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>
