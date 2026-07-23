# Tasks: Fan Agent 与社区治理

**Input**: Design documents from `/specs/004-football-fan-community/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

**Prerequisites Feature**: [003-football-scout-tactical](../003-football-scout-tactical/spec.md) 或至少 [002-football-stats-content](../002-football-stats-content/spec.md) 已完成（Feed、Match/Team、Auth 基础设施可供 Fan Agent 引用）

**Sprint Scope**: MVP-4 — User Story 1（Fan Agent 模拟球迷讨论 + 内容举报与管理员审核 P3）

**Tests**: fan-discussions / content-reports / admin-reports 契约测试；fan-agent / fan-context-builder / content-moderation 单元测试（AI 与内容过滤路径 100% 分支覆盖，Mock 适配器）。前台 UI 人工测试（非 Playwright）。

**Organization**: Tasks grouped by user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1

## Path Conventions

- **Backend**: `server/src/`, `server/tests/`, `server/prompts/`
- **Frontend**: `web/src/`
- **Contracts**: `specs/004-football-fan-community/contracts/openapi.yaml`
- **Migrations**: `server/src/db/migrations/`

> **跨模块依赖**：User、AgentProfile、FeedItem 基础字段、Team、Match、Auth API 以 [001](../001-football-feed-mvp/data-model.md)/[002](../002-football-stats-content/data-model.md) 为准。004 **不得**修改 001/002 的 `contracts/openapi.yaml`；增量契约仅维护于本 feature 目录。若运行时发现 001 FeedItem `type` 枚举未含 `fan_discussion`，须在 `specs/001-football-feed-mvp/tasks.md` 增补契约扩展任务后再继续 Feed 集成实现。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: MVP-4 环境变量与配置扩展（MVP-1/2/3 脚手架已就绪）

- [x] T001 Add FAN_CONTINUE_TIMEOUT_MS and CONTENT_MODERATION_BLOCKLIST to server/.env.example
- [x] T002 Extend environment config loader for fan timeout and moderation blocklist settings in server/src/config/index.js

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 数据库迁移、Repository 层、内容过滤服务、FeedItem fan_discussion 扩展

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create SQLite migration for fan_personas, fan_discussions, fan_discussion_personas, fan_discussion_turns, content_reports and Persona seed data in server/src/db/migrations/009_fan_community.sql
- [x] T004 [P] Implement fan-persona repository in server/src/db/repositories/fan-persona-repository.js
- [x] T005 [P] Implement fan-discussion, fan-discussion-persona and fan-discussion-turn repositories in server/src/db/repositories/fan-discussion-repository.js
- [x] T006 [P] Implement content-report repository in server/src/db/repositories/content-report-repository.js
- [x] T007 [P] Implement ContentModerationService with blocklist rules in server/src/services/content-moderation-service.js
- [x] T008 Extend feed-service for fan_discussion FeedItem publish, visibility filter and event_key dedup in server/src/services/feed-service.js

**Checkpoint**: Foundation ready — fan/community 表可迁移、内容过滤可调用、Feed 扩展就绪，user story implementation can now begin

---

## Phase 3: User Story 1 - 参与 Fan Agent 模拟球迷讨论 (Priority: P3) 🎯 MVP

**Goal**: 用户选择 ≥2 Fan Persona 与讨论主题，60 秒内获得 ≥4 条交替 Persona 发言；可插话触发续写；违规内容写入前拦截；可举报并由管理员隐藏（FR-019–022、FR-030）

**Independent Test**: 登录用户从 `/fan` 输入「曼联 vs 利物浦赛后谁更强」，选择 2 个不同球队 Persona，60 秒内跳转 `/discussions/{discussionId}` 显示 ≥4 条带球队人格标签的发言；插话后 Persona 回应参考用户观点；违规文本返回 422；举报后 moderator hide 使 Feed 不可见；见 quickstart.md §5–8

### Tests for User Story 1

- [x] T009 [P] [US1] Contract tests for GET /fan-personas, POST/GET /fan-discussions and POST /fan-discussions/{id}/turns in server/tests/contract/fan-discussions.test.js
- [x] T010 [P] [US1] Contract tests for POST /content-reports in server/tests/contract/content-reports.test.js
- [x] T011 [P] [US1] Contract tests for GET /admin/content-reports, hide and dismiss actions in server/tests/contract/admin-reports.test.js
- [x] T012 [P] [US1] Unit tests for fan-context-builder with 100% branch coverage in server/tests/unit/fan-context-builder.test.js
- [x] T013 [P] [US1] Unit tests for fan-agent with 100% branch coverage in server/tests/unit/fan-agent.test.js
- [x] T014 [P] [US1] Unit tests for content-moderation-service with 100% branch coverage in server/tests/unit/content-moderation.test.js

### Implementation for User Story 1

- [x] T015 [P] [US1] Create fan-discussion prompt and AiFanService in server/prompts/fan-discussion.md and server/src/ai/ai-fan-service.js
- [x] T016 [US1] Implement fan-context-builder with optional matchId and feed snippet context in server/src/services/fan-context-builder.js
- [x] T017 [US1] Implement fan-discussion-service with turn persistence, persona association and Feed publish transaction in server/src/services/fan-discussion-service.js
- [x] T018 [US1] Implement fan-agent orchestration for initial batch and continue modes in server/src/agents/fan-agent.js
- [x] T019 [US1] Implement fan-discussions and fan-personas API and mount routes in server/src/api/fan-discussions.js and server/src/app.js
- [x] T020 [US1] Implement content-reports API and mount route in server/src/api/content-reports.js and server/src/app.js
- [x] T021 [US1] Implement admin-reports API and mount route in server/src/api/admin-reports.js and server/src/app.js
- [x] T022 [P] [US1] Add web API clients for fan discussions and content reports in web/src/api/fan-discussions.ts and web/src/api/content-reports.ts
- [x] T023 [P] [US1] Implement FanStartView and PersonaPicker component in web/src/views/FanStartView.vue and web/src/components/fan/PersonaPicker.vue
- [x] T024 [US1] Implement FanDiscussionView, TurnBubble, ReportDialog and register /fan and /discussions/:discussionId routes in web/src/views/FanDiscussionView.vue, web/src/components/fan/TurnBubble.vue, web/src/components/fan/ReportDialog.vue and web/src/router/index.ts
- [x] T025 [US1] Implement AdminReportsView and register /admin/reports route in web/src/views/AdminReportsView.vue and web/src/router/index.ts
<!-- BUG 2026-07-23: AdminReports 分页翻页 -->
- [x] T026 [US1] Extend FeedCard for fan_discussion type navigation and add /fan entry in web/src/components/feed/FeedCard.vue and web/src/router/index.ts

**Checkpoint**: User Story 1 fully functional — Fan 讨论 + 插话 + 内容过滤 + 举报审核闭环可独立验收（对齐 FR-019–022、FR-030）

**Manual UI Verification [US1]**: 截图 — `/fan` Persona 多选 + 主题输入、讨论详情 ≥4 条 Persona 气泡 + 球队标签、插话后 Persona 回应、违规拦截提示、ReportDialog 提交、管理员 `/admin/reports` hide、Feed fan_discussion 卡片点击进入详情

---

## Phase 4: Polish & Cross-Cutting Concerns

- [x] T027 Run 002/003 conversations contract regression and MVP-4 scope boundary audit per plan.md Scope 边界验证清单 in server/tests/contract/conversations.test.js and specs/004-football-fan-community/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** → **Phase 2 (Foundational)** → **Phase 3 (US1)** → **Phase 4 (Polish)**
- **Foundational (Phase 2) MUST complete before ANY user story work**

### User Story Dependencies

- **User Story 1 (P3)**: Starts after Foundational — 只读消费 001 User/Feed/Auth、002 Match/Team；不依赖 003 Scout/Tactical 完成

### Within User Story 1

- Contract/unit tests (T009–T014) SHOULD fail before implementation
- Repositories → moderation → AI service → context-builder → discussion-service → fan-agent → API → frontend
- Story checkpoint before Polish

### Parallel Opportunities

- **Phase 1**: T001 与 T002 可并行（不同文件）
- **Phase 2**: T004、T005、T006、T007 可并行；T008 依赖 T003；T003 无前置
- **Phase 3**: T009–T014 全部可并行；T015 可与 T009–T014 并行；T022–T023 可并行于 T021 之后
- **Phase 4**: T027 独立收尾

---

## Parallel Example: User Story 1

```text
# Launch contract and unit tests together:
T009 fan-discussions.test.js
T010 content-reports.test.js
T011 admin-reports.test.js
T012 fan-context-builder.test.js
T013 fan-agent.test.js
T014 content-moderation.test.js

