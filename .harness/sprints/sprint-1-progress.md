# Sprint 1 进度追踪 — 足球社区 Feed MVP

**Feature**: 001-football-feed-mvp  
**Sprint 计划**: [sprint-1.md](./sprint-1.md)  
**开始**: 2026-07-10

---

## 批次 1.1 · Day 1 · 项目脚手架初始化

- [x] T001 Create server/ and web/ directory structure per plan.md Project Structure section | L1:✅ L2:✅(10/10) |
- [x] T002 [P] Initialize server/package.json with Express, better-sqlite3, jsonwebtoken, bcryptjs, zod, jest dependencies in server/package.json | L1:✅ L2:✅(10/10) |
- [x] T003 [P] Initialize web/package.json with Vue 3, Vite 5, TypeScript, Element Plus, Pinia, Vue Router in web/package.json | L1:✅ L2:✅(10/10) |
- [x] T004 [P] Configure Vite dev server to listen on 0.0.0.0 in web/vite.config.ts | L1:✅ L2:✅(10/10) |
- [x] T005 [P] Update root .gitignore for node_modules, server/data/, server/.env, web/.env in .gitignore | L1:✅ L2:✅(10/10) |
- [x] 🚧 **批次1.1门禁: L1 Step4 (`[UI_START_COMMAND]` 启动成功 + 0.0.0.0 监听 + 依赖安装无报错)** | 结果: ✅ Vite ready 588ms, host:0.0.0.0, HTTP 200 |

---

## 批次 1.2 · Day 1–2 · 后台基础能力

- [x] T006 Create SQLite migration for MVP-1 entities (User, AgentProfile, FeedItem, UserPreference, NewsCacheMeta, AgentInteractionLog) in server/src/db/migrations/001_initial.sql | L1:✅ L2:✅(10/10) |
- [x] T007 [P] Create AgentProfile seed data for 6 agents in server/src/db/migrations/002_seed_agents.sql | L1:✅ L2:✅(10/10) |
- [x] T008 [P] Implement database connection with PRAGMA foreign_keys in server/src/db/connection.js | L1:✅ L2:✅(10/10) |
- [x] T009 [P] Implement environment config loader in server/src/config/index.js | L1:✅ L2:✅(10/10) |
- [x] T010 [P] Implement request-id, structured logging, and error middleware in server/src/middleware/request-id.js, server/src/middleware/logging.js, server/src/middleware/error.js | L1:✅ L2:✅(10/10) |
- [x] T011 Implement JWT auth middleware and RBAC role check in server/src/middleware/auth.js | L1:✅ L2:✅(10/10) |
- [x] T012 Implement auth service and routes (register, login, me) in server/src/services/auth-service.js and server/src/api/auth.js | L1:✅ L2:✅(10/10) |
- [x] T013 [P] Implement AI content service and OpenAI-compatible adapter in server/src/ai/ai-content-service.js and server/src/ai/adapters/openai-compatible.js | L1:✅ L2:✅(10/10) |
- [x] T014 Implement Express app bootstrap with Swagger UI and route mounting in server/src/app.js and server/src/index.js | L1:✅ L2:✅(10/10) |
- [x] T015 [P] Setup Jest contract test harness and auth contract tests in server/tests/contract/setup.js and server/tests/contract/auth.test.js | L1:✅(7/7) L2:✅(10/10) |
- [x] 🚧 **批次1.2门禁: L1 Step4 (`[APP_START_COMMAND]` 启动成功 + 数据迁移通过 + auth 契约测试通过)** | 结果: ✅ health:UP migration:V002 contract:7/7 |

---

## 批次 1.3 · Day 2 · 前台基础壳层

- [x] T016 [P] Setup web foundation (router, axios client, layout shell, brand styles) in web/src/router/index.ts, web/src/api/client.ts, web/src/components/layout/AppLayout.vue, web/src/styles/variables.css and web/src/styles/global.css | L1:✅ L2:✅(10/10) |
- [x] 🚧 **批次1.3门禁: L1 Step4 (`[UI_START_COMMAND]` 启动成功 + `[TYPECHECK_COMMAND]` 通过 + Layout 页面可访问)** | 结果: ✅ Vite HTTP 200, vue-tsc PASS, Layout 可访问 |

---

## 批次 2.1 · Day 3 · US1 后台 — News Agent + Feed API

