# Tasks: Stats Agent 与 Content Agent

**Input**: Design documents from `/specs/002-football-stats-content/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

**Prerequisites Feature**: [001-football-feed-mvp](../001-football-feed-mvp/spec.md) 已完成（认证、Feed、News Agent、偏好）

**Sprint Scope**: MVP-2 — User Story 1（Stats Agent 比赛数据对话）+ User Story 2（Content Agent 赛后报道）

**Tests**: Stats/Content/Match-sync 契约测试；Stats/Content/Adapter 单元测试（AI 路径 100% 分支覆盖，Mock 适配器）。前台 UI 人工测试（非 Playwright）。

**Organization**: Tasks grouped by user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 or US2

## Path Conventions

- **Backend**: `server/src/`, `server/tests/`, `server/prompts/`
- **Frontend**: `web/src/`
- **Contracts**: `specs/002-football-stats-content/contracts/openapi.yaml`
- **Migrations**: `server/src/db/migrations/`

> **跨模块依赖**：User、AgentProfile、FeedItem 基础字段、Auth API 以 [001 data-model](../001-football-feed-mvp/data-model.md) 与 [001 contracts](../001-football-feed-mvp/contracts/openapi.yaml) 为准。若 001 OpenAPI 中 FeedItem 枚举未含 `match_report`/`brief_report`，须在 `specs/001-football-feed-mvp/tasks.md` 增补契约扩展任务后再继续 T006。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: MVP-2 环境变量与配置扩展（MVP-1 脚手架已就绪）

- [ ] T001 Add FOOTBALL_DATA_API_KEY, FOOTBALL_DATA_BASE_URL, MATCH_SYNC_CRON and MATCH_REPORT_CRON to server/.env.example
- [ ] T002 Extend environment config loader for football-data and cron settings in server/src/config/index.js

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 数据库迁移、football-data 适配器、比赛/球队服务、AI 解读层与同步 Job 基础设施

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Create SQLite migration for Team, Match, Conversation, Message, MatchSyncMeta and FeedItem extensions in server/src/db/migrations/003_stats_content.sql
- [ ] T004 [P] Implement team and match repositories in server/src/db/repositories/team-repository.js and server/src/db/repositories/match-repository.js
- [ ] T005 [P] Implement conversation, message and match-sync-meta repositories in server/src/db/repositories/conversation-repository.js, server/src/db/repositories/message-repository.js and server/src/db/repositories/match-sync-meta-repository.js
- [ ] T006 Extend feed-item-repository for match_id, body_json, data_sources_json and match_report/brief_report types in server/src/db/repositories/feed-item-repository.js
- [ ] T007 Implement FootballDataAdapter with 8 req/min rate limiter and ALLOWED_LEAGUES whitelist in server/src/adapters/football-data-adapter.js
- [ ] T008 [P] Implement match-service and team-service in server/src/services/match-service.js and server/src/services/team-service.js
- [ ] T009 [P] Implement AiAnalysisService and stats-interpret prompt in server/src/ai/ai-analysis-service.js and server/prompts/stats-interpret.md
- [ ] T010 Implement match-sync job and mount matches/teams API routes in server/src/jobs/match-sync.js, server/src/api/matches.js, server/src/api/teams.js and server/src/app.js

**Checkpoint**: Foundation ready — match data syncable, matches/teams API callable, user story implementation can now begin

---

## Phase 3: User Story 1 - 向 Stats Agent 查询比赛数据 (Priority: P1) 🎯 MVP

**Goal**: 用户选择比赛或球队，向 Stats Agent 提问，30 秒内获得含关键指标、自然语言解读与置信度标注的回复

**Independent Test**: 登录用户从 `/stats` 选择一场已结束比赛，输入「这场比赛控球与射门表现如何」，30 秒内收到 ≥3 项指标 + 解读 + 置信度；无法识别球队时返回相似建议列表

### Tests for User Story 1

- [ ] T011 [P] [US1] Contract tests for GET /matches and GET /teams endpoints in server/tests/contract/matches.test.js and server/tests/contract/teams.test.js
- [ ] T012 [P] [US1] Contract tests for conversations API in server/tests/contract/conversations.test.js
- [ ] T013 [P] [US1] Contract test for POST /internal/jobs/match-sync in server/tests/contract/match-sync.test.js
- [ ] T014 [P] [US1] Unit tests for FootballDataAdapter and stats-agent with 100% branch coverage in server/tests/unit/football-data-adapter.test.js and server/tests/unit/stats-agent.test.js

### Implementation for User Story 1

- [ ] T015 [US1] Implement stats-context-builder with missingFields and no-fabrication guard in server/src/services/stats-context-builder.js
- [ ] T016 [US1] Implement stats-agent orchestration with AiAnalysisService and AgentInteractionLog in server/src/agents/stats-agent.js
- [ ] T017 [US1] Implement conversation-service and conversations API with user_id isolation in server/src/services/conversation-service.js and server/src/api/conversations.js
- [x] T018 [P] [US1] Implement web API clients in web/src/api/matches.ts, web/src/api/teams.ts and web/src/api/conversations.ts
- [x] T019 [P] [US1] Implement StatsStartView, ConversationView and conversation components in web/src/views/StatsStartView.vue, web/src/views/ConversationView.vue and web/src/components/conversation/
- [x] T020 [US1] Register /stats and /conversations/:conversationId routes in web/src/router/index.ts

**Checkpoint**: User Story 1 fully functional — Stats 对话闭环可独立验收（对齐 SC-002）

**Manual UI Verification [US1]**: 截图 — Stats 入口页、对话含指标与置信度、「数据同步中」边缘态、未找到匹配项提示

---

## Phase 4: User Story 2 - 阅读 Content Agent 赛后报道 (Priority: P2)

**Goal**: 比赛结束后 15 分钟内自动生成赛后报道并发布至 Feed；用户可在比赛专题页阅读含比分、时间线与走势评述的战报

**Independent Test**: 对已 FINISHED 且数据完整的比赛触发 match-report-generate，用户在 `/matches/:matchId` 看到战报；数据不足时显示 brief_report 与缺失项标注

### Tests for User Story 2

- [ ] T021 [P] [US2] Unit tests for content-agent and stats-context-builder report mode with 100% branch coverage in server/tests/unit/content-agent.test.js and server/tests/unit/stats-context-builder.test.js

### Implementation for User Story 2

- [ ] T022 [US2] Create match-report prompt and implement content-agent with Stats data snapshot in server/prompts/match-report.md and server/src/agents/content-agent.js
- [ ] T023 [US2] Implement match-report-generate job with event_key dedup and cron registration in server/src/jobs/match-report-generate.js
- [ ] T024 [US2] Extend GET /matches/:matchId with report and feed-service for match_report/brief_report in server/src/api/matches.js and server/src/services/feed-service.js
- [ ] T025 [P] [US2] Implement MatchDetailView and match components in web/src/views/MatchDetailView.vue and web/src/components/match/
- [ ] T026 [US2] Extend FeedCard for match_report/brief_report and navigation to /matches/:matchId in web/src/components/feed/FeedCard.vue and web/src/views/HomeView.vue

**Checkpoint**: User Stories 1 AND 2 both work independently — Multi-Agent 协作链路可验收（对齐 SC-003）

**Manual UI Verification [US2]**: 截图 — 比赛专题页战报+时间线、Feed 战报卡片、brief_report 缺失标注；路径：首页 Feed → 比赛页 → 「向 Stats 提问」

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T027 [P] Extend feed-preference-sort for notify_match_report weighting in server/src/services/feed-preference-sort.js
- [ ] T028 Run quickstart.md validation and MVP-2 scope boundary audit in specs/002-football-stats-content/quickstart.md and plan.md Scope 边界验证清单

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** → **Phase 2 (Foundational)** → **Phase 3 (US1)** → **Phase 4 (US2)** → **Phase 5 (Polish)**
- **Foundational (Phase 2) MUST complete before ANY user story work**

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational — no dependency on US2
- **User Story 2 (P2)**: Starts after Foundational — depends on US1 的 match-sync 与 stats-context-builder（T015），但战报生成可独立契约测试

### Within Each User Story

- Contract/unit tests (T011–T014, T021) SHOULD fail before implementation
- Repositories → services → agents → API → jobs → frontend
- Story checkpoint before moving to next priority

### Parallel Opportunities

- **Phase 1**: T002 parallel with T001（不同文件）
- **Phase 2**: T004, T005, T008, T009 parallel；T010 依赖 T004–T009
- **Phase 3**: T011–T014 全部可并行；T018–T019 可并行于 T017 之后
- **Phase 4**: T021 与 T022 可先行；T025 可与 T024 并行
- **Phase 5**: T027 可与 T028 前半并行

---

## Parallel Example: User Story 1

```text
# Launch contract tests together:
T011 matches.test.js + teams.test.js
T012 conversations.test.js
T013 match-sync.test.js
T014 football-data-adapter.test.js + stats-agent.test.js

# Launch frontend together (after T017):
T018 web API clients
T019 StatsStartView + ConversationView + components
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational（CRITICAL — blocks all stories）
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: quickstart.md §5 Stats 对话 + Manual UI Verification [US1]
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → 比赛数据可同步、matches/teams API 可用
2. Add User Story 1 → Stats 对话闭环 → Demo（MVP!）
3. Add User Story 2 → 赛后战报 + Feed 卡片 → Demo
4. Polish → 偏好加权 + 范围边界审计

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 backend (T015–T017)
   - Developer B: US1 contract tests (T011–T014)
   - Developer C: US1 frontend (T018–T020)
3. US2 可在 US1 checkpoint 后并行 backend + frontend

---

## Notes

- 本 spec 共 **28 项任务**（T001–T028），符合原则 XII ≤30
- 高风险路径（Stats AI 解读 FR-009–012、Content 战报 FR-023–025）须 Mock + 真实 API Key 各至少 1 次 L4 走查
- 前台 bug 修正后停止等待人工验证；后台重启由用户手动执行
- football-data.org 免费层限流：adapter 硬编码 8 req/min，禁止实时全量拉取
