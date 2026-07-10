# Implementation Plan: Stats Agent 与 Content Agent

**Branch**: `002-football-stats-content` | **Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-football-stats-content/spec.md`

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

**Prerequisites**: [001-football-feed-mvp](../001-football-feed-mvp/spec.md) 已完成（认证、Feed、News Agent、偏好）

## Summary

在 MVP-1 脚手架之上交付 MVP-2：集成 football-data.org v4 同步英超/西甲/德甲/意甲/法甲/欧冠比赛与球队数据；实现 Stats Agent 自然语言数据解读对话（`/conversations/:conversationId`）；实现 Content Agent 赛后报道自动生成并发布至 Feed（`/matches/:matchId`）。数据持久化 SQLite，AI 经 `AiAnalysisService` / `AiContentService` 统一抽象层调用。本 spec 含 2 个 User Story（P1 Stats、P2 Content），符合 Constitution 原则 XII。

## Technical Context

**Language/Version**: Node.js 20 LTS（后台）；Vue 3.4+ / TypeScript 5.x（前台）

**Primary Dependencies**:
- 后台（沿用）：Express 4.x、better-sqlite3、jsonwebtoken、node-cron、zod、swagger-ui-express
- 后台（新增）：无额外 npm 包；football-data.org 经 `fetch` + 自研 `FootballDataAdapter` 访问
- 前台（沿用）：Vite 5.x、Element Plus、Vue Router、Pinia、axios
- AI：`AiAnalysisService`（Stats 解读）+ `AiContentService`（Content 战报）；共用 OpenAI 兼容适配器

**Storage**: SQLite（`server/data/community.db`）；新增 `teams`、`matches`、`conversations`、`messages`、`match_sync_meta` 表；扩展 `feed_items`

**Testing**: Jest（`server/` contract + unit）；Stats/Content AI 路径 Mock 适配器，100% 分支覆盖；前台人工测试

**Target Platform**: Windows 开发 + Node.js 后台 + Vue 3 浏览器前台

**Project Type**: Web 应用（前后端分离）

**Performance Goals**:
- Stats 对话 API p95 < 30s（含 AI，对齐 SC-002）
- 比赛列表 API p95 < 300ms（SQLite 缓存命中）
- 赛后报道：比赛 FINISHED 后 15 分钟内触达 80% 已覆盖场次（SC-003）
- football-data.org 请求 ≤ 8 req/min（低于免费层 10 req/min 上限）

**Constraints**:
- 前台 Vite dev server 监听 `0.0.0.0`
- Stats Agent 超时 30s；Content Agent 超时 60s（沿用 AgentProfile 种子配置）
- 缺少数据时禁止编造比分/事件（FR-012、FR-025）
- 脚本使用 PowerShell；文件 UTF-8
- 多模块：User/FeedItem/Auth 直接引用 [001 data-model](../001-football-feed-mvp/data-model.md) 与 [001 contracts](../001-football-feed-mvp/contracts/openapi.yaml)，不在本模块修改对端定义

**Scale/Scope**:
- 6 个联赛（PL/PD/BL1/SA/FL1/CL）
- 每联赛赛季约 380 场比赛量级；SQLite 本地缓存全量当前赛季
- 2 个新前台页面 + 1 个对话页 + Feed 类型扩展
- 预估 tasks ≤ 28（符合原则 XII ≤30）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 判定 | 理由（关联本 plan 的具体方案要素） |
|------|------|-----------------------------------|
| I. 前后端分离架构 | ✅ PASS | `web/` + `server/` + SQLite；路由 `/conversations/:id`、`/matches/:id` |
| II. 契约优先 | ✅ PASS | `contracts/openapi.yaml` 先定义 Matches/Conversations/Internal Jobs |
| III. 测试纪律 | ✅ PASS | Stats/Content/Match-sync 契约测试 + AI 路径 Mock 100% 分支 |
| IV. AI/LLM 外部服务治理 | ✅ PASS | `AiAnalysisService` + 外置 `prompts/stats-*.md`、`prompts/match-report.md` |
| V. 可观测性优先 | ✅ PASS | 沿用 request-id 日志；新增 match-sync 指标与 AI 调用日志 |
| VI. 简单优先 (YAGNI) | ✅ PASS | 无 Redis/消息队列；SQLite 缓存 + 内存速率限制 |
| VII. 安全与权限 | ✅ PASS | Conversation 按 `user_id` 隔离；Internal Job 需 `X-Internal-Key` |
| VIII. 用户界面可视化验证 | ✅ PASS | 对话页/比赛页人工截图 + 从首页进子页路径验收 |
| IX. 用户界面视觉质量标准 | ✅ PASS | 沿用 `#1B5E20` 品牌色；比赛页时间线 + 空/加载/错误态 |
| X. Corrector 修正回归纪律 | ✅ PASS | BUG 追溯 tasks.md 任务 ID |
| XI. 模块边界纪律 | ✅ PASS | External Dependencies 显式消费 001 的 User/FeedItem/Auth |
| XII. Spec 颗粒度纪律 | ✅ PASS | 2 个 US；预估 ≤28 task |

