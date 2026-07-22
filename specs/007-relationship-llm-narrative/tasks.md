# Tasks: 关系分析 LLM 叙事解读

**Input**: Design documents from `/specs/007-relationship-llm-narrative/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

**Prerequisites Feature**: [005 球员关系分析](../005-player-relationship-analysis/spec.md) 分析可就绪；[001 认证](../001-football-feed-mvp/spec.md) 登录策略与关系页一致。本 feature 兑现 005 **FR-019**，解除 005 **FR-018** 对本能力的「本 MVP 不交付」限制（仅限本 feature，不改写 005 履历计算）。**禁止**在 007 内静默修改 005/006 的 `contracts/openapi.yaml` 或 `data-model.md`；若未来必须扩展 005 分析响应挂载叙事字段，须先在 005 `tasks.md` 增补协作任务。

**Tests**: Constitution 原则 III — 叙事生成/核验/限流/降级 MUST 单元测试 Mock 适配器 **100% 分支覆盖**；契约测试 MUST 覆盖 GET/POST 叙事端点（401/409/200/404/422/429/408/503）。前台 UI 人工测试（非 Playwright），须在 US2 Checkpoint 标注截图与交互断言检查点。

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to — `[US1]` / `[US2]` / `[US3]`（仅 User Story 阶段）
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `server/src/`, `server/tests/`, `server/prompts/`
- **Frontend**: `web/src/`
- **Contracts**: `specs/007-relationship-llm-narrative/contracts/openapi.yaml`
- **Migrations**: `server/src/db/migrations/`
- **Docs**: `specs/007-relationship-llm-narrative/`

> **跨模块依赖**：PlayerPairAnalysis / CareerPlayer / User 以对端 data-model 与 contracts 为准，只读消费。007 新增独立叙事资源与表；服务层只读调用 005 已有分析仓储/服务。不修改 005 `014_player_relationship.sql` 结论计算语义。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 外置 Prompt 与配置说明，无新运行时依赖

- [x] T001 [P] Create external relationship narrative prompt (facts-only, no honor claims, unknown/not_established tone, JSON output with narrative+claims) in `server/prompts/relationship-narrative.md`
- [x] T002 [P] Document `agentId=relationship` / narrative rate-limit / timeout notes in `server/.env.example`（注释说明；不新增第二套供应商密钥）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: SQLite 叙事表与 Repository — 所有 User Story 的阻塞前置

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create SQLite migration for `relationship_narratives` (unique `(analysis_id, analysis_computed_at)`, indexes) and optional `agent_profiles` seed `relationship` (timeout_ms=45000) in `server/src/db/migrations/016_relationship_narratives.sql`（禁止 ALTER 005 `player_pair_analyses` 结论字段）
- [x] T004 Implement relationship-narrative repository (find by pair+version, upsert ready, mark failed optional) in `server/src/db/repositories/relationship-narrative-repository.js`

**Checkpoint**: Foundation ready — 016 可迁移；叙事仓储可被 Agent/Service 调用

---

## Phase 3: User Story 1 - 基于已入库结论生成关系叙事 (Priority: P1) 🎯 MVP

**Goal**: 登录用户对 `status=ready` 的球员对请求一次性简体中文叙事；输入仅限已入库履历摘要与 005 结构化结论；经 `AiRelationshipService` + 外置 Prompt；核验通过后持久化；矛盾/超时/上游失败不采信（FR-001～FR-004、FR-007～FR-009、FR-013；SC-001、SC-002）

**Independent Test**: 对一对分析就绪且含至少一项明确关系结论的球员对 POST 叙事；返回中文介绍且事实主张可在结构化结论中核对；无关联对如实说明；未就绪 409；未登录 401。见 quickstart.md §3–§4、§7

### Tests for User Story 1

> **NOTE**: Write these tests FIRST; ensure they FAIL before implementation

- [x] T005 [P] [US1] Unit tests for claim verification (clubmate/transfer/path allow-list, unknown/not_established not upgraded, honor claims reject, contradictory narrative reject) with 100% branch coverage in `server/tests/unit/relationship-narrative-verifier.test.js`
<!-- bugfix 2026-07-22: 覆盖 005 nationalTeammateDetails.entityName 允许集合 -->
<!-- bugfix 2026-07-22: verdict aspect=transfer / nationmates 别名 -->
- [x] T006 [P] [US1] Unit tests for ready-gate, Mock AI success/timeout/upstream fail, verification failure path, and `assertAiRateLimit({ agentId: 'relationship' })` 429 with 100% branch coverage in `server/tests/unit/relationship-narrative-agent.test.js`
- [x] T007 [P] [US1] Contract tests for `POST /player-pair-analyses/{playerIdA}/{playerIdB}/narrative` (401, 409 not ready, 200 structure with `aiGenerated`/`reused`, 422 verification_failed, 429, 408/503) in `server/tests/contract/relationship-narratives.test.js`

### Implementation for User Story 1

- [x] T008 [P] [US1] Implement `AiRelationshipService` and register `createAiRelationshipService` in `server/src/ai/ai-relationship-service.js` and `server/src/ai/factory.js`（经既有 OpenAI 兼容 adapter；写 `agent_interaction_logs`）
- [x] T009 [P] [US1] Implement `relationship-narrative-verifier` (build allowed facts from 005 `result`, validate claims + conservative name check) in `server/src/services/relationship-narrative-verifier.js`
<!-- bugfix 2026-07-22: nationalTeammateDetails 收录 entityName，避免 Portugal 等国家队名误拒 -->
<!-- bugfix 2026-07-22: 支持 Prompt 的 verdict aspect=transfer / nationmates -->
- [x] T010 [US1] Implement `RelationshipNarrativeAgent` (load prompt, assemble minimal context from ready analysis, call AI, parse JSON, verify, persist) in `server/src/agents/relationship-narrative-agent.js`
- [x] T011 [US1] Implement `relationship-narrative-service` (authenticate caller context, ready check, rate-limit only on real generate, orchestrate agent) in `server/src/services/relationship-narrative-service.js`
- [x] T012 [US1] Implement POST narrative route and mount in `server/src/api/relationship-narratives.js` and `server/src/app.js`（对齐 `specs/007-relationship-llm-narrative/contracts/openapi.yaml`）

**Checkpoint**: User Story 1 可独立验收 — Mock 路径生成/核验/限流/降级可测；真实就绪样例可 POST 得中文叙事（对齐 SC-001/SC-002 后端面）

---

## Phase 4: User Story 2 - 关系页展示叙事与失败降级 (Priority: P2)

**Goal**: 关系分析页提供叙事区与生成/加载/失败反馈；标明 AI 基于本页结论；超时/限流/失败时结构化面板仍完整（FR-005、FR-006、FR-011；SC-002、SC-003）

**Independent Test**: 打开已就绪分析页，触发「生成关系解读」看到正文与 AI 标识；模拟失败/超时后结构化结论仍可见且有明确提示。见 quickstart.md §6

### Implementation for User Story 2

- [x] T013 [P] [US2] Add web API client for narrative GET/POST (incl. `force`) in `web/src/api/relationship-narratives.ts`
- [x] T014 [P] [US2] Create `RelationshipNarrativePanel` (disabled when analysis not ready; empty CTA; loading; success + AI badge; error/timeout/429 + retry) in `web/src/components/relationship/RelationshipNarrativePanel.vue`
- [x] T015 [US2] Integrate narrative panel into relationship page without replacing structured conclusion UI in `web/src/views/RelationshipAnalysisView.vue`

**Checkpoint**: User Stories 1+2 可独立验收 — 关系页可触发生成并降级保留结构化面板（对齐 SC-002/SC-003）

**Manual UI Verification [US2]**（人工，非 Playwright）:
- 截图：成功叙事 +「由 AI 基于本页结构化结论生成」标识
- 截图：失败/超时提示可见，结构化时间线/关系图仍完整
- 交互断言：分析未就绪时生成按钮禁用；限流提示「稍后重试」；失败可重试且不清空结论区

---

## Phase 5: User Story 3 - 叙事可重入与按结论版本复用 (Priority: P3)

**Goal**: 同一球员对、同一结论版本可持久化复用；进入页面可快速展示已有叙事；`force` 或分析 `computed_at` 变更后可重新生成；未登录拒绝（FR-007、FR-010；SC-004）

**Independent Test**: 同就绪球员对连续两次请求叙事，第二次 `reused=true` 且秒级返回；强制重算分析后可生成新版本叙事；无 token → 401。见 quickstart.md §4–§5

### Tests for User Story 3

- [x] T016 [P] [US3] Unit tests for version-key reuse, `force=true` regenerate, stale when `computed_at` changes, cache-hit skips rate-limit in `server/tests/unit/relationship-narrative-service.test.js`
- [x] T017 [US3] Contract tests for `GET .../narrative` (200 match, 404 none/stale, 401, 409) and POST reuse (`reused=true`) in `server/tests/contract/relationship-narratives.test.js`（与 T007 同文件，串行增补）

### Implementation for User Story 3

- [x] T018 [US3] Complete GET narrative + POST default-reuse / `force` overwrite against `(analysis_id, analysis_computed_at)` in `server/src/services/relationship-narrative-service.js` and `server/src/api/relationship-narratives.js`
- [x] T019 [US3] Auto-load existing narrative on page enter; show stale hint after analysis refresh; allow regenerate with `force` in `web/src/components/relationship/RelationshipNarrativePanel.vue` and `web/src/views/RelationshipAnalysisView.vue`

**Checkpoint**: All user stories independently functional — 重入复用与版本刷新闭环（对齐 FR-010、SC-004）

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 边界验证、覆盖率门禁、人工验收与文档对齐

- [x] T020 [P] Run quickstart.md validation checklist and record results in `specs/007-relationship-llm-narrative/quickstart.md`（或同目录验收笔记；含至少 1 次真实模型调用走查）
- [x] T021 [P] Confirm Scope 边界：007 无 diff 改写 005/006 `contracts/openapi.yaml` / `data-model.md`；无多轮 conversation 端点；005 既有 unit/contract 仍 PASS（验证记录写入 `specs/007-relationship-llm-narrative/checklists/requirements.md` 或等价笔记）
- [x] T022 Verify AI-path unit coverage (verifier + agent + service rate-limit/degrade branches) reaches 100% via `server` Jest coverage for the touched modules
- [x] T023 Complete SC-001 sample spot-check (≥5 related pairs + ≥3 unrelated) and SC-003 failure-degrade manual pass; attach notes under `specs/007-relationship-llm-narrative/checklists/requirements.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **User Story 1 (Phase 3)**: Depends on Foundational — MVP backend generate path
- **User Story 2 (Phase 4)**: Depends on US1 POST API being available（可与 US3 并行部分前端准备工作，但集成验收依赖 US1）
- **User Story 3 (Phase 5)**: Depends on Foundational + US1 persistence；GET/reuse 可与 US2 前端并行部分工作
- **Polish (Phase 6)**: Depends on desired user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependency on US2/US3
- **User Story 2 (P2)**: After US1 API — independently testable on relationship page
- **User Story 3 (P3)**: After US1 persistence — independently testable via GET/reuse contracts + re-entry UX

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Verifier / AI service before Agent
- Agent before Service orchestration
- Service before API mount
- API before frontend integration
- Story complete before moving to next priority (unless parallel staffing)

