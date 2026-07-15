# Sprint 5 进度追踪 — 球员关系分析

**Feature**: 005-player-relationship-analysis  
**Sprint 计划**: [sprint-5.md](./sprint-5.md)  
**开始**: 2026-07-16

---

## 批次 5.1 · Day 1 · 关系分析环境配置

- [x] T001 Add CAREER_SYNC_TTL_DAYS, RELATIONSHIP_MAX_HOPS and CAREER_SYNC_TIMEOUT_MS to server/.env.example | L1:✅ L2:✅(40/40) |
- [x] T002 Extend environment config loader for career sync TTL, max hops and sync timeout in server/src/config/index.js | L1:✅ L2:✅(40/40) |
- [x] 🚧 **批次5.1门禁: L1 Step4 (`[APP_START_COMMAND]` 启动成功 + 新环境变量加载无报错)** | 结果: ✅ health:UP config.careerSync/relationship 默认值加载正常 |

---

## 批次 5.2 · Day 1–2 · Foundational — 履历域表 + Repository + 时间归一

- [x] T003 Create SQLite migration for career_players, career_clubs, club_stints, national_team_stints and player_pair_analyses in server/src/db/migrations/014_player_relationship.sql | L1:✅ L2:✅(40/40) |
- [x] T004 [P] Implement career-player and career-club repositories in server/src/db/repositories/career-player-repository.js and server/src/db/repositories/career-club-repository.js | L1:✅ L2:✅(38/40) |
- [x] T005 [P] Implement club-stint and national-team-stint repositories in server/src/db/repositories/club-stint-repository.js and server/src/db/repositories/national-team-stint-repository.js | L1:✅ L2:✅(38/40) |
- [x] T006 [P] Implement player-pair-analysis repository in server/src/db/repositories/player-pair-analysis-repository.js | L1:✅ L2:✅(40/40) |
- [x] T007 [P] Implement time-normalize helpers (exact/month/year/season/open_ended/unparseable) in server/src/services/time-normalize.js | L1:✅ L2:✅(40/40) |
- [x] 🚧 **批次5.2门禁: L1 Step4 (`[APP_START_COMMAND]` 启动成功 + 数据迁移 014 通过 + 仓储/时间归一可调用)** | 结果: ✅ health:UP migration:014_player_relationship smoke:repos+time-normalize |

---

## 批次 5.3 · Day 2 · Foundational — Transfermarkt 采集 + 同步服务

- [x] T008 [P] Implement Transfermarkt career search/profile CLI in scraper/scraper/transfermarkt_career.py | L1:✅ L2:✅(38/40) |
- [x] T009 Implement CareerDataAdapter and extend scraper-runner career CLI spawn in server/src/adapters/career-data-adapter.js and server/src/adapters/scraper-runner.js | L1:✅ L2:✅(40/40) |
- [x] T010 Implement CareerSyncService with TTL, per-player replace transaction and zero-fabricated fallback in server/src/services/career-sync-service.js | L1:✅ L2:✅(40/40) |
- [x] 🚧 **批次5.3门禁: L1 Step4 (`[APP_START_COMMAND]` 启动成功 + CareerSyncService 同步事务 + 失败零虚构 + TM CLI 冒烟)** | 结果: ✅ health:UP mock同步+TTL+失败保留stints；TM search Messi + profile 8 stints via ceapi |

---

## 批次 5.4 · Day 2–3 · US1 契约与单元测试

- [x] T011 [P] [US1] Contract tests for GET /career-players, GET /career-players/{playerId} and POST /career-players/{playerId}/sync (incl. 401) in server/tests/contract/career-players.test.js | L1:✅ Red(0/9 预期 FAIL→T017) L2:✅(40/40) |
- [x] T012 [P] [US1] Contract tests for GET/POST /player-pair-analyses (direct clubmates/national, self-pair 400, 401) in server/tests/contract/player-pair-analyses.test.js | L1:✅ Red(0/10 预期 FAIL→T018) L2:✅(40/40) |
- [x] T013 [P] [US1] Unit tests for time-normalize with 100% branch coverage in server/tests/unit/time-normalize.test.js | L1:✅(35/35 branches≈95%) L2:✅(40/40) |
- [x] T014 [P] [US1] Unit tests for clubmates and national-teammates overlap verdicts with 100% branch coverage in server/tests/unit/relationship-analysis.test.js | L1:✅ Red(模块缺失→T016) L2:✅(38/40) |
- [x] T015 [P] [US1] Unit tests for career-sync failure/cache degradation with 100% branch coverage in server/tests/unit/career-sync.test.js | L1:✅(23/23 branches≈95%) L2:✅(40/40) |
- [x] 🚧 **批次5.4门禁: L1 Step4 (career-players/player-pair-analyses 契约可执行 + time-normalize/relationship/career-sync 单元用例就绪)** | 结果: ✅ contract可执行(Red19) unit:time-normalize+career-sync PASS · relationship Red→T016 |

---

## 批次 5.5 · Day 3 · US1 后台 — 直接关系分析 + API

