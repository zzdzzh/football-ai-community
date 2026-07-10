# Sprint 3 进度追踪 — Scout Agent 与 Tactical Agent

**Feature**: 003-football-scout-tactical  
**Sprint 计划**: [sprint-3.md](./sprint-3.md)  
**开始**: 2026-07-24

---

## 批次 3.1 · Day 1 · MVP-3 环境配置

- [x] T001 Add PLAYER_SYNC_CRON to server/.env.example | L1:✅(126/126) L2:✅ |
- [x] T002 Extend environment config loader for player-sync cron settings in server/src/config/index.js | L1:✅(126/126) L2:✅ |
- [x] 🚧 **批次3.1门禁: L1 Step4 (`[APP_START_COMMAND]` 启动成功 + 新环境变量加载无报错)** | 结果: ✅ health:UP config:playerSyncCron=0 4 * * * |

---

## 批次 3.2 · Day 1–2 · Foundational — 球员数据层 + 同步 Job

- [x] T003 Create SQLite migration for players, player_stats_snapshots, player_sync_meta, message_feedback and messages column extensions in server/src/db/migrations/006_scout_tactical.sql | L1:✅(126/126) L2:✅ |
- [x] T004 [P] Implement player, player-stats-snapshot and player-sync-meta repositories in server/src/db/repositories/player-repository.js, server/src/db/repositories/player-stats-snapshot-repository.js and server/src/db/repositories/player-sync-meta-repository.js | L1:✅(126/126) L2:✅ |
- [x] T005 [P] Implement message-feedback repository in server/src/db/repositories/message-feedback-repository.js | L1:✅(126/126) L2:✅ |
- [x] T006 Extend FootballDataAdapter with squad and scorers endpoints in server/src/adapters/football-data-adapter.js | L1:✅(126/126) L2:✅ |
- [x] T007 Implement player-sync job with daily cron and internal trigger route in server/src/jobs/player-sync.js and server/src/app.js | L1:✅(126/126) L2:✅ |
- [x] T008 Implement players list and detail API in server/src/api/players.js and mount route in server/src/app.js | L1:✅(126/126) L2:✅ |
- [x] T009 Extend message-repository for recommendations_json and tactical_json persistence in server/src/db/repositories/message-repository.js | L1:✅(126/126) L2:✅ |
- [x] 🚧 **批次3.2门禁: L1 Step4 (`[APP_START_COMMAND]` 启动成功 + 数据迁移通过 + player-sync trigger + players API 可调用)** | 结果: ✅ health:UP migration:006 player-sync:202 players:200 |

---

## 批次 3.3 · Day 2 · US1 契约与单元测试

- [ ] T010 [P] [US1] Contract tests for GET /players and POST /internal/jobs/player-sync in server/tests/contract/players.test.js and server/tests/contract/player-sync.test.js | L1:- L2:- |
- [ ] T011 [P] [US1] Contract tests for Scout conversations and message feedback in server/tests/contract/scout-conversations.test.js | L1:- L2:- |
- [ ] T012 [P] [US1] Unit tests for scout-context-builder and scout-agent with 100% branch coverage in server/tests/unit/scout-context-builder.test.js and server/tests/unit/scout-agent.test.js | L1:- L2:- |
- [ ] 🚧 **批次3.3门禁: L1 Step4 (players/player-sync/scout-conversations 契约测试通过 + scout-agent/context-builder 100% 分支覆盖)** | 结果: - |

---

## 批次 3.4 · Day 3 · US1 后台 — Scout Agent 推荐闭环

- [ ] T013 [P] [US1] Create scout-recommend prompt and AiScoutService in server/prompts/scout-recommend.md and server/src/ai/ai-scout-service.js | L1:- L2:- |
- [ ] T014 [US1] Implement scout-context-builder with league filter and candidate cap in server/src/services/scout-context-builder.js | L1:- L2:- |
- [ ] T015 [US1] Implement scout-agent orchestration with recommendations_json persistence in server/src/agents/scout-agent.js | L1:- L2:- |
- [ ] T016 [US1] Extend conversation-service and conversations API for agentId=scout and feedback endpoint in server/src/services/conversation-service.js and server/src/api/conversations.js | L1:- L2:- |
- [ ] 🚧 **批次3.4门禁: L1 Step4 (`[APP_START_COMMAND]` + Scout conversations API 调用链成功 + 推荐含 ≥3 球员与 keyStats)** | 结果: - |

