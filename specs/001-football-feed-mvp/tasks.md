# Tasks: 足球社区 Feed MVP

**Input**: Design documents from `/specs/001-football-feed-mvp/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

**Sprint Scope**: MVP-1 — User Story 1（浏览新闻摘要动态）+ User Story 2（管理个人关注与 Agent 偏好）

**Tests**: 认证（100% 分支）、Feed/Preferences 契约测试。前台 UI 人工测试。

**Organization**: Tasks grouped by user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel
- **[Story]**: US1 or US2

## Path Conventions

- **Backend**: `server/src/`, `server/tests/`, `server/prompts/`
- **Frontend**: `web/src/`
- **Contracts**: `specs/001-football-feed-mvp/contracts/openapi.yaml`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 初始化前后端项目脚手架与开发环境配置

- [ ] T001 Create server/ and web/ directory structure per plan.md Project Structure section
- [ ] T002 [P] Initialize server/package.json with Express, better-sqlite3, jsonwebtoken, bcryptjs, zod, jest dependencies in server/package.json
- [ ] T003 [P] Initialize web/package.json with Vue 3, Vite 5, TypeScript, Element Plus, Pinia, Vue Router in web/package.json
- [ ] T004 [P] Configure Vite dev server to listen on 0.0.0.0 in web/vite.config.ts
- [ ] T005 [P] Update root .gitignore for node_modules, server/data/, server/.env, web/.env in .gitignore

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 数据库、认证、AI 抽象层、中间件与测试基础设施

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Create SQLite migration for MVP-1 entities (User, AgentProfile, FeedItem, UserPreference, NewsCacheMeta, AgentInteractionLog) in server/src/db/migrations/001_initial.sql
- [ ] T007 [P] Create AgentProfile seed data for 6 agents in server/src/db/migrations/002_seed_agents.sql
- [ ] T008 [P] Implement database connection with PRAGMA foreign_keys in server/src/db/connection.js
- [ ] T009 [P] Implement environment config loader in server/src/config/index.js
- [ ] T010 [P] Implement request-id, structured logging, and error middleware in server/src/middleware/request-id.js, server/src/middleware/logging.js, server/src/middleware/error.js
- [ ] T011 Implement JWT auth middleware and RBAC role check in server/src/middleware/auth.js
- [ ] T012 Implement auth service and routes (register, login, me) in server/src/services/auth-service.js and server/src/api/auth.js
- [ ] T013 [P] Implement AI content service and OpenAI-compatible adapter in server/src/ai/ai-content-service.js and server/src/ai/adapters/openai-compatible.js
- [ ] T014 Implement Express app bootstrap with Swagger UI and route mounting in server/src/app.js and server/src/index.js
- [ ] T015 [P] Setup Jest contract test harness and auth contract tests in server/tests/contract/setup.js and server/tests/contract/auth.test.js
- [ ] T016 [P] Setup web foundation (router, axios client, layout shell, brand styles) in web/src/router/index.ts, web/src/api/client.ts, web/src/components/layout/AppLayout.vue, web/src/styles/variables.css and web/src/styles/global.css

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - 浏览新闻摘要动态 (Priority: P1) 🎯 MVP

**Goal**: 用户打开社区首页即可看到 News Agent 抓取并摘要的最新足球新闻

**Independent Test**: 触发 news-fetch 后，未登录用户打开 `/` 在 5 秒内看到 ≥5 条 24 小时内新闻摘要；点击条目进入 `/feed/:feedId` 可见完整摘要、原文链接、关键信息点

### Tests for User Story 1

- [ ] T017 [P] [US1] Contract tests for GET /feed and GET /feed/{feedId} in server/tests/contract/feed.test.js

### Implementation for User Story 1

- [ ] T018 [P] [US1] Implement FeedItem and NewsCacheMeta repositories in server/src/db/repositories/feed-item-repository.js and server/src/db/repositories/news-cache-meta-repository.js
- [x] T019 [US1] Implement news RSS adapter with multi-source fetch in server/src/adapters/news-rss-adapter.js
- [ ] T020 [US1] Create news-summary prompt and news-agent with AgentInteractionLog in server/prompts/news-summary.md and server/src/agents/news-agent.js
- [x] T021 [US1] Implement feed-service with dedup logic and unit tests in server/src/services/feed-service.js and server/tests/unit/news-dedup.test.js
- [ ] T022 [US1] Implement feed API routes (list, detail) in server/src/api/feed.js
- [x] T023 [US1] Implement news-fetch cron job and internal dev trigger in server/src/jobs/news-fetch.js
<!-- BUG 2026-07-23 fixed: T019 Sky BST + fetch/UA；T023 启动 stale 补偿抓取 -->
- [x] T024 [P] [US1] Implement feed UI (FeedList, FeedCard, SourceStatusBanner, HomeView, FeedDetailView) in web/src/components/feed/ and web/src/views/HomeView.vue and web/src/views/FeedDetailView.vue
<!-- BUG 2026-07-23: 列表分页 — FeedList 支持 page 翻页与 URL ?tab=&page= -->

**Checkpoint**: User Story 1 fully functional

**Manual UI Verification [US1]**: 截图 — 首页 Feed、新闻源降级提示、Feed 详情页

---

## Phase 4: User Story 2 - 管理个人关注与 Agent 偏好 (Priority: P2)

**Goal**: 注册用户可设置关注球队/联赛与 Agent 偏好，首页动态按偏好加权排序

**Independent Test**: 登录用户设置偏好后返回首页，相关内容占比 ≥60%；关闭某 Agent 后刷新首页不再出现该类型动态

### Tests for User Story 2

- [ ] T025 [P] [US2] Contract tests for GET/PUT /users/me/preferences in server/tests/contract/preferences.test.js

### Implementation for User Story 2

- [ ] T026 [P] [US2] Implement UserPreference repository and preferences API in server/src/db/repositories/user-preference-repository.js and server/src/api/preferences.js
- [ ] T027 [US2] Extend feed-service with preference-weighted sorting and enabled_agents filter in server/src/services/feed-service.js
- [ ] T028 [P] [US2] Implement auth views and Pinia auth store in web/src/views/LoginView.vue, web/src/views/RegisterView.vue, web/src/stores/auth.ts
- [ ] T029 [US2] Implement PreferencesView with label-top form rows in web/src/views/PreferencesView.vue

**Checkpoint**: User Stories 1 AND 2 both work independently

**Manual UI Verification [US2]**: 截图 — 登录/注册、偏好设置、偏好生效后首页变化

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T030 Unit tests for auth JWT/bcrypt (100% branch coverage) and quickstart.md validation plus MVP-1 scope boundary audit (zero billing, AgentProfile read-only) in server/tests/unit/auth.test.js per specs/001-football-feed-mvp/quickstart.md and plan.md Scope 边界验证清单

---

## Dependencies & Execution Order

- **Phase 1** → **Phase 2** → **Phase 3 (US1)** → **Phase 4 (US2)** → **Phase 5**
- US2 的 T027 依赖 US1 的 T021 feed-service

## Implementation Strategy

1. Complete Phase 1–2（脚手架 + 基础能力）
2. Complete Phase 3（新闻 Feed 闭环）
3. Complete Phase 4（个性化增强）
4. Complete Phase 5（测试与收尾）
5. **STOP and VALIDATE**: quickstart.md + Manual UI Verification

## Notes

- 本 spec 共 **30 项任务**（T001–T030），符合原则 XII
- 后续 Sprint 见 [002](../002-football-stats-content/spec.md)、[003](../003-football-scout-tactical/spec.md)、[004](../004-football-fan-community/spec.md)
- 前台 bug 修正后停止等待人工验证；后台重启由用户手动执行
