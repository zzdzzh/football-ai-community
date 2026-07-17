# Tasks: 球员实体对齐（统计域 ↔ 履历域）

**Input**: Design documents from `/specs/006-player-entity-alignment/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

**Prerequisites Feature**: [001 Auth](../001-football-feed-mvp/spec.md)；[003 Stats Player](../003-football-scout-tactical/spec.md) 与 [005 CareerPlayer](../005-player-relationship-analysis/spec.md) 已可运行。本 feature **不合并** 两域主键，仅新增映射层；**禁止**在 006 内静默修改 003/005 的 `contracts/openapi.yaml` 或 `data-model.md`。003 侧 TM ID 契约暴露见 [003 tasks 跨模块增补 T029–T032](../003-football-scout-tactical/tasks.md)。

**Tests**: Constitution 原则 III — 对齐规则/冲突拒绝/双向解析 MUST 单元测试 100% 分支覆盖；`player-identity-links` 契约测试 MUST 覆盖 401/404 与 align 计数字段。前台 UI 人工测试（非 Playwright），须在 US2 Checkpoint 标注截图与交互断言检查点。

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to — `[US1]` / `[US2]` / `[US3]`（仅 User Story 阶段）
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `server/src/`, `server/tests/`
- **Frontend**: `web/src/`
- **Contracts**: `specs/006-player-entity-alignment/contracts/openapi.yaml`
- **Migrations**: `server/src/db/migrations/`
- **Docs**: `specs/006-player-entity-alignment/`

> **跨模块依赖**：Stats Player / CareerPlayer / User 以对端 data-model 与 contracts 为准，只读消费。对齐服务可同库只读 `players.transfermarkt_id`（migration 008 已存在）。若客户端需在 003 Player JSON 见 `transfermarktId`，切换到 **003** 完成 T029–T032，勿在 006 改对端 OpenAPI。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 确认沿用现有 Internal Job 鉴权，无新运行时依赖

- [x] T001 Document player-identity-align internal route reuse of `INTERNAL_API_KEY` in `server/.env.example`（注释说明 `POST /api/internal/player-identity-align`；不新增密钥项）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: SQLite 映射域三表与 Repository — 所有 User Story 的阻塞前置

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Create SQLite migration for `player_identity_links`, `player_identity_conflicts`, `player_identity_align_runs` and indexes in `server/src/db/migrations/015_player_identity_links.sql`（仅 CREATE；禁止 ALTER/MERGE 003/005 球员表）
- [x] T003 [P] Implement player-identity-link repository (active link CRUD, per-side active uniqueness helpers, align_runs insert/finish) in `server/src/db/repositories/player-identity-link-repository.js`
- [x] T004 [P] Implement player-identity-conflict repository in `server/src/db/repositories/player-identity-conflict-repository.js`

**Checkpoint**: Foundation ready — 015 可迁移；link/conflict/align_runs 仓储可被对齐与解析服务调用

---

## Phase 3: User Story 1 - 建立可核验的身份映射 (Priority: P1) 🎯 MVP

**Goal**: 以 Transfermarkt ID 精确唯一匹配建立高置信度双向可查映射；缺 TM ID 不伪造；冲突不自动建链并留存冲突与 run 计数（FR-001～FR-006、FR-010；SC-001、SC-004）

**Independent Test**: 在两侧均有相同 TM ID 的样例上触发对齐；可查到一条 `confidence=high` 的 active 映射；无 TM ID / 冲突时不建高置信度映射；响应含 `created`/`conflict`/`skipped`。见 quickstart.md §3、§6

### Tests for User Story 1

> **NOTE**: Write these tests FIRST; ensure they FAIL before implementation

- [x] T005 [P] [US1] Unit tests for TM exact unique match, missing TM skip, stats-side conflict, career `sync_status=failed` skip, and no name-only high confidence with 100% branch coverage in `server/tests/unit/player-identity-align.test.js`
- [x] T006 [P] [US1] Contract tests for `POST /player-identity-links/align` and `POST /internal/player-identity-align` (401, created/conflict/skipped counters) in `server/tests/contract/player-identity-links.test.js`

### Implementation for User Story 1

- [x] T007 [US1] Implement `PlayerIdentityAlignService` (normalize TM key, unique match → active high link, conflict → conflict row + no active, write align_run counts) in `server/src/services/player-identity-align-service.js`
- [x] T008 [US1] Implement internal/batch align job in `server/src/jobs/player-identity-align.js`
- [x] T009 [US1] Implement user align API and mount user + internal routes in `server/src/api/player-identity-links.js` and `server/src/app.js`

**Checkpoint**: User Story 1 可独立验收 — 按需/内部对齐生成可追溯 high 映射；冲突可观测；两侧球员主键语义不变（对齐 SC-001/SC-004）

---

## Phase 4: User Story 2 - 关系分析页跳转到统计能力 (Priority: P2)

**Goal**: 关系页展示关联态与跨域跳转；未对齐无失效链接；非高置信度标「待确认」；轻量 `/players/:playerId` 统计入口可重入（FR-007；SC-002）

**Independent Test**: 打开已对齐双球员关系页，30 秒内看到「统计域已关联」并进入 `/players/{statsPlayerId}`；未对齐显示「暂未关联统计库」且无链接。见 quickstart.md §5

### Tests for User Story 2

- [x] T010 [P] [US2] Contract tests for `GET /player-identity-links?careerPlayerIds=` (linked/unlinked/pending_confirmation, no fabricated statsPlayerId, 401) in `server/tests/contract/player-identity-links.test.js`

### Implementation for User Story 2

- [x] T011 [US2] Implement batch career→stats link status (`linkState`, `statsEntryPath`) in `server/src/services/player-identity-resolve-service.js` and `GET /player-identity-links` in `server/src/api/player-identity-links.js`
- [x] T012 [P] [US2] Add web API client for player-identity-links batch/resolve helpers in `web/src/api/player-identity-links.ts`
- [x] T013 [P] [US2] Create `PlayerIdentityLinkBadge` (linked / unlinked / pending_confirmation) in `web/src/components/relationship/PlayerIdentityLinkBadge.vue`
- [x] T014 [US2] Integrate identity badges into relationship conclusion area in `web/src/views/RelationshipAnalysisView.vue`
- [x] T015 [US2] Create lightweight stats entry page and register `/players/:playerId` route in `web/src/views/PlayerStatsEntryView.vue` and `web/src/router/index.ts`

**Checkpoint**: User Stories 1+2 可独立验收 — 关系页关联态 + 带核心 ID 的统计入口跳转（对齐 SC-002）

**Manual UI Verification [US2]**: 截图 — 双球员均 linked 的跳转、仅一侧 linked、unlinked 无 `<a>`、pending_confirmation「待确认」、`/players/{id}` 基础信息与 Scout CTA、未登录引导

---

## Phase 5: User Story 3 - 双向解析查询 (Priority: P3)

**Goal**: 统一 resolve 接口：统计↔履历双向返回对端 ID、依据与置信度；无映射 404 不编造（FR-008；SC-003 可契约验证）

**Independent Test**: 对已知映射对分别用 `statsPlayerId` / `careerPlayerId` 调用 resolve，双向均返回对端与 `confidence`；无映射 404。见 quickstart.md §4

### Tests for User Story 3

- [x] T016 [P] [US3] Unit tests for bidirectional resolve and not-found with 100% branch coverage in `server/tests/unit/player-identity-resolve.test.js`
- [x] T017 [P] [US3] Contract tests for `GET /player-identity-links/resolve` (200 structure, 400 both/neither params, 401, 404) in `server/tests/contract/player-identity-links.test.js`

### Implementation for User Story 3

- [x] T018 [US3] Complete bidirectional `resolve` in `server/src/services/player-identity-resolve-service.js` and `GET /player-identity-links/resolve` in `server/src/api/player-identity-links.js`

**Checkpoint**: All user stories independently functional — 可编程双向解析就绪（对齐 FR-008、SC-003 契约面）

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 可观测性、范围边界回归与 quickstart 验收

- [x] T019 [P] Emit structured align metrics/logs (`player_identity_align_created_total` / `_conflict_total` / `_skipped_total` or equivalent) in `server/src/services/player-identity-align-service.js` and `server/src/jobs/player-identity-align.js`
- [x] T020 Run Scope 边界验证清单 and quickstart.md regression（migration 仅 CREATE；003/005 contracts 与 data-model 未被 006 改写；无姓名模糊 high；冲突不建链；未登录 401）per `specs/006-player-entity-alignment/plan.md` and `specs/006-player-entity-alignment/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **User Story 1 (Phase 3)**: Depends on Foundational completion
- **User Story 2 (Phase 4)**: Depends on US1 mappings existing (batch/UI consume align results)；可与 US3 后端并行但 UI 验收依赖映射样例
- **User Story 3 (Phase 5)**: Depends on Foundational + link rows（可由 US1 产生）；与 US2 UI 无硬依赖
- **Polish (Phase 6)**: Depends on desired user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependency on US2/US3
- **User Story 2 (P2)**: After US1 align API/data — independently testable with fixture links
- **User Story 3 (P3)**: After Foundational（及至少一条 active link）— independently testable via resolve contract/unit

