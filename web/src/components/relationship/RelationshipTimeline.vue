<script setup lang="ts">
import { computed } from 'vue';
import type { OverlapDetail, TimelineItem } from '@/api/player-pair-analyses';

const props = defineProps<{
  playerAName: string;
  playerBName: string;
  playerATrack: TimelineItem[];
  playerBTrack: TimelineItem[];
  sharedHighlights: OverlapDetail[];
}>();

const TRACK_HEIGHT = 36;
const LABEL_WIDTH = 120;
const AXIS_HEIGHT = 24;
const PADDING_X = 12;
const SVG_HEIGHT = TRACK_HEIGHT * 2 + AXIS_HEIGHT + 16;

function parseYear(dateStr: string): number {
  return Number.parseInt(dateStr.slice(0, 4), 10);
}

function dateToYearFraction(dateStr: string): number {
  const year = parseYear(dateStr);
  const month = Number.parseInt(dateStr.slice(5, 7) || '1', 10);
  const day = Number.parseInt(dateStr.slice(8, 10) || '1', 10);
  const dayOfYear = (month - 1) * 30 + day;
  return year + dayOfYear / 365;
}

const hasTracks = computed(
  () => props.playerATrack.length > 0 || props.playerBTrack.length > 0,
);

const yearRange = computed(() => {
  const years: number[] = [];
  for (const item of [...props.playerATrack, ...props.playerBTrack]) {
    years.push(parseYear(item.from), parseYear(item.to));
  }
  for (const h of props.sharedHighlights) {
    years.push(parseYear(h.overlapFrom), parseYear(h.overlapTo));
  }
  if (years.length === 0) {
    const current = new Date().getFullYear();
    return { min: current - 5, max: current };
  }
  return { min: Math.min(...years), max: Math.max(...years) };
});

const axisTicks = computed(() => {
  const { min, max } = yearRange.value;
  const span = Math.max(max - min, 1);
  const step = span <= 10 ? 1 : span <= 30 ? 5 : 10;
  const ticks: number[] = [];
  const start = Math.floor(min / step) * step;
  for (let y = start; y <= max + step; y += step) {
    if (y >= min - step && y <= max + step) ticks.push(y);
  }
  return ticks.length > 0 ? ticks : [min, max];
});

function xScale(value: number, chartWidth: number): number {
  const { min, max } = yearRange.value;
  const span = Math.max(max - min, 1);
  return PADDING_X + ((value - min) / span) * chartWidth;
}

function stintRect(item: TimelineItem, y: number, chartWidth: number) {
  const fromVal = dateToYearFraction(item.from);
  const toVal = dateToYearFraction(item.to);
  const x = xScale(fromVal, chartWidth);
  const endX = xScale(toVal, chartWidth);
  const width = Math.max(endX - x, 4);
  return { x, y, width, label: item.clubName };
}

function highlightRect(highlight: OverlapDetail, chartWidth: number) {
  const fromVal = dateToYearFraction(highlight.overlapFrom);
  const toVal = dateToYearFraction(highlight.overlapTo);
  const x = xScale(fromVal, chartWidth);
  const endX = xScale(toVal, chartWidth);
  return { x, width: Math.max(endX - x, 4) };
}

function buildTrackRects(track: TimelineItem[], trackIndex: number, chartWidth: number) {
  const y = 8 + trackIndex * (TRACK_HEIGHT + 8);
  return track.map((item) => stintRect(item, y, chartWidth));
}

const chartWidth = computed(() => 640);

const trackARects = computed(() => buildTrackRects(props.playerATrack, 0, chartWidth.value));
const trackBRects = computed(() => buildTrackRects(props.playerBTrack, 1, chartWidth.value));

const highlightRects = computed(() =>
  props.sharedHighlights.map((h) => highlightRect(h, chartWidth.value)),
);
</script>