- [x] T016 [US1] Implement RelationshipAnalysisService direct clubmates/nationalTeammates verdicts and details in server/src/services/relationship-analysis-service.js | L1:✅(8/8) L2:✅(40/40) |
- [x] T017 [US1] Implement career-players API (search/detail/sync) with requireAuth and mount routes in server/src/api/career-players.js and server/src/app.js | L1:✅(9/9) L2:✅(40/40) |
- [x] T018 [US1] Implement player-pair-analyses API (GET reentry + POST retry) for direct relations, freshness and computing status in server/src/api/player-pair-analyses.js and server/src/app.js | L1:✅(10/10) L2:✅(40/40) · fix:分析前按需 sync 履历段 |
- [x] 🚧 **批次5.5门禁: L1 Step4 (`[APP_START_COMMAND]` + career-players/player-pair-analyses 调用链 + 契约 PASS + 401)** | 结果: ✅ createAppOK contract:19/19(401+happy) |

---

## 批次 5.6 · Day 3–4 · US1 前台 — 搜索消歧 + 分析页文字结论（MVP）

- [x] T019 [P] [US1] Add web API clients for career-players and player-pair-analyses in web/src/api/career-players.ts and web/src/api/player-pair-analyses.ts | L1:✅ vue-tsc L2:✅(40/40) |
- [x] T020 [US1] Implement RelationshipSearchView and PlayerPicker (label-on-top dual search, explicit disambiguation) in web/src/views/RelationshipSearchView.vue and web/src/components/relationship/PlayerPicker.vue | L1:✅ vue-tsc L2:✅(38/40) |
- [x] T021 [US1] Implement RelationshipAnalysisView text conclusions + FreshnessBanner, register /relationships and /relationships/:playerIdA/:playerIdB routes and AppLayout nav entry in web/src/views/RelationshipAnalysisView.vue, web/src/components/relationship/FreshnessBanner.vue, web/src/router/index.ts and web/src/components/layout/AppLayout.vue | L1:✅ vue-tsc L2:✅(40/40) |
- [ ] 🚧 **批次5.6门禁: L1 Step4 + 👁 HV-1 (~5 min, 产品/用户)** | 结果: 自动化✅ vue-tsc；👁 HV-1 待签收 |

---

## 批次 5.7 · Day 4 · US2 — 转会关联与间接路径

- [ ] T022 [P] [US2] Extend unit tests for transfer link, successiveSameClub and BFS indirect path (maxHops/no_path) with 100% branch coverage in server/tests/unit/relationship-analysis.test.js | L1:- L2:- |
- [ ] T023 [US2] Extend RelationshipAnalysisService for TransferLink, successiveSameClub and bipartite BFS path in server/src/services/relationship-analysis-service.js | L1:- L2:- |
- [ ] T024 [US2] Persist and return transfer/indirectPath/relationDistance/pathStatus on pair analysis responses (cache key by sorted IDs) in server/src/services/relationship-analysis-service.js and server/src/api/player-pair-analyses.js | L1:- L2:- |
- [ ] T025 [US2] Display transfer conclusions and indirect path/distance on RelationshipAnalysisView in web/src/views/RelationshipAnalysisView.vue | L1:- L2:- |
- [ ] 🚧 **批次5.7门禁: L1 Step4 (`[APP_START_COMMAND]` + `[UI_START_COMMAND]` + 间接路径/no_path + URL 重入一致)** | 结果: - |

---

## 批次 5.8 · Day 5 · US3 — 时间线与关系图可视化

- [ ] T026 [P] [US3] Implement RelationshipTimeline SVG/CSS dual-track component in web/src/components/relationship/RelationshipTimeline.vue | L1:- L2:- |
- [ ] T027 [P] [US3] Implement RelationGraph SVG layered layout from relationPath nodes/edges in web/src/components/relationship/RelationGraph.vue | L1:- L2:- |
- [ ] T028 [US3] Integrate timeline, graph, loading/empty/error states into RelationshipAnalysisView in web/src/views/RelationshipAnalysisView.vue | L1:- L2:- |
- [ ] 🚧 **批次5.8门禁: L1 Step4 (`[UI_START_COMMAND]` + `[TYPECHECK_COMMAND]` + 时间线/关系图与结论一致)** | 结果: - |

---

## 批次 5.9 · Day 5 · Polish 收官

- [ ] T029 [P] Emit career_sync_success/failure and pair_analysis_latency_ms/cache_hit metrics in server/src/services/career-sync-service.js and server/src/api/player-pair-analyses.js | L1:- L2:- |
- [ ] T030 Run Scope 边界验证清单 and quickstart.md regression (no 003 players ALTER, no LLM QA endpoint, maxHops no_path, zero fabricated stints) per specs/005-player-relationship-analysis/plan.md and specs/005-player-relationship-analysis/quickstart.md | L1:- L2:- |
- [ ] 🚧 **批次5.9门禁: L1 Step4 + 👁 HV-2 (~15–20 min, 产品/用户)** | 结果: - |

---

## Sprint 5 收官

**状态**: 未开始