### Within Each User Story

- Tests SHOULD fail before implementation
- Repos (Phase 2) → services → endpoints → frontend
- Story Checkpoint (+ Manual UI for US2) before next priority

### Parallel Opportunities

- **Phase 2**: T003 ‖ T004
- **Phase 3**: T005 ‖ T006；然后 T007 → T008 → T009
- **Phase 4**: T010 可先写；T012 ‖ T013 在 API 契约稳定后并行；T014 依赖 T013；T015 可与 T014 并行（不同文件）
- **Phase 5**: T016 ‖ T017；T018 after tests + T011 resolve skeleton
- **Phase 6**: T019 ‖ T020 关注点不同可并行起草，T020 宜在功能齐后跑

---

## Parallel Example: User Story 1

```text
# Launch tests together:
T005 server/tests/unit/player-identity-align.test.js
T006 server/tests/contract/player-identity-links.test.js (align + internal)

# Then implementation:
T007 player-identity-align-service.js
T008 jobs/player-identity-align.js
T009 api/player-identity-links.js + app.js mount
```

---

## Parallel Example: User Story 2

```text
T012 web/src/api/player-identity-links.ts
T013 PlayerIdentityLinkBadge.vue
T015 PlayerStatsEntryView.vue + router
# after T011 API:
T014 integrate badges into RelationshipAnalysisView.vue
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational（CRITICAL）
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: 样例集对齐召回/误建 + 冲突计数（SC-001/SC-004）
5. Demo / 继续增量

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → 映射与对齐触发 MVP
3. US2 → 关系页跨域跳转 + `/players/:playerId`
4. US3 → 双向 resolve API
5. Polish → 指标与边界审计

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. After Foundational:
   - Dev A: US1 测试 + AlignService + API/Job
   - Dev B: US2 前台组件（可 mock batch API）
3. US3 在有 active link 后补齐 resolve

---

## Notes

- [P] = different files, no incomplete-task file conflicts
- [USn] maps to spec.md user stories for traceability
- Tasks total: **20**（含测试；符合 Constitution XII ≤30；plan 预估 ≤28）
- 前台 Vite 监听 `0.0.0.0`；统计入口 URL 必须带 `playerId`
- 需要重启后台时由人工执行，Agent 不自行重启
- 前台 bug 修复后停等人工验证，不自动跑 Playwright
- Commit after each task or logical group when requested
- Avoid: vague tasks, silent 003/005 contract edits, 姓名模糊 high 映射, 合并两域球员表