<template>
  <div class="relationship-timeline">
    <el-empty v-if="!hasTracks" description="暂无俱乐部履历可展示" />

    <template v-else>
      <div class="timeline-scroll">
        <svg
          :width="chartWidth + LABEL_WIDTH + PADDING_X * 2"
          :height="SVG_HEIGHT"
          class="timeline-svg"
          role="img"
          aria-label="双球员俱乐部效力时间线"
        >
          <!-- 共同效力高亮带 -->
          <g class="highlight-layer">
            <rect
              v-for="(rect, idx) in highlightRects"
              :key="`hl-${idx}`"
              :x="LABEL_WIDTH + rect.x"
              y="0"
              :width="rect.width"
              :height="SVG_HEIGHT - AXIS_HEIGHT"
              class="highlight-band"
            />
          </g>

          <!-- 球员 A 轨道 -->
          <text :x="0" :y="8 + TRACK_HEIGHT / 2 + 4" class="track-label">
            {{ playerAName }}
          </text>
          <g class="track-layer">
            <rect
              v-for="(rect, idx) in trackARects"
              :key="`a-${idx}`"
              :x="LABEL_WIDTH + rect.x"
              :y="rect.y"
              :width="rect.width"
              :height="TRACK_HEIGHT - 8"
              rx="3"
              class="stint-bar stint-a"
            >
              <title>{{ rect.label }}</title>
            </rect>
          </g>

          <!-- 球员 B 轨道 -->
          <text :x="0" :y="8 + TRACK_HEIGHT + 8 + TRACK_HEIGHT / 2 + 4" class="track-label">
            {{ playerBName }}
          </text>
          <g class="track-layer">
            <rect
              v-for="(rect, idx) in trackBRects"
              :key="`b-${idx}`"
              :x="LABEL_WIDTH + rect.x"
              :y="rect.y"
              :width="rect.width"
              :height="TRACK_HEIGHT - 8"
              rx="3"
              class="stint-bar stint-b"
            >
              <title>{{ rect.label }}</title>
            </rect>
          </g>

          <!-- 年份轴 -->
          <g class="axis-layer" :transform="`translate(${LABEL_WIDTH}, ${SVG_HEIGHT - AXIS_HEIGHT})`">
            <line
              :x1="PADDING_X"
              y1="0"
              :x2="PADDING_X + chartWidth"
              y2="0"
              class="axis-line"
            />
            <g v-for="tick in axisTicks" :key="tick">
              <line
                :x1="xScale(tick, chartWidth)"
                y1="0"
                :x2="xScale(tick, chartWidth)"
                y2="6"
                class="axis-tick"
              />
              <text
                :x="xScale(tick, chartWidth)"
                y="18"
                text-anchor="middle"
                class="axis-label"
              >
                {{ tick }}
              </text>
            </g>
          </g>
        </svg>
      </div>

      <ul v-if="sharedHighlights.length" class="highlight-legend">
        <li v-for="h in sharedHighlights" :key="h.entityId">
          共同效力：{{ h.entityName }}（{{ h.overlapFrom }} ～ {{ h.overlapTo }}）
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.relationship-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.timeline-scroll {
  overflow-x: auto;
}

.timeline-svg {
  display: block;
  min-width: 100%;
}

.track-label {
  font-size: 0.8rem;
  font-weight: 500;
  fill: var(--color-text);
}

.stint-bar {
  cursor: default;
}

.stint-a {
  fill: var(--el-color-primary-light-5, #a0cfff);
  stroke: var(--el-color-primary, #409eff);
  stroke-width: 1;
}

.stint-b {
  fill: var(--el-color-success-light-5, #b3e19d);
  stroke: var(--el-color-success, #67c23a);
  stroke-width: 1;
}

.highlight-band {
  fill: var(--el-color-warning-light-7, #faecd8);
  opacity: 0.55;
}

.axis-line {
  stroke: var(--color-border);
  stroke-width: 1;
}

.axis-tick {
  stroke: var(--color-border);
  stroke-width: 1;
}

.axis-label {
  font-size: 0.7rem;
  fill: var(--color-text-muted);
}

.highlight-legend {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
</style>