- [x] T017 [P] [US1] Contract tests for GET /feed and GET /feed/{feedId} in server/tests/contract/feed.test.js | L1:✅(4/4) L2:✅(10/10) |
- [x] T018 [P] [US1] Implement FeedItem and NewsCacheMeta repositories in server/src/db/repositories/feed-item-repository.js and server/src/db/repositories/news-cache-meta-repository.js | L1:✅ L2:✅(10/10) |
- [x] T019 [US1] Implement news RSS adapter with multi-source fetch in server/src/adapters/news-rss-adapter.js | L1:✅ L2:✅ | <!-- BUG 2026-07-23 fixed: Sky BST + fetch/UA -->
- [x] T020 [US1] Create news-summary prompt and news-agent with AgentInteractionLog in server/prompts/news-summary.md and server/src/agents/news-agent.js | L1:✅ L2:✅(10/10) |
- [x] T021 [US1] Implement feed-service with dedup logic and unit tests in server/src/services/feed-service.js and server/tests/unit/news-dedup.test.js | L1:✅(5/5) L2:✅(10/10) |
- [x] T022 [US1] Implement feed API routes (list, detail) in server/src/api/feed.js | L1:✅ L2:✅(10/10) |
- [x] T023 [US1] Implement news-fetch cron job and internal dev trigger in server/src/jobs/news-fetch.js | L1:✅ L2:✅ | <!-- BUG 2026-07-23 fixed: 启动 stale 补偿 -->
- [x] 🚧 **批次2.1门禁: L1 Step4 (`[APP_START_COMMAND]` + news-fetch trigger + feed 契约测试通过 + GET /feed 返回数据)** | 结果: ✅ news-fetch:202, feed:1条, contract:4/4 |

---

## 批次 2.2 · Day 4 · US1 前台 — Feed 浏览 UI

- [x] T024 [P] [US1] Implement feed UI (FeedList, FeedCard, SourceStatusBanner, HomeView, FeedDetailView) in web/src/components/feed/ and web/src/views/HomeView.vue and web/src/views/FeedDetailView.vue | L1:✅ L2:✅(10/10) |
- [x] 🚧 **批次2.2门禁: L1 Step4 + 👁 HV-1 PASS** | 结果: ✅ 用户肉眼验收 + RSS/AI success(glm-5.2) + 首页Feed+详情页 |

---

## 批次 3.1 · Day 5 · US2 — 偏好与认证 UI

- [x] T025 [P] [US2] Contract tests for GET/PUT /users/me/preferences in server/tests/contract/preferences.test.js | L1:✅(5/5) L2:✅(10/10) |
- [x] T026 [P] [US2] Implement UserPreference repository and preferences API in server/src/db/repositories/user-preference-repository.js and server/src/api/preferences.js | L1:✅ L2:✅(10/10) |
- [x] T027 [US2] Extend feed-service with preference-weighted sorting and enabled_agents filter in server/src/services/feed-service.js | L1:✅ L2:✅(10/10) |
- [x] T028 [P] [US2] Implement auth views and Pinia auth store in web/src/views/LoginView.vue, web/src/views/RegisterView.vue, web/src/stores/auth.ts | L1:✅ L2:✅(10/10) |
- [x] T029 [US2] Implement PreferencesView with label-top form rows in web/src/views/PreferencesView.vue | L1:✅ L2:✅(10/10) |
- [x] 🚧 **批次3.1门禁: L1 Step4 (`[APP_START_COMMAND]` + `[UI_START_COMMAND]` + 登录→偏好→首页排序 调用链成功 + preferences 契约通过)** | 结果: ✅ contract:5/5, vue-tsc PASS, feed+preferences API 就绪 |

---

## 批次 4.1 · Day 5 · Polish 收官

- [x] T030 Unit tests for auth JWT/bcrypt (100% branch coverage) and quickstart.md validation plus MVP-1 scope boundary audit (zero billing, AgentProfile read-only) in server/tests/unit/auth.test.js per specs/001-football-feed-mvp/quickstart.md and plan.md Scope 边界验证清单 | L1:✅(28/28) auth分支100% L2:✅(10/10) |
- [x] 🚧 **批次4.1门禁: L1 Step4 + 👁 HV-2 PASS** | 结果: ✅ npm test 77/77 + RSS+AI success + US1/US2全路径用户签收 |
