# Tasks: Scout Agent 与 Tactical Agent

**Input**: Design documents from `/specs/003-football-scout-tactical/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

**Prerequisites Feature**: [002-football-stats-content](../002-football-stats-content/spec.md) 已完成（比赛/球队数据、Conversation 基础设施、Stats Agent）

**Sprint Scope**: MVP-3 — User Story 1（Scout Agent 球员推荐 P2）+ User Story 2（Tactical Agent 战术分析 P3）

**Tests**: Players/Scout/Tactical/player-sync 契约测试；Scout/Tactical/context-builder 单元测试（AI 路径 100% 分支覆盖，Mock 适配器）。前台 UI 人工测试（非 Playwright）。

**Organization**: Tasks grouped by user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 or US2

## Path Conventions

- **Backend**: `server/src/`, `server/tests/`, `server/prompts/`
- **Frontend**: `web/src/`
- **Contracts**: `specs/003-football-scout-tactical/contracts/openapi.yaml`
- **Migrations**: `server/src/db/migrations/`

> **跨模块依赖**：User、AgentProfile、Team、Match、Conversation/Message 基础字段、Auth API 以 [001](../001-football-feed-mvp/data-model.md)/[002](../002-football-stats-content/data-model.md) 为准。003 **不得**修改 002 的 `contracts/openapi.yaml`；增量契约仅维护于本 feature 目录。若运行时发现 002 Conversation `agentId` 枚举需同步扩展，须在 `specs/002-football-stats-content/tasks.md` 增补任务后再继续实现。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: MVP-3 环境变量与配置扩展（MVP-2 脚手架已就绪）

- [x] T001 Add PLAYER_SYNC_CRON to server/.env.example
- [x] T002 Extend environment config loader for player-sync cron settings in server/src/config/index.js

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 数据库迁移、football-data 球员端点、球员同步 Job、球员查询 API 与 Message 扩展列

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create SQLite migration for players, player_stats_snapshots, player_sync_meta, message_feedback and messages column extensions in server/src/db/migrations/006_scout_tactical.sql
- [x] T004 [P] Implement player, player-stats-snapshot and player-sync-meta repositories in server/src/db/repositories/player-repository.js, server/src/db/repositories/player-stats-snapshot-repository.js and server/src/db/repositories/player-sync-meta-repository.js（BUG: Scout keyStats 过贫，需优选富统计快照并扩展射门/防守等字段；BUG: Transfermarkt kader 误解析生涯/杂字段为赛季进球，需拒绝不可信薄快照；BUG: 联赛 Scout 需按 stats/球队归属检索并可按进球排序，避免姓名前 50 漏掉射手榜球星）
- [x] T005 [P] Implement message-feedback repository in server/src/db/repositories/message-feedback-repository.js
- [x] T006 Extend FootballDataAdapter with squad and scorers endpoints in server/src/adapters/football-data-adapter.js
- [x] T007 Implement player-sync job with daily cron and internal trigger route in server/src/jobs/player-sync.js and server/src/app.js（BUG: Transfermarkt scorers 误写入超高进球且无 minutes，污染 Scout；同步时须跳过/清理）
- [x] T008 Implement players list and detail API in server/src/api/players.js and mount route in server/src/app.js
- [x] T009 Extend message-repository for recommendations_json and tactical_json persistence in server/src/db/repositories/message-repository.js

**Checkpoint**: Foundation ready — player data syncable, `/players` API callable, user story implementation can now begin

---

## Phase 3: User Story 1 - 使用 Scout Agent 获取球员推荐 (Priority: P2) 🎯 MVP

**Goal**: 用户描述位置、年龄、联赛/球队范围等条件，30 秒内获得 ≥3 名球员推荐，每名含推荐理由与 ≥3 项关键数据；联赛过滤生效；条件过宽时返回 top5 + narrowHint

**Independent Test**: 登录用户从 `/scout` 选择英超，输入「需要一名擅长压迫的中场，25 岁以下」，30 秒内收到 ≥3 名球员推荐卡片；API 路径见 quickstart.md §5

### Tests for User Story 1

- [x] T010 [P] [US1] Contract tests for GET /players and POST /internal/jobs/player-sync in server/tests/contract/players.test.js and server/tests/contract/player-sync.test.js
- [x] T011 [P] [US1] Contract tests for Scout conversations and message feedback in server/tests/contract/scout-conversations.test.js
- [x] T012 [P] [US1] Unit tests for scout-context-builder and scout-agent with 100% branch coverage in server/tests/unit/scout-context-builder.test.js and server/tests/unit/scout-agent.test.js

### Implementation for User Story 1

- [x] T013 [P] [US1] Create scout-recommend prompt and AiScoutService in server/prompts/scout-recommend.md and server/src/ai/ai-scout-service.js（BUG: keyStats 须按用户意图侧重，且保留基础数据；BUG: 「射手/金靴」类问题未识别为 attack 侧重）
- [x] T014 [US1] Implement scout-context-builder with league filter and candidate cap in server/src/services/scout-context-builder.js（BUG: 从问题解析 statFocus；BUG: 后卫 SQL 误用 Defender 与真实 Left-Back/Centre-Back 不匹配导致候选为空；年龄范围/岁以内/边后卫解析；BUG: 联赛快照过贫时未回退跨联赛富统计导致 keyStats 为空；BUG: 「最佳射手」按姓名取前 50 且未偏好联赛进球快照，导致姆巴佩等球星不在候选池）
- [x] T015 [US1] Implement scout-agent orchestration with recommendations_json persistence in server/src/agents/scout-agent.js（BUG: 组装 keyStats 时强制保留基础项）
- [x] T016 [US1] Extend conversation-service and conversations API for agentId=scout and feedback endpoint in server/src/services/conversation-service.js and server/src/api/conversations.js
- [x] T017 [P] [US1] Extend web API clients for players and scout conversations in web/src/api/players.ts and web/src/api/conversations.ts（BUG: 创建含 initialMessage 的对话超时 30s 不足，改为 120s）
- [x] T018 [P] [US1] Implement ScoutStartView and scout components in web/src/views/ScoutStartView.vue, web/src/components/scout/ScoutFilterForm.vue and web/src/components/scout/PlayerRecommendationCard.vue
- [x] T019 [US1] Extend ConversationView for scout recommendations and register /scout route in web/src/views/ConversationView.vue and web/src/router/index.ts

**Checkpoint**: User Story 1 fully functional — Scout 推荐闭环可独立验收（对齐 FR-013–015）

**Manual UI Verification [US1]**: 截图 — `/scout` 筛选表单、对话页推荐卡片 ≥3 人 + keyStats、条件宽泛时 top5 + narrowHint、联赛过滤后无其他联赛球员

---

## Phase 4: User Story 2 - 向 Tactical Agent 请求战术分析 (Priority: P3)

**Goal**: 用户针对已结束比赛或球队提交战术问题，收到含阵型、战术阶段（出球/压迫/转换）的结构化分析；区分赛后复盘与赛前预判；缺事件数据时不编造跑位/传球线路

**Independent Test**: 从 `/matches/:matchId` 进入战术分析，输入「主队是如何组织高位压迫的」，收到含阵型与阶段面板的回复；未开赛比赛标注「【赛前战术预判】」；见 quickstart.md §6

### Tests for User Story 2

- [x] T020 [P] [US2] Contract tests for Tactical conversations in server/tests/contract/tactical-conversations.test.js
- [x] T021 [P] [US2] Unit tests for tactical-context-builder and tactical-agent with 100% branch coverage in server/tests/unit/tactical-context-builder.test.js and server/tests/unit/tactical-agent.test.js

### Implementation for User Story 2

- [x] T022 [P] [US2] Create tactical-analysis prompt and AiTacticalService in server/prompts/tactical-analysis.md and server/src/ai/ai-tactical-service.js
- [x] T023 [US2] Implement tactical-context-builder with analysisType derivation and data-limitation guard in server/src/services/tactical-context-builder.js
- [x] T024 [US2] Implement tactical-agent orchestration with tactical_json persistence in server/src/agents/tactical-agent.js
- [x] T025 [US2] Extend conversation-service and conversations API for agentId=tactical in server/src/services/conversation-service.js and server/src/api/conversations.js
- [x] T026 [P] [US2] Implement TacticalStartView, tactical components and MatchDetailView entry in web/src/views/TacticalStartView.vue, web/src/components/tactical/TacticalPhasePanel.vue, web/src/components/tactical/FormationBadge.vue and web/src/views/MatchDetailView.vue
- [x] T027 [US2] Extend ConversationView for tactical analysis rendering and register /tactical route in web/src/views/ConversationView.vue and web/src/router/index.ts

**Checkpoint**: User Stories 1 AND 2 both work independently — Scout + Tactical 双 Agent 可验收（对齐 FR-016–018）

**Manual UI Verification [US2]**: 截图 — 比赛页「战术分析」入口、战术阶段面板 + 阵型标签、数据不足时低置信度 + 限制说明、未开赛比赛「赛前战术预判」标注

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T028 Run 002 Stats conversations contract regression and MVP-3 scope boundary audit per plan.md Scope 边界验证清单 in server/tests/contract/conversations.test.js and specs/003-football-scout-tactical/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** → **Phase 2 (Foundational)** → **Phase 3 (US1)** → **Phase 4 (US2)** → **Phase 5 (Polish)**
- **Foundational (Phase 2) MUST complete before ANY user story work**

### User Story Dependencies

- **User Story 1 (P2)**: Starts after Foundational — no dependency on US2
- **User Story 2 (P3)**: Starts after Foundational — reuses Conversation 基础设施与 Match 数据（002），不依赖 US1 完成，但共享 T016/T025 的 conversation-service 扩展（按 agentId 分支，可增量合并）

### Within Each User Story

- Contract/unit tests (T010–T012, T020–T021) SHOULD fail before implementation
- Repositories → adapter/job → AI service → context-builder → agent → API → frontend
- Story checkpoint before moving to next priority

### Parallel Opportunities

- **Phase 1**: T001 与 T002 可并行（不同文件）
- **Phase 2**: T004、T005 可并行；T008 依赖 T003–T004；T007 依赖 T004、T006
- **Phase 3**: T010–T012 全部可并行；T017–T018 可并行于 T016 之后
- **Phase 4**: T020–T021 可并行；T026 可与 T025 并行（T025 完成后对接 MatchDetailView）
- **Phase 5**: T028 独立收尾

---

## Parallel Example: User Story 1

```text
# Launch contract and unit tests together:
T010 players.test.js + player-sync.test.js
T011 scout-conversations.test.js
T012 scout-context-builder.test.js + scout-agent.test.js

