# Sprint 4 进度追踪 — Fan Agent 与社区治理

**Feature**: 004-football-fan-community  
**Sprint 计划**: [sprint-4.md](./sprint-4.md)  
**开始**: 2026-07-31

---

## 批次 4.1 · Day 1 · MVP-4 环境配置

- [x] T001 Add FAN_CONTINUE_TIMEOUT_MS and CONTENT_MODERATION_BLOCKLIST to server/.env.example | L1:✅(202/202) L2:✅ |
- [x] T002 Extend environment config loader for fan timeout and moderation blocklist settings in server/src/config/index.js | L1:✅(202/202) L2:✅ |
- [x] 🚧 **批次4.1门禁: L1 Step4 (`[APP_START_COMMAND]` 启动成功 + 新环境变量加载无报错)** | 结果: ✅ health:UP config:loaded |

---

## 批次 4.2 · Day 1–2 · Foundational — Fan/Community 数据层 + 内容过滤 + Feed 扩展

- [x] T003 Create SQLite migration for fan_personas, fan_discussions, fan_discussion_personas, fan_discussion_turns, content_reports and Persona seed data in server/src/db/migrations/009_fan_community.sql | L1:✅(202/202) L2:✅ |
- [x] T004 [P] Implement fan-persona repository in server/src/db/repositories/fan-persona-repository.js | L1:✅(202/202) L2:✅ |
- [x] T005 [P] Implement fan-discussion, fan-discussion-persona and fan-discussion-turn repositories in server/src/db/repositories/fan-discussion-repository.js | L1:✅(202/202) L2:✅ |
- [x] T006 [P] Implement content-report repository in server/src/db/repositories/content-report-repository.js | L1:✅(202/202) L2:✅ |
- [x] T007 [P] Implement ContentModerationService with blocklist rules in server/src/services/content-moderation-service.js | L1:✅(202/202) L2:✅ |
- [x] T008 Extend feed-service for fan_discussion FeedItem publish, visibility filter and event_key dedup in server/src/services/feed-service.js | L1:✅(202/202) L2:✅ |
- [x] 🚧 **批次4.2门禁: L1 Step4 (`[APP_START_COMMAND]` 启动成功 + 数据迁移通过 + GET /fan-personas 可调用)** | 结果: ✅ migration:009_fan_community personas:19 fan-personas:200 moderation:ok |

---

## 批次 4.3 · Day 2 · US1 契约与单元测试

- [x] T009 [P] [US1] Contract tests for GET /fan-personas, POST/GET /fan-discussions and POST /fan-discussions/{id}/turns in server/tests/contract/fan-discussions.test.js | L1:✅(250/250) L2:✅ |
- [x] T010 [P] [US1] Contract tests for POST /content-reports in server/tests/contract/content-reports.test.js | L1:✅(250/250) L2:✅ |
- [x] T011 [P] [US1] Contract tests for GET /admin/content-reports, hide and dismiss actions in server/tests/contract/admin-reports.test.js | L1:✅(250/250) L2:✅ |
- [x] T012 [P] [US1] Unit tests for fan-context-builder with 100% branch coverage in server/tests/unit/fan-context-builder.test.js | L1:✅(250/250) L2:✅ |
- [x] T013 [P] [US1] Unit tests for fan-agent with 100% branch coverage in server/tests/unit/fan-agent.test.js | L1:✅(250/250) L2:✅ |
- [x] T014 [P] [US1] Unit tests for content-moderation-service with 100% branch coverage in server/tests/unit/content-moderation.test.js | L1:✅(250/250) L2:✅ |
- [x] 🚧 **批次4.3门禁: L1 Step4 (fan-discussions/content-reports/admin-reports 契约测试通过 + fan-agent/context-builder/content-moderation 100% 分支覆盖)** | 结果: ✅ contract:3/3 unit:100% branches |

---

## 批次 4.4 · Day 3 · US1 后台 — Fan Agent 讨论闭环 + 举报审核 API

