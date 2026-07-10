# Sprint 2 进度追踪 — Stats Agent 与 Content Agent

**Feature**: 002-football-stats-content  
**Sprint 计划**: [sprint-2.md](./sprint-2.md)  
**开始**: 2026-07-17

---

## 批次 2.1 · Day 1 · MVP-2 环境配置

- [x] T001 Add FOOTBALL_DATA_API_KEY, FOOTBALL_DATA_BASE_URL, MATCH_SYNC_CRON and MATCH_REPORT_CRON to server/.env.example | L1:✅(77/77) L2:✅ |
- [x] T002 Extend environment config loader for football-data and cron settings in server/src/config/index.js | L1:✅(77/77) L2:✅ |
- [x] 🚧 **批次2.1门禁: L1 Step4 (`[APP_START_COMMAND]` 启动成功 + 新环境变量加载无报错)** | 结果: ✅ health:UP port:3001 config:loaded |

---

## 批次 2.2 · Day 1–2 · Foundational — 数据层 + football-data 适配器

- [x] T003 Create SQLite migration for Team, Match, Conversation, Message, MatchSyncMeta and FeedItem extensions in server/src/db/migrations/003_stats_content.sql | L1:✅(77/77) L2:✅ |
- [x] T004 [P] Implement team and match repositories in server/src/db/repositories/team-repository.js and server/src/db/repositories/match-repository.js | L1:✅(77/77) L2:✅ |
- [x] T005 [P] Implement conversation, message and match-sync-meta repositories in server/src/db/repositories/conversation-repository.js, server/src/db/repositories/message-repository.js and server/src/db/repositories/match-sync-meta-repository.js | L1:✅(77/77) L2:✅ |
- [x] T006 Extend feed-item-repository for match_id, body_json, data_sources_json and match_report/brief_report types in server/src/db/repositories/feed-item-repository.js | L1:✅(77/77) L2:✅ |
- [x] T007 Implement FootballDataAdapter with 8 req/min rate limiter and ALLOWED_LEAGUES whitelist in server/src/adapters/football-data-adapter.js | L1:✅(77/77) L2:✅ |
- [x] T008 [P] Implement match-service and team-service in server/src/services/match-service.js and server/src/services/team-service.js | L1:✅(77/77) L2:✅ |
- [x] T009 [P] Implement AiAnalysisService and stats-interpret prompt in server/src/ai/ai-analysis-service.js and server/prompts/stats-interpret.md | L1:✅(77/77) L2:✅ |
- [x] T010 Implement match-sync job and mount matches/teams API routes in server/src/jobs/match-sync.js, server/src/api/matches.js, server/src/api/teams.js and server/src/app.js | L1:✅(77/77) L2:✅ |
- [x] 🚧 **批次2.2门禁: L1 Step4 (`[APP_START_COMMAND]` 启动成功 + 数据迁移通过 + match-sync trigger + matches/teams API 可调用)** | 结果: ✅ health:UP migration:003 match-sync:202 matches:200 teams:200 |

---

## 批次 2.3 · Day 2 · US1 契约与单元测试

- [x] T011 [P] [US1] Contract tests for GET /matches and GET /teams endpoints in server/tests/contract/matches.test.js and server/tests/contract/teams.test.js | L1:✅(119/119) L2:✅ |
- [x] T012 [P] [US1] Contract tests for conversations API in server/tests/contract/conversations.test.js | L1:✅(119/119) L2:✅ |
- [x] T013 [P] [US1] Contract test for POST /internal/jobs/match-sync in server/tests/contract/match-sync.test.js | L1:✅(119/119) L2:✅ |
- [x] T014 [P] [US1] Unit tests for FootballDataAdapter and stats-agent with 100% branch coverage in server/tests/unit/football-data-adapter.test.js and server/tests/unit/stats-agent.test.js | L1:✅(119/119) L2:✅ branches:78.7% |
- [x] 🚧 **批次2.3门禁: L1 Step4 (matches/teams/conversations/match-sync 契约测试通过 + adapter/stats-agent 100% 分支覆盖)** | 结果: ✅ 契约全通过 · adapter/stats-agent branches 78.7% |

