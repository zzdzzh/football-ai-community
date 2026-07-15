# Tasks: 足球球员关系分析

**Input**: Design documents from `/specs/005-player-relationship-analysis/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

**Prerequisites Feature**: [001-football-feed-mvp](../001-football-feed-mvp/spec.md) 已完成（User / Auth / JWT）。本 feature **不依赖、不修改** [003-football-scout-tactical](../003-football-scout-tactical/spec.md) 的 Player 契约。

**Tests**: Constitution 原则 III — 履历同步降级、时间归一、关系判定/BFS 路径须单元测试 100% 分支覆盖（Mock 外部采集）；`career-players` / `player-pair-analyses` 契约测试须覆盖 401。前台 UI 人工测试（非 Playwright），须在各 US Checkpoint 标注截图与交互断言检查点。

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to — `[US1]` / `[US2]` / `[US3]`（仅 User Story 阶段）
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `server/src/`, `server/tests/`
- **Frontend**: `web/src/`
- **Scraper**: `scraper/scraper/`
- **Contracts**: `specs/005-player-relationship-analysis/contracts/openapi.yaml`
- **Migrations**: `server/src/db/migrations/`

> **跨模块依赖**：User / Auth 以 [001 data-model](../001-football-feed-mvp/data-model.md) 与 [001 contracts](../001-football-feed-mvp/contracts/openapi.yaml) 为准，仅复用 `requireAuth`。**禁止**修改 001/003 的 `contracts/openapi.yaml` 或 `players` 表。若未来需要统一球员身份，须在 `specs/003-football-scout-tactical/tasks.md` 增补映射任务后再改对端。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 履历同步与关系分析配置项（MVP-1～4 脚手架已就绪）

- [x] T001 Add CAREER_SYNC_TTL_DAYS, RELATIONSHIP_MAX_HOPS and CAREER_SYNC_TIMEOUT_MS to server/.env.example
- [x] T002 Extend environment config loader for career sync TTL, max hops and sync timeout in server/src/config/index.js

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: SQLite 履历域表、Repository、时间归一、Transfermarkt 采集 CLI/Adapter、按需同步服务 — 所有 User Story 的阻塞前置

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create SQLite migration for career_players, career_clubs, club_stints, national_team_stints and player_pair_analyses in server/src/db/migrations/014_player_relationship.sql
- [x] T004 [P] Implement career-player and career-club repositories in server/src/db/repositories/career-player-repository.js and server/src/db/repositories/career-club-repository.js
- [x] T005 [P] Implement club-stint and national-team-stint repositories in server/src/db/repositories/club-stint-repository.js and server/src/db/repositories/national-team-stint-repository.js
- [x] T006 [P] Implement player-pair-analysis repository in server/src/db/repositories/player-pair-analysis-repository.js
- [x] T007 [P] Implement time-normalize helpers (exact/month/year/season/open_ended/unparseable) in server/src/services/time-normalize.js
- [ ] T008 [P] Implement Transfermarkt career search/profile CLI in scraper/scraper/transfermarkt_career.py
- [ ] T009 Implement CareerDataAdapter and extend scraper-runner career CLI spawn in server/src/adapters/career-data-adapter.js and server/src/adapters/scraper-runner.js
- [ ] T010 Implement CareerSyncService with TTL, per-player replace transaction and zero-fabricated fallback in server/src/services/career-sync-service.js

**Checkpoint**: Foundation ready — 014 可迁移；仓储/归一/采集/同步可被 user story 调用

---

## Phase 3: User Story 1 - 双球员搜索与直接关系分析 (Priority: P1) 🎯 MVP

**Goal**: 登录用户搜索并消歧选定两名球员后，判定俱乐部队友/国家队队友（时间交集），展示共同球队与共同时段；履历缺失或外源失败时友好失败与重试，零虚构（FR-001～FR-011、FR-003、FR-008）

**Independent Test**: 本地已有梅西与苏亚雷斯俱乐部履历时，打开 `/relationships` → 显式选择两人 → 进入 `/relationships/{playerIdA}/{playerIdB}`，10 秒内看到「曾经是俱乐部队友」、共同俱乐部含 FC Barcelona 及可验证共同时段；未登录 401/引导登录；重名未选定前不可提交。见 quickstart.md §4–5

### Tests for User Story 1

> **NOTE**: Write these tests FIRST; ensure they FAIL before implementation

- [ ] T011 [P] [US1] Contract tests for GET /career-players, GET /career-players/{playerId} and POST /career-players/{playerId}/sync (incl. 401) in server/tests/contract/career-players.test.js
- [ ] T012 [P] [US1] Contract tests for GET/POST /player-pair-analyses (direct clubmates/national, self-pair 400, 401) in server/tests/contract/player-pair-analyses.test.js
- [ ] T013 [P] [US1] Unit tests for time-normalize with 100% branch coverage in server/tests/unit/time-normalize.test.js
- [ ] T014 [P] [US1] Unit tests for clubmates and national-teammates overlap verdicts with 100% branch coverage in server/tests/unit/relationship-analysis.test.js
- [ ] T015 [P] [US1] Unit tests for career-sync failure/cache degradation with 100% branch coverage in server/tests/unit/career-sync.test.js

### Implementation for User Story 1

- [ ] T016 [US1] Implement RelationshipAnalysisService direct clubmates/nationalTeammates verdicts and details in server/src/services/relationship-analysis-service.js
- [ ] T017 [US1] Implement career-players API (search/detail/sync) with requireAuth and mount routes in server/src/api/career-players.js and server/src/app.js
- [ ] T018 [US1] Implement player-pair-analyses API (GET reentry + POST retry) for direct relations, freshness and computing status in server/src/api/player-pair-analyses.js and server/src/app.js
- [ ] T019 [P] [US1] Add web API clients for career-players and player-pair-analyses in web/src/api/career-players.ts and web/src/api/player-pair-analyses.ts
- [ ] T020 [US1] Implement RelationshipSearchView and PlayerPicker (label-on-top dual search, explicit disambiguation) in web/src/views/RelationshipSearchView.vue and web/src/components/relationship/PlayerPicker.vue
- [ ] T021 [US1] Implement RelationshipAnalysisView text conclusions + FreshnessBanner, register /relationships and /relationships/:playerIdA/:playerIdB routes and AppLayout nav entry in web/src/views/RelationshipAnalysisView.vue, web/src/components/relationship/FreshnessBanner.vue, web/src/router/index.ts and web/src/components/layout/AppLayout.vue

**Checkpoint**: User Story 1 闭环可独立验收 — 搜索消歧 → 双 ID 分析页 → 直接关系文字结论 + 新鲜度（对齐 FR-001～011、SC-001/SC-002）

**Manual UI Verification [US1]**: 截图 — `/relationships` 双搜索 + 候选消歧、未选手动前提交禁用、分析页俱乐部队友结论与共同时段、失败/重试态、未登录跳转 `/login` 回跳带双 ID URL

---

## Phase 4: User Story 2 - 转会关联与间接关系路径 (Priority: P2)

**Goal**: 在直接关系之外输出直接转会关联、先后加盟同一球队、最短间接路径与关系距离（≤ maxHops）；无可达路径时明确 no_path；URL 重入结论一致（FR-012～FR-014）

**Independent Test**: 选定无共同效力交集但可通过共同俱乐部连通的球员对，分析页展示非空间接路径、数值距离及「先后加入同一球队」等结论；跳数上限内不连通时展示明确无路径。刷新同一 URL 结果一致。见 quickstart.md §5、§8

### Tests for User Story 2

- [ ] T022 [P] [US2] Extend unit tests for transfer link, successiveSameClub and BFS indirect path (maxHops/no_path) with 100% branch coverage in server/tests/unit/relationship-analysis.test.js

### Implementation for User Story 2

- [ ] T023 [US2] Extend RelationshipAnalysisService for TransferLink, successiveSameClub and bipartite BFS path in server/src/services/relationship-analysis-service.js
- [ ] T024 [US2] Persist and return transfer/indirectPath/relationDistance/pathStatus on pair analysis responses (cache key by sorted IDs) in server/src/services/relationship-analysis-service.js and server/src/api/player-pair-analyses.js
- [ ] T025 [US2] Display transfer conclusions and indirect path/distance on RelationshipAnalysisView in web/src/views/RelationshipAnalysisView.vue

**Checkpoint**: User Stories 1+2 独立可验收 — 转会关联 + 间接最短路径 + 可重入（对齐 FR-012～014、SC-003）

**Manual UI Verification [US2]**: 截图 — 转会/先后加盟结论与依据摘要、路径节点球员/俱乐部交替展示、无路径文案、刷新 URL 结论一致

---

## Phase 5: User Story 3 - 关系时间线与关系图可视化 (Priority: P3)

**Goal**: 分析页以 SVG/CSS 时间线对齐履历并突出共同效力区间，以关系图展示与文字结论一致的球员/俱乐部节点与边；加载/空/失败态明确（FR-015～FR-017）

**Independent Test**: 对已有俱乐部队友的球员对，时间线标出共同效力区间，关系图可见两名球员与至少一个共同俱乐部及边；无关系时不出现虚假共同节点；加载中有明确同步状态。见 quickstart.md §5、§8

### Implementation for User Story 3

- [ ] T026 [P] [US3] Implement RelationshipTimeline SVG/CSS dual-track component in web/src/components/relationship/RelationshipTimeline.vue
- [ ] T027 [P] [US3] Implement RelationGraph SVG layered layout from relationPath nodes/edges in web/src/components/relationship/RelationGraph.vue
- [ ] T028 [US3] Integrate timeline, graph, loading/empty/error states into RelationshipAnalysisView in web/src/views/RelationshipAnalysisView.vue

**Checkpoint**: All user stories independently functional — 时间线与关系图与文字结论零矛盾（对齐 FR-015～017、SC-004）

**Manual UI Verification [US3]**: 截图 — 共同区间高亮时间线、路径一致关系图、无关系空状态仍可展示各自履历、computing/syncing 状态与完成后刷新

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 可观测性、范围边界回归与 quickstart 验收

- [ ] T029 [P] Emit career_sync_success/failure and pair_analysis_latency_ms/cache_hit metrics in server/src/services/career-sync-service.js and server/src/api/player-pair-analyses.js
- [ ] T030 Run Scope 边界验证清单 and quickstart.md regression (no 003 players ALTER, no LLM QA endpoint, maxHops no_path, zero fabricated stints) per specs/005-player-relationship-analysis/plan.md and specs/005-player-relationship-analysis/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **User Story 1 (Phase 3)**: Depends on Foundational completion
- **User Story 2 (Phase 4)**: Depends on US1 analysis service/API baseline (extends same modules)
- **User Story 3 (Phase 5)**: Depends on US1 analysis JSON (and preferably US2 path nodes for full graph)
- **Polish (Phase 6)**: Depends on desired user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependency on US2/US3
- **User Story 2 (P2)**: After US1 service/API exist — independently testable for path/transfer on fixture pairs
- **User Story 3 (P3)**: After US1 (text payload); path graph richest when US2 done — independently testable for viz correctness

### Within Each User Story

- Tests (T011–T015 / T022) SHOULD fail before implementation
- Models/repos (Phase 2) → services → endpoints → frontend
- Story Checkpoint + Manual UI Verification before next priority

### Parallel Opportunities

- **Phase 1**: T001 ‖ T002（不同文件）
- **Phase 2**: T004 ‖ T005 ‖ T006 ‖ T007 ‖ T008；T009 after T008；T010 after T009 + repos
- **Phase 3**: T011–T015 全部可并行；T019 可与 T017–T018 部分并行；T020 依赖 T019
- **Phase 4**: T022 可与 T023 前并行起草；T025 依赖 T024
- **Phase 5**: T026 ‖ T027；T028 after both
- **Phase 6**: T029 ‖ T030 可并行（不同关注点）

---

## Parallel Example: User Story 1

```text
# Launch contract and unit tests together:
T011 career-players.test.js
T012 player-pair-analyses.test.js
T013 time-normalize.test.js
T014 relationship-analysis.test.js (direct)
T015 career-sync.test.js

