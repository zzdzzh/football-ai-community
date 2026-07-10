# Implementation Plan: Scout Agent 与 Tactical Agent

**Branch**: `003-football-scout-tactical` | **Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-football-scout-tactical/spec.md`

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

**Prerequisites**: [002-football-stats-content](../002-football-stats-content/spec.md) 已完成（比赛/球队数据、Conversation 基础设施、Stats Agent）

## Summary

在 MVP-2 脚手架之上交付 MVP-3：扩展 football-data.org 同步球员名单与射手榜快照；实现 Scout Agent 基于用户条件（位置、年龄、联赛/球队范围）返回球员推荐；实现 Tactical Agent 针对比赛进行阵型与战术阶段结构化分析。两者复用 002 的 `Conversation` / `Message` 多轮对话模型，经 `AiScoutService` / `AiTacticalService` 统一 AI 抽象层调用，Prompt 外置。前台新增 `/scout`、`/tactical` 入口页，共用 `/conversations/:conversationId` 重入路由。本 spec 含 2 个 User Story（P2 Scout、P3 Tactical），预估 tasks ≤ 28，符合 Constitution 原则 XII。

## Technical Context

**Language/Version**: Node.js 20 LTS（后台）；Vue 3.4+ / TypeScript 5.x（前台）

**Primary Dependencies**:
- 后台（沿用）：Express 4.x、better-sqlite3、jsonwebtoken、node-cron、zod、swagger-ui-express
- 后台（扩展）：`FootballDataAdapter` 新增 squad/scorers 端点封装，无额外 npm 包
- 前台（沿用）：Vite 5.x、Element Plus、Vue Router、Pinia、axios
- AI：新增 `AiScoutService`、`AiTacticalService`；底层共用 OpenAI 兼容适配器

**Storage**: SQLite（`server/data/community.db`）；新增 `players`、`player_stats_snapshots`、`message_feedback` 表；扩展 `messages` 列（`recommendations_json`、`tactical_json`）

**Testing**: Jest（`server/` contract + unit）；Scout/Tactical AI 路径 Mock 适配器，100% 分支覆盖；前台人工测试

**Target Platform**: Windows 开发 + Node.js 后台 + Vue 3 浏览器前台

**Project Type**: Web 应用（前后端分离）

**Performance Goals**:
- Scout 推荐 API p95 < 30s（含 AI，对齐 spec Independent Test「30 秒内」）
- Tactical 分析 API p95 < 30s（沿用 AgentProfile `tactical.timeout_ms=30000`）
- 球员列表查询 API p95 < 200ms（SQLite 本地缓存）
- player-sync：每日 1 次全量刷新 + match-sync 后按需补拉受影响球队 squad

**Constraints**:
- 前台 Vite dev server 监听 `0.0.0.0`
- Scout/Tactical Agent 超时 30s
- 无事件级数据时 Tactical 不得声称具体跑位/传球线路（FR-018）
- 脚本使用 PowerShell；文件 UTF-8
- 多模块：Match/Team/Conversation/Message/Auth 直接引用 [002 data-model](../002-football-stats-content/data-model.md) 与 [002 contracts](../002-football-stats-content/contracts/openapi.yaml)，不在本模块修改对端定义；003 契约文件仅描述 MVP-3 增量端点与 schema 扩展

**Scale/Scope**:
- 6+1 联赛（PL/PD/BL1/SA/FL1/CL/WC）球队阵容，约 5,000–8,000 球员行量级
- 2 个新前台入口页 + 复用 1 个对话页（按 agentId 切换渲染）
- 预估 tasks ≤ 28（符合原则 XII ≤30）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 判定 | 理由（关联本 plan 的具体方案要素） |
|------|------|-----------------------------------|
| I. 前后端分离架构 | ✅ PASS | `web/` + `server/` + SQLite；路由 `/scout`、`/tactical`、`/conversations/:id` |
| II. 契约优先 | ✅ PASS | `contracts/openapi.yaml` 先定义 Players/Scout/Tactical Conversation 扩展 |
| III. 测试纪律 | ✅ PASS | Scout/Tactical/player-sync 契约测试 + AI 路径 Mock 100% 分支 |
| IV. AI/LLM 外部服务治理 | ✅ PASS | `AiScoutService` + `AiTacticalService` + 外置 `prompts/scout-*.md`、`prompts/tactical-*.md` |
| V. 可观测性优先 | ✅ PASS | 沿用 request-id 日志；新增 player-sync 指标与 AI 调用日志 |
| VI. 简单优先 (YAGNI) | ✅ PASS | 无独立 Scout/Tactical 路由表；复用 Conversation；SQLite 缓存球员 |
| VII. 安全与权限 | ✅ PASS | Conversation 按 `user_id` 隔离；Internal Job 需 `X-Internal-Key` |
| VIII. 用户界面可视化验证 | ✅ PASS | Scout/Tactical 入口 + 对话页人工截图 + 从比赛页进战术分析路径验收 |
| IX. 用户界面视觉质量标准 | ✅ PASS | 推荐卡片/战术阶段时间线沿用 `#1B5E20` 品牌色与空/加载/错误态 |
| X. Corrector 修正回归纪律 | ✅ PASS | BUG 追溯 tasks.md 任务 ID |
| XI. 模块边界纪律 | ✅ PASS | External Dependencies 显式消费 002 的 Match/Team/Conversation |
| XII. Spec 颗粒度纪律 | ✅ PASS | 2 个 US；预估 ≤28 task |

