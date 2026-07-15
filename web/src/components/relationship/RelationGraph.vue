<script setup lang="ts">
import { computed } from 'vue';
import type { GraphPayload, PathNode } from '@/api/player-pair-analyses';

const props = defineProps<{
  nodes: GraphPayload['nodes'];
  edges: GraphPayload['edges'];
  pathStatus?: 'found' | 'no_path' | 'skipped';
}>();

const NODE_W = 100;
const NODE_H = 32;
const ROW_GAP = 80;
const COL_GAP = 24;
const PADDING = 24;

const playerNodes = computed(() => props.nodes.filter((n) => n.type === 'player'));
const clubNodes = computed(() => props.nodes.filter((n) => n.type === 'club'));

const hasPath = computed(() => props.pathStatus === 'found' && props.edges.length > 0);

const layout = computed(() => {
  const positions = new Map<string, { x: number; y: number; node: PathNode }>();

  const placeRow = (nodes: PathNode[], rowY: number) => {
    const totalWidth = nodes.length * NODE_W + Math.max(0, nodes.length - 1) * COL_GAP;
    let x = PADDING + Math.max(0, (640 - totalWidth) / 2);
    for (const node of nodes) {
      positions.set(node.id, { x, y: rowY, node });
      x += NODE_W + COL_GAP;
    }
  };

  placeRow(playerNodes.value, PADDING);
  placeRow(clubNodes.value, PADDING + NODE_H + ROW_GAP);

  const width = Math.max(
    320,
    PADDING * 2
      + Math.max(playerNodes.value.length, clubNodes.value.length) * (NODE_W + COL_GAP),
  );
  const height = PADDING * 2 + NODE_H * 2 + ROW_GAP;

  return { positions, width, height };
});

const edgeLines = computed(() => {
  const { positions } = layout.value;
  return props.edges
    .map((edge) => {
      const fromPos = resolvePosition(edge.from, positions);
      const toPos = resolvePosition(edge.to, positions);
      if (!fromPos || !toPos) return null;
      return {
        x1: fromPos.x + NODE_W / 2,
        y1: fromPos.y + NODE_H / 2,
        x2: toPos.x + NODE_W / 2,
        y2: toPos.y + NODE_H / 2,
      };
    })
    .filter(Boolean) as { x1: number; y1: number; x2: number; y2: number }[];
});

function resolvePosition(
  edgeRef: string,
  positions: Map<string, { x: number; y: number; node: PathNode }>,
) {
  for (const [, pos] of positions) {
    const key = `${pos.node.type}:${pos.node.id}`;
    if (key === edgeRef || pos.node.id === edgeRef) return pos;
  }
  const colonIdx = edgeRef.indexOf(':');
  if (colonIdx >= 0) {
    const id = edgeRef.slice(colonIdx + 1);
    const pos = positions.get(id);
    if (pos) return pos;
  }
  return null;
}

function truncateName(name: string, max = 14): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

const showEmptyMessage = computed(
  () =>
    props.pathStatus === 'no_path'
    || props.pathStatus === 'skipped'
    || (!hasPath.value && playerNodes.value.length <= 2 && clubNodes.value.length === 0),
);
</script>

<template>
  <div class="relation-graph">
    <el-empty
      v-if="nodes.length === 0"
      description="暂无关系图数据"
    />

    <template v-else>
      <p v-if="showEmptyMessage" class="graph-hint">
        在跳数上限内未找到间接关系路径，仅展示两名球员节点。
      </p>

      <div class="graph-scroll">
        <svg
          :width="layout.width"
          :height="layout.height"
          class="graph-svg"
          role="img"
          aria-label="球员关系图"
        >
          <!-- 连接线 -->
          <g class="edges-layer">
            <line
              v-for="(line, idx) in edgeLines"
              :key="`edge-${idx}`"
              :x1="line.x1"
              :y1="line.y1"
              :x2="line.x2"
              :y2="line.y2"
              class="edge-line"
            />
          </g>

          <!-- 节点 -->
          <g class="nodes-layer">
            <g
              v-for="[nodeId, pos] in layout.positions"
              :key="nodeId"
              :transform="`translate(${pos.x}, ${pos.y})`"
            >
              <rect
                :width="NODE_W"
                :height="NODE_H"
                rx="4"
                :class="['node-rect', pos.node.type === 'player' ? 'node-player' : 'node-club']"
              />
              <text
                :x="NODE_W / 2"
                :y="NODE_H / 2 + 4"
                text-anchor="middle"
                class="node-label"
              >
                {{ truncateName(pos.node.name) }}
              </text>
            </g>
          </g>
        </svg>
      </div>

      <div class="graph-legend">
        <span class="legend-item"><span class="swatch player" />球员</span>
        <span class="legend-item"><span class="swatch club" />俱乐部</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.relation-graph {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.graph-hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.graph-scroll {
  overflow-x: auto;
}

.graph-svg {
  display: block;
  min-width: 100%;
}

.edge-line {
  stroke: var(--color-border);
  stroke-width: 1.5;
}

.node-rect {
  stroke-width: 1;
}

.node-player {
  fill: var(--el-color-primary-light-7, #ecf5ff);
  stroke: var(--el-color-primary, #409eff);
}

.node-club {
  fill: var(--el-color-warning-light-7, #faecd8);
  stroke: var(--el-color-warning, #e6a23c);
}

.node-label {
  font-size: 0.75rem;
  fill: var(--color-text);
  pointer-events: none;
}

.graph-legend {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid var(--color-border);
}

.swatch.player {
  background: var(--el-color-primary-light-7, #ecf5ff);
  border-color: var(--el-color-primary, #409eff);
}

.swatch.club {
  background: var(--el-color-warning-light-7, #faecd8);
  border-color: var(--el-color-warning, #e6a23c);
}
</style>
