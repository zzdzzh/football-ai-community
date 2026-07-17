# Sprint 6 进度追踪 — 球员实体对齐

**Feature**: 006-player-entity-alignment  
**Sprint 计划**: [sprint-6.md](./sprint-6.md)  
**开始**: 2026-07-20

---

## 批次 6.1 · Day 1 · Setup + Foundational — 映射域表与 Repository

- [x] T001 Document player-identity-align internal route reuse of `INTERNAL_API_KEY` in `server/.env.example` | L1:✅ L2:✅(9/10) |
- [x] T002 Create SQLite migration for `player_identity_links`, `player_identity_conflicts`, `player_identity_align_runs` and indexes in `server/src/db/migrations/015_player_identity_links.sql` | L1:✅ L2:✅(10/10) |
- [x] T003 [P] Implement player-identity-link repository in `server/src/db/repositories/player-identity-link-repository.js` | L1:✅ L2:✅(9/10) |
- [x] T004 [P] Implement player-identity-conflict repository in `server/src/db/repositories/player-identity-conflict-repository.js` | L1:✅ L2:✅(9/10) |
- [x] 🚧 **批次6.1门禁: L1 Step4 (启动+数据迁移验证：`[APP_START_COMMAND]` + migration 015 + 仓储冒烟)** | 结果: ✅ health:UP migration:015 smoke:OK tests:409/409 |

---

## 批次 6.2 · Day 1 · US1 契约与单元测试（TDD）

- [x] T005 [P] [US1] Unit tests for TM exact unique match, missing TM skip, stats-side conflict, career `sync_status=failed` skip, and no name-only high confidence with 100% branch coverage in `server/tests/unit/player-identity-align.test.js` | L1:✅(24/24) cov:100% L2:✅ |
- [x] T006 [P] [US1] Contract tests for `POST /player-identity-links/align` and `POST /internal/player-identity-align` (401, created/conflict/skipped counters) in `server/tests/contract/player-identity-links.test.js` | L1:✅(4/4) L2:✅ |
- [x] 🚧 **批次6.2门禁: L1 Step4 (启动+接口端点验证：align/unit+contract 用例可执行，实现前可 Red)** | 结果: ✅ unit+contract PASS |

---

## 批次 6.3 · Day 1–2 · US1 后台 — AlignService + Job + API（MVP）

- [x] T007 [US1] Implement `PlayerIdentityAlignService` in `server/src/services/player-identity-align-service.js` | L1:✅ L2:✅ |
- [x] T008 [US1] Implement internal/batch align job in `server/src/jobs/player-identity-align.js` | L1:✅ L2:✅ |
- [x] T009 [US1] Implement user align API and mount user + internal routes in `server/src/api/player-identity-links.js` and `server/src/app.js` | L1:✅ L2:✅ |
- [x] 🚧 **批次6.3门禁: L1 Step4 (启动+接口端点验证：align 用户/内部调用链 + 计数 + 契约/单元 PASS + 401)** | 结果: ✅ align API 200/401 + internal 200/401 + tests:28/28 |

---

## 批次 6.4 · Day 2–3 · US2 — 批量链接态 + 关系页徽章 + 统计入口

- [x] T010 [P] [US2] Contract tests for `GET /player-identity-links?careerPlayerIds=` in `server/tests/contract/player-identity-links.test.js` | L1:✅ L2:✅ |
- [x] T011 [US2] Implement batch career→stats link status in `server/src/services/player-identity-resolve-service.js` and `GET /player-identity-links` in `server/src/api/player-identity-links.js` | L1:✅ L2:✅ |
- [x] T012 [P] [US2] Add web API client for player-identity-links in `web/src/api/player-identity-links.ts` | L1:✅ L2:✅ |
- [x] T013 [P] [US2] Create `PlayerIdentityLinkBadge` in `web/src/components/relationship/PlayerIdentityLinkBadge.vue` | L1:✅ L2:✅ |
- [x] T014 [US2] Integrate identity badges into relationship conclusion area in `web/src/views/RelationshipAnalysisView.vue` | L1:✅ L2:✅ |
- [x] T015 [US2] Create lightweight stats entry page and register `/players/:playerId` route in `web/src/views/PlayerStatsEntryView.vue` and `web/src/router/index.ts` | L1:✅ typecheck:✅ L2:✅ |
- [x] 🚧 **批次6.4门禁: L1 Step4 + 👁 HV-1 PASS** | 结果: ✅ 用户肉眼验收通过（关系页关联态 + `/players/{id}` 跳转） |

---

## 批次 6.5 · Day 3–4 · US3 — 双向解析查询

- [x] T016 [P] [US3] Unit tests for bidirectional resolve and not-found with 100% branch coverage in `server/tests/unit/player-identity-resolve.test.js` | L1:✅(10/10) cov:100% L2:✅ |
- [x] T017 [P] [US3] Contract tests for `GET /player-identity-links/resolve` in `server/tests/contract/player-identity-links.test.js` | L1:✅ L2:✅ |
- [x] T018 [US3] Complete bidirectional `resolve` in `server/src/services/player-identity-resolve-service.js` and `GET /player-identity-links/resolve` in `server/src/api/player-identity-links.js` | L1:✅ L2:✅ |
- [x] 🚧 **批次6.5门禁: L1 Step4 (启动+接口端点验证：resolve 双向/400/401/404 + 单元 100% 分支 + 契约 PASS)** | 结果: ✅ resolve 双向/400/401/404 + cov:100% |

---

## 批次 6.6 · Day 4–5 · Polish 收官

- [x] T019 [P] Emit structured align metrics/logs in `server/src/services/player-identity-align-service.js` and `server/src/jobs/player-identity-align.js` | L1:✅ L2:✅ |
- [x] T020 Run Scope 边界验证清单 and quickstart.md regression per `specs/006-player-entity-alignment/plan.md` and `specs/006-player-entity-alignment/quickstart.md` | L1:✅ migration仅CREATE；003/005 contracts未改 | 
- [x] 🚧 **批次6.6门禁: L1 Step4 + 👁 HV-2 PASS** | 结果: ✅ 用户肉眼验收 US1～US3 全路径 + Scope/quickstart 通过 |