### Parallel Opportunities

- T001 || T002 (Setup)
- After T003: T005 || T006 || T007 (US1 tests); T008 || T009 (AI + verifier)
- T013 || T014 (US2 client + panel)
- T016 then T017 (US3：单测可先写；契约增补与 T007 同文件须串行)
- T020 || T021 (Polish docs/boundary)

---

## Parallel Example: User Story 1

```powershell
# 可并行启动的 US1 测试任务：
# Task: "Unit tests ... relationship-narrative-verifier.test.js"
# Task: "Unit tests ... relationship-narrative-agent.test.js"
# Task: "Contract tests ... relationship-narratives.test.js"

# 可并行启动的实现任务（不同文件）：
# Task: "AiRelationshipService ... ai-relationship-service.js + factory.js"
# Task: "relationship-narrative-verifier ... relationship-narrative-verifier.js"
```

---

## Parallel Example: User Story 2

```powershell
# Task: "web API client ... relationship-narratives.ts"
# Task: "RelationshipNarrativePanel ... RelationshipNarrativePanel.vue"
# 然后串行：集成到 RelationshipAnalysisView.vue
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup（Prompt + 配置注释）
2. Complete Phase 2: Foundational（016 + repository）— CRITICAL
3. Complete Phase 3: User Story 1（Mock 全覆盖 + POST 生成）
4. **STOP and VALIDATE**：quickstart §3–§4 + SC-001 抽检样例至少 1 对
5. Demo 后端叙事能力后再进入 US2 UI

### Incremental Delivery

1. Setup + Foundational → 表与仓储就绪
2. US1 → 可生成可核验叙事（MVP）
3. US2 → 关系页展示与降级（用户可见闭环）
4. US3 → GET/复用/force/stale（成本与重入）
5. Polish → 边界验证、覆盖率、样例集与真实调用走查

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 backend (T005–T012)
   - Developer B: 可先起草 US2 组件壳（待 API 联调）
   - Developer C: US3 GET/reuse 契约与单测草稿
3. Stories integrate at relationship page without rewriting 005 contracts

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group（仅在用户要求时提交）
- Stop at any checkpoint to validate story independently
- 后台改动后由用户自行重启；Agent 不代为重启
- Avoid: vague tasks, same-file [P] conflicts, silently editing 005/006 OpenAPI
- FR 追溯：T003–T004→FR-010；T008–T012→FR-001～004/007～009/013；T013–T015→FR-005/006/011；T016–T019→FR-007/010；T021→FR-012
)