**Gate Result**: ALL PASS — 可进入 Phase 0 研究与 Phase 1 设计

**高风险路径标记（L4 审查）**: Scout Agent 球员推荐（FR-013–015）、Tactical Agent 战术分析（FR-016–018）— 须 Mock + 真实调用各至少 1 次端到端走查

## Project Structure

### Documentation (this feature)

```text
specs/003-football-scout-tactical/
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
│   │   └── football-data-adapter.js    # 扩展 squad / scorers 端点
│   ├── agents/
│   │   ├── scout-agent.js              # Scout 推荐编排
│   │   └── tactical-agent.js           # 战术分析编排
│   ├── ai/
│   │   ├── ai-scout-service.js         # Scout 专用语义接口
│   │   └── ai-tactical-service.js      # Tactical 专用语义接口
│   ├── api/
│   │   ├── players.js                  # 球员查询（辅助 Scout 前台）
│   │   └── conversations.js            # 扩展 scout/tactical 分支（实现层）
│   ├── jobs/
│   │   └── player-sync.js              # 球员名单 + 射手榜同步
│   ├── services/
│   │   ├── conversation-service.js     # 按 agentId 路由到各 Agent
│   │   ├── scout-context-builder.js    # 候选球员筛选 + 过滤
│   │   └── tactical-context-builder.js # 比赛战术上下文（禁止编造）
│   ├── db/
│   │   ├── migrations/006_scout_tactical.sql
│   │   └── repositories/               # player, message-feedback
│   └── prompts/
│       ├── scout-recommend.md
│       └── tactical-analysis.md
└── tests/
    ├── contract/                         # players, scout-conversations, tactical-conversations, player-sync
    └── unit/                             # scout-agent, tactical-agent, context-builders

web/
├── src/
│   ├── views/
│   │   ├── ScoutStartView.vue            # /scout
│   │   ├── TacticalStartView.vue         # /tactical
│   │   └── ConversationView.vue          # 扩展 scout/tactical 消息渲染
│   ├── components/
│   │   ├── scout/                        # PlayerRecommendationCard, ScoutFilterForm
│   │   └── tactical/                     # TacticalPhasePanel, FormationBadge
│   └── api/                              # players.ts；conversations.ts 扩展 agentId
```

**Structure Decision**: 延续 MVP-1/2 的 `server/` + `web/` 单体仓库布局；Scout/Tactical 不新建独立对话表，通过 `conversation.agent_id` 区分并委派 Agent 类，与 Stats 模式一致，降低契约与前台路由复杂度。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `players` + `player_stats_snapshots` 两张表 | football-data 无统一球员统计 API；需本地缓存名单 + 射手榜快照供 Scout 可验证依据 | 每次推荐实时拉 API 会触发 8 req/min 限流且无法满足 FR-014「可验证数据依据」 |
| `AiScoutService` / `AiTacticalService` 分离 | Constitution IV 要求业务语义接口分离 | 复用 `AiAnalysisService` 无法区分推荐 vs 战术分析输出 schema |
| `messages.recommendations_json` / `tactical_json` 列 | Scout/Tactical 结构化输出与 Stats `metrics_json` 字段语义不同 | 强行塞入 `metrics_json` 导致契约测试与前台渲染混乱 |
| `message_feedback` 表 | SC-004 要求统计「有帮助/无帮助」反馈 | 无持久化则无法计算 85% 满意率 |
| `player-sync` 每日 cron Job | 6 联赛 ~100+ 球队 squad 需分批拉取 | 纯按需同步首次 Scout 请求会超时 30s |

## Scope 边界验证清单

| 边界承诺 | 验证方式 |
|----------|----------|
| 不修改 002 的 Match/Team 表定义语义 | 003 migration 仅 ADD 新表/列；002 表结构不变 |
| 不修改 001 User/Auth 契约 | 003 契约不含 `/auth` 路径变更 |
| 无 Fan Agent / 举报 API | contract test 断言无 `/fan-discussions`、`/reports` |
| football-data 仅白名单联赛 | adapter 沿用 `ALLOWED_LEAGUES` |
| Tactical 无事件级数据时不编造跑位 | tactical-agent 单元测试：缺 events_json 时 confidence=low 且 phases 为宏观描述 |
| Scout 联赛过滤生效 | scout-context-builder 单元测试：指定 PL 时结果不含其他联赛球员 |
| 002 Conversation 契约向后兼容 | stats agentId 路径契约测试仍 PASS（002 测试套件回归） |

## Post-Design Constitution Re-Check

Phase 1 设计完成后复验：Player 实体与 contracts 通过模块边界检查；Conversation 扩展 agentId、AI Prompt 外置、Message 结构化字段、用户反馈均已落地。**Gate Result**: ALL PASS