- [x] T015 [P] [US1] Create fan-discussion prompt and AiFanService in server/prompts/fan-discussion.md and server/src/ai/ai-fan-service.js | L1:✅(250/250) L2:✅ |
- [x] T016 [US1] Implement fan-context-builder with optional matchId and feed snippet context in server/src/services/fan-context-builder.js | L1:✅(250/250) L2:✅ |
- [x] T017 [US1] Implement fan-discussion-service with turn persistence, persona association and Feed publish transaction in server/src/services/fan-discussion-service.js | L1:✅(250/250) L2:✅ |
- [x] T018 [US1] Implement fan-agent orchestration for initial batch and continue modes in server/src/agents/fan-agent.js | L1:✅(250/250) L2:✅ |
- [x] T019 [US1] Implement fan-discussions and fan-personas API and mount routes in server/src/api/fan-discussions.js and server/src/app.js | L1:✅(250/250) L2:✅ |
- [x] T020 [US1] Implement content-reports API and mount route in server/src/api/content-reports.js and server/src/app.js | L1:✅(250/250) L2:✅ |
- [x] T021 [US1] Implement admin-reports API and mount route in server/src/api/admin-reports.js and server/src/app.js | L1:✅(250/250) L2:✅ |
- [x] 🚧 **批次4.4门禁: L1 Step4 (`[APP_START_COMMAND]` + fan-discussions API 调用链成功 + ≥4 条 Persona 发言 + 违规 422)** | 结果: ✅ create:201 turns≥4 policy:422 |

---

## 批次 4.5 · Day 4 · US1 前台 — Fan 讨论 UI（核心路径）

- [x] T022 [P] [US1] Add web API clients for fan discussions and content reports in web/src/api/fan-discussions.ts and web/src/api/content-reports.ts | L1:✅ vue-tsc L2:✅ |
- [x] T023 [P] [US1] Implement FanStartView and PersonaPicker component in web/src/views/FanStartView.vue and web/src/components/fan/PersonaPicker.vue | L1:✅ vue-tsc L2:✅ |
- [x] T024 [US1] Implement FanDiscussionView, TurnBubble, ReportDialog and register /fan and /discussions/:discussionId routes in web/src/views/FanDiscussionView.vue, web/src/components/fan/TurnBubble.vue, web/src/components/fan/ReportDialog.vue and web/src/router/index.ts | L1:✅ vue-tsc L2:✅ |
- [ ] 🚧 **批次4.5门禁: L1 Step4 + 👁 HV-1 (~5 min, 产品/用户)** | 结果: L1:✅ vue-tsc · HV-1: 待签收 |

---

## 批次 4.6 · Day 5 · US1 前台 — 管理员审核 + Feed 集成

- [ ] T025 [US1] Implement AdminReportsView and register /admin/reports route in web/src/views/AdminReportsView.vue and web/src/router/index.ts | L1:- L2:- |
- [ ] T026 [US1] Extend FeedCard for fan_discussion type navigation and add /fan entry in web/src/components/feed/FeedCard.vue and web/src/router/index.ts | L1:- L2:- |
- [ ] 🚧 **批次4.6门禁: L1 Step4 (`[APP_START_COMMAND]` + `[UI_START_COMMAND]` + `[TYPECHECK_COMMAND]` + 举报→hide→Feed 不可见)** | 结果: - |

---

## 批次 4.7 · Day 5 · Polish 收官

- [ ] T027 Run 002/003 conversations contract regression and MVP-4 scope boundary audit per plan.md Scope 边界验证清单 in server/tests/contract/conversations.test.js and specs/004-football-fan-community/quickstart.md | L1:- L2:- |
- [ ] 🚧 **批次4.7门禁: L1 Step4 + 👁 HV-2 (~15–20 min, 产品/用户)** | 结果: - |

---

## Sprint 4 收官

**状态**: 进行中（批次 4.5）