# Launch AI + frontend together (after T018):
T015 ai-fan-service + prompt
T022 web API clients
T023 FanStartView + PersonaPicker
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational（CRITICAL — blocks all stories）
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: quickstart.md §5–8 Fan 讨论 + 举报审核 + Manual UI Verification [US1]
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → fan/community 表可迁移、内容过滤与 Feed 扩展就绪
2. Add User Story 1 → Fan 讨论 + 治理闭环 → Demo（MVP!）
3. Polish → 002/003 回归 + 范围边界审计

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 backend (T015–T021)
   - Developer B: US1 contract/unit tests (T009–T014)
   - Developer C: US1 frontend (T022–T026)
3. Polish (T027) 在 US1 checkpoint 后执行

---

## Notes

- 本 spec 共 **27 项任务**（T001–T027），符合原则 XII ≤30
- 高风险路径（Fan Agent FR-019–022、社区内容审核 FR-030）须 Mock + 真实 API Key 各至少 1 次 L4 走查（见 quickstart.md §13）
- SC-005（60 秒内 ≥4 轮、95% 无违规）标注 Deferrable: yes；T013 验证 ≥4 turns 结构与 moderation 分支，Sprint 内不要求 95% 合规率仪表盘
- 前台 bug 修正后停止等待人工验证；后台重启由用户手动执行
- 004 契约端点：GET `/fan-personas`、POST/GET `/fan-discussions`、POST `/fan-discussions/{id}/turns`、POST `/content-reports`、GET `/admin/content-reports`、POST hide/dismiss — 均由 T019–T021 实现
- data-model 实体覆盖：FanPersona（T003/T004）、FanDiscussion + FanDiscussionPersona（T003/T005）、FanDiscussionTurn（T003/T005）、ContentReport（T003/T006）、FeedItem 扩展（T008）