**Gate Result**: ALL PASS — 可进入 Phase 0 研究与 Phase 1 设计

**高风险路径标记（L4 审查）**: Stats Agent AI 解读（FR-009–012）、Content Agent 战报生成（FR-023–025）— 须 Mock + 真实调用各至少 1 次端到端走查

## Project Structure

### Documentation (this feature)

```text
specs/002-football-stats-content/
├── plan.md              # 本文件
├── research.md          # Phase 0 技术决策
├── data-model.md        # Phase 1 数据模型
├── quickstart.md        # Phase 1 本地启动指南
├── contracts/           # Phase 1 OpenAPI 契约
│   └── openapi.yaml
└── tasks.md             # Phase 2（/speckit-tasks 生成，非本命令产出）
```

### Source Code (repository root)

```text
server/
├── src/
│   ├── adapters/
│   │   └── football-data-adapter.js    # football-data.org v4 封装 + 速率限制
│   ├── agents/
│   │   ├── stats-agent.js              # Stats 解读编排
│   │   └── content-agent.js            # 赛后报道编排
│   ├── ai/
│   │   ├── ai-analysis-service.js      # Stats 专用语义接口
│   │   └── ai-content-service.js       # 沿用 MVP-1
│   ├── api/
│   │   ├── matches.js
│   │   ├── teams.js
│   │   └── conversations.js
│   ├── jobs/
│   │   ├── match-sync.js               # 比赛/球队增量同步
│   │   └── match-report-generate.js    # 赛后报道触发
│   ├── services/
│   │   ├── match-service.js
│   │   ├── team-service.js
│   │   ├── conversation-service.js
│   │   └── stats-context-builder.js    # 构建 AI 上下文（禁止编造）
│   ├── db/
│   │   ├── migrations/003_stats_content.sql
│   │   └── repositories/               # team, match, conversation, message
│   └── prompts/
│       ├── stats-interpret.md
│       └── match-report.md
└── tests/
    ├── contract/                         # matches, conversations, match-sync
    └── unit/                             # stats-agent, content-agent, adapter

web/
├── src/
│   ├── views/
│   │   ├── MatchDetailView.vue           # /matches/:matchId
│   │   ├── ConversationView.vue          # /conversations/:conversationId
│   │   └── StatsStartView.vue            # /stats（选比赛/球队发起对话）
│   ├── components/
│   │   ├── match/                        # MatchHeader, EventTimeline, StatsPanel
│   │   └── conversation/                 # MessageList, ChatInput, MetricCitation
│   └── api/                              # matches.ts, conversations.ts, teams.ts
```

**Structure Decision**: 延续 MVP-1 的 `server/` + `web/` 单体仓库布局；新增模块按「适配器 → 服务 → Agent → API → Job」分层，与 News Agent 模式一致，便于契约测试与 Mock 替换 football-data.org。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `FootballDataAdapter` + 内存速率限制器 | 免费层 10 req/min；6 联赛增量同步 | 每次用户提问实时拉 API 会秒级触发限流 |
| `AiAnalysisService`（Stats 专用） | Constitution IV 要求业务语义接口分离 | Stats 与 Content 共用 `AiContentService` 无法区分解读 vs 生成职责 |
| `node-cron` 新增 2 个 Job | SC-003 要求赛后 15 分钟内自动生成报道 | 纯手动触发无法满足 80% 覆盖率目标 |
| `stats_json` / `events_json` JSON 列 | football-data 统计字段多变，避免频繁 ALTER | 拆成 20+ 列维护成本过高且 YAGNI |

## Scope 边界验证清单

| 边界承诺 | 验证方式 |
|----------|----------|
| 不修改 001 的 User/FeedItem 表定义语义 | 002 migration 仅 ADD 列/新表；契约 diff 不含 001 路径变更 |
| 无 Scout/Tactical/Fan 路由 | contract test 断言无 `/scout`、`/tactical`、`/fan-discussions` |
| 无内容举报/审核 | 无 ContentReport 表与 API |
| football-data 仅 6 联赛白名单 | adapter 硬编码 `ALLOWED_LEAGUES` |
| Stats 不编造数据 | stats-agent 单元测试：缺 stats_json 时返回 degraded + 缺失项列表 |

## Post-Design Constitution Re-Check

Phase 1 设计完成后复验：data-model 与 contracts 均通过模块边界检查；Conversation 用户隔离、AI Prompt 外置、FeedItem 扩展类型均已落地。**Gate Result**: ALL PASS