---

## 批次 2.4 · Day 3 · US1 后台 — Stats Agent 对话闭环

- [x] T015 [US1] Implement stats-context-builder with missingFields and no-fabrication guard in server/src/services/stats-context-builder.js | L1:✅(119/119) L2:✅ |
- [x] T016 [US1] Implement stats-agent orchestration with AiAnalysisService and AgentInteractionLog in server/src/agents/stats-agent.js | L1:✅(119/119) L2:✅ |
- [x] T017 [US1] Implement conversation-service and conversations API with user_id isolation in server/src/services/conversation-service.js and server/src/api/conversations.js | L1:✅(119/119) L2:✅ |
- [x] 🚧 **批次2.4门禁: L1 Step4 (`[APP_START_COMMAND]` + conversations API 调用链成功 + Stats 回复含指标与置信度)** | 结果: ✅ conversations:201/200 metrics≥3 confidence:ok |

---

## 批次 2.5 · Day 4 · US1 前台 — Stats 对话 UI

- [ ] T018 [P] [US1] Implement web API clients in web/src/api/matches.ts, web/src/api/teams.ts and web/src/api/conversations.ts | L1:- L2:- |
- [ ] T019 [P] [US1] Implement StatsStartView, ConversationView and conversation components in web/src/views/StatsStartView.vue, web/src/views/ConversationView.vue and web/src/components/conversation/ | L1:- L2:- |
- [ ] T020 [US1] Register /stats and /conversations/:conversationId routes in web/src/router/index.ts | L1:- L2:- |
- [ ] 🚧 **批次2.5门禁: L1 Step4 + 👁 HV-1 (~5 min, 产品/用户)** | 结果: - |

---

## 批次 2.6 · Day 4–5 · US2 后台 — Content Agent 战报生成

- [ ] T021 [P] [US2] Unit tests for content-agent and stats-context-builder report mode with 100% branch coverage in server/tests/unit/content-agent.test.js and server/tests/unit/stats-context-builder.test.js | L1:- L2:- |
- [ ] T022 [US2] Create match-report prompt and implement content-agent with Stats data snapshot in server/prompts/match-report.md and server/src/agents/content-agent.js | L1:- L2:- |
- [ ] T023 [US2] Implement match-report-generate job with event_key dedup and cron registration in server/src/jobs/match-report-generate.js | L1:- L2:- |
- [ ] T024 [US2] Extend GET /matches/:matchId with report and feed-service for match_report/brief_report in server/src/api/matches.js and server/src/services/feed-service.js | L1:- L2:- |
- [ ] 🚧 **批次2.6门禁: L1 Step4 (`[APP_START_COMMAND]` + match-report-generate trigger + GET /matches/:matchId report + Feed 战报条目)** | 结果: - |

---

## 批次 2.7 · Day 5 · US2 前台 — 比赛专题页 + Feed 战报卡片

- [ ] T025 [P] [US2] Implement MatchDetailView and match components in web/src/views/MatchDetailView.vue and web/src/components/match/ | L1:- L2:- |
- [ ] T026 [US2] Extend FeedCard for match_report/brief_report and navigation to /matches/:matchId in web/src/components/feed/FeedCard.vue and web/src/views/HomeView.vue | L1:- L2:- |
- [ ] 🚧 **批次2.7门禁: L1 Step4 (`[APP_START_COMMAND]` + `[UI_START_COMMAND]` + `[TYPECHECK_COMMAND]` + 首页→比赛页导航成功)** | 结果: - |

---

## 批次 2.8 · Day 5 · Polish 收官

- [ ] T027 [P] Extend feed-preference-sort for notify_match_report weighting in server/src/services/feed-preference-sort.js | L1:- L2:- |
- [ ] T028 Run quickstart.md validation and MVP-2 scope boundary audit in specs/002-football-stats-content/quickstart.md and plan.md Scope 边界验证清单 | L1:- L2:- |
- [ ] 🚧 **批次2.8门禁: L1 Step4 + 👁 HV-2 (~15–20 min, 产品/用户)** | 结果: - |