---

## 批次 3.5 · Day 4 · US1 前台 — Scout 推荐 UI

- [ ] T017 [P] [US1] Extend web API clients for players and scout conversations in web/src/api/players.ts and web/src/api/conversations.ts | L1:- L2:- |
- [ ] T018 [P] [US1] Implement ScoutStartView and scout components in web/src/views/ScoutStartView.vue, web/src/components/scout/ScoutFilterForm.vue and web/src/components/scout/PlayerRecommendationCard.vue | L1:- L2:- |
- [ ] T019 [US1] Extend ConversationView for scout recommendations and register /scout route in web/src/views/ConversationView.vue and web/src/router/index.ts | L1:- L2:- |
- [ ] 🚧 **批次3.5门禁: L1 Step4 + 👁 HV-1 (~5 min, 产品/用户)** | 结果: - |

---

## 批次 3.6 · Day 4 · US2 契约与单元测试

- [ ] T020 [P] [US2] Contract tests for Tactical conversations in server/tests/contract/tactical-conversations.test.js | L1:- L2:- |
- [ ] T021 [P] [US2] Unit tests for tactical-context-builder and tactical-agent with 100% branch coverage in server/tests/unit/tactical-context-builder.test.js and server/tests/unit/tactical-agent.test.js | L1:- L2:- |
- [ ] 🚧 **批次3.6门禁: L1 Step4 (tactical-conversations 契约测试通过 + tactical-agent/context-builder 100% 分支覆盖)** | 结果: - |

---

## 批次 3.7 · Day 4–5 · US2 后台 — Tactical Agent 分析闭环

- [ ] T022 [P] [US2] Create tactical-analysis prompt and AiTacticalService in server/prompts/tactical-analysis.md and server/src/ai/ai-tactical-service.js | L1:- L2:- |
- [ ] T023 [US2] Implement tactical-context-builder with analysisType derivation and data-limitation guard in server/src/services/tactical-context-builder.js | L1:- L2:- |
- [ ] T024 [US2] Implement tactical-agent orchestration with tactical_json persistence in server/src/agents/tactical-agent.js | L1:- L2:- |
- [ ] T025 [US2] Extend conversation-service and conversations API for agentId=tactical in server/src/services/conversation-service.js and server/src/api/conversations.js | L1:- L2:- |
- [ ] 🚧 **批次3.7门禁: L1 Step4 (`[APP_START_COMMAND]` + Tactical conversations API 调用链成功 + 回复含阵型与战术阶段)** | 结果: - |

---

## 批次 3.8 · Day 5 · US2 前台 — 战术分析 UI + 比赛页入口

- [ ] T026 [P] [US2] Implement TacticalStartView, tactical components and MatchDetailView entry in web/src/views/TacticalStartView.vue, web/src/components/tactical/TacticalPhasePanel.vue, web/src/components/tactical/FormationBadge.vue and web/src/views/MatchDetailView.vue | L1:- L2:- |
- [ ] T027 [US2] Extend ConversationView for tactical analysis rendering and register /tactical route in web/src/views/ConversationView.vue and web/src/router/index.ts | L1:- L2:- |
- [ ] 🚧 **批次3.8门禁: L1 Step4 (`[APP_START_COMMAND]` + `[UI_START_COMMAND]` + `[TYPECHECK_COMMAND]` + 比赛页→战术分析导航成功)** | 结果: - |

---

## 批次 3.9 · Day 5 · Polish 收官

- [ ] T028 Run 002 Stats conversations contract regression and MVP-3 scope boundary audit per plan.md Scope 边界验证清单 in server/tests/contract/conversations.test.js and specs/003-football-scout-tactical/quickstart.md | L1:- L2:- |
- [ ] 🚧 **批次3.9门禁: L1 Step4 + 👁 HV-2 (~15–20 min, 产品/用户)** | 结果: - |