# After T016–T018 API ready:
T019 web API clients
T020 RelationshipSearchView + PlayerPicker
T021 RelationshipAnalysisView + routes + nav
```

---

## Parallel Example: User Story 3

```text
T026 RelationshipTimeline.vue
T027 RelationGraph.vue
# then
T028 integrate into RelationshipAnalysisView.vue
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational（CRITICAL）
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: 人工验收搜索→消歧→直接关系（SC-001/SC-002）
5. Demo / 继续增量

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → 直接关系 MVP
3. US2 → 转会 + 间接路径
4. US3 → 时间线 + 关系图
5. Polish → 指标与边界审计

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. After Foundational:
   - Dev A: US1 后端测试 + service + API
   - Dev B: US1 前台搜索/分析（依赖 API mock 可提前）
3. US2/US3 在 US1 Checkpoint 后增量交付

---

## Notes

- [P] = different files, no incomplete-task file conflicts
- [USn] maps to spec.md user stories for traceability
- Tasks total: **30**（含测试；符合 Constitution XII ≤30）
- 前台 Vite 监听 `0.0.0.0`；页面 URL 必须带 `playerIdA`/`playerIdB`
- 需要重启后台时由人工执行，Agent 不自行重启
- 前台 bug 修复后停等人工验证，不自动跑 Playwright
- Commit after each task or logical group when requested
- Avoid: vague tasks, silent 003 contract edits, LLM 解读端点