# Launch frontend together (after T016):
T017 web API clients
T018 ScoutStartView + ScoutFilterForm + PlayerRecommendationCard
```

---

## Parallel Example: User Story 2

```text
# Launch tests together:
T020 tactical-conversations.test.js
T021 tactical-context-builder.test.js + tactical-agent.test.js

# Launch AI + frontend components together (after T023):
T022 ai-tactical-service + prompt
T026 TacticalStartView + TacticalPhasePanel + FormationBadge
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational（CRITICAL — blocks all stories）
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: quickstart.md §5 Scout 推荐 + Manual UI Verification [US1]
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → 球员数据可同步、`/players` API 可用
2. Add User Story 1 → Scout 推荐闭环 → Demo（MVP!）
3. Add User Story 2 → Tactical 战术分析 + 比赛页入口 → Demo
4. Polish → 002 Stats 回归 + 范围边界审计

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 backend (T013–T016)
   - Developer B: US1 contract/unit tests (T010–T012)
   - Developer C: US1 frontend (T017–T019)
3. US2 可在 US1 checkpoint 后并行 backend + frontend（T020–T027）

---

## Notes

- 本 spec 共 **28 项任务**（T001–T028），符合原则 XII ≤30
- 高风险路径（Scout 推荐 FR-013–015、Tactical 分析 FR-016–018）须 Mock + 真实 API Key 各至少 1 次 L4 走查（见 quickstart.md §12）
- SC-004（85% 满意率）标注 Deferrable: yes；T016 已预埋 feedback API 与 `message_feedback` 表，Sprint 内不要求仪表盘
- 前台 bug 修正后停止等待人工验证；后台重启由用户手动执行
- football-data.org 免费层限流：adapter 硬编码 8 req/min，球员同步须分批 cron，禁止 Scout 请求时实时全量拉 squad
