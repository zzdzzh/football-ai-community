# Sprint 7 进度追踪 — 关系分析 LLM 叙事解读

**Feature**: 007-relationship-llm-narrative  
**Sprint 计划**: [sprint-7.md](./sprint-7.md)  
**开始**: 2026-07-20

---

## 批次 7.1 · Day 1 · Setup + Foundational — Prompt、配置与叙事表

- [x] T001 [P] Create external relationship narrative prompt (facts-only, no honor claims, unknown/not_established tone, JSON output with narrative+claims) in `server/prompts/relationship-narrative.md` | L1:✅ L2:✅(schema/prompt 对齐) |
- [x] T002 [P] Document `agentId=relationship` / narrative rate-limit / timeout notes in `server/.env.example` | L1:✅ L2:✅ |
- [x] T003 Create SQLite migration for `relationship_narratives` (unique `(analysis_id, analysis_computed_at)`, indexes) and optional `agent_profiles` seed `relationship` (timeout_ms=45000) in `server/src/db/migrations/016_relationship_narratives.sql` | L1:✅ L2:✅(字段对齐 data-model) |
- [x] T004 Implement relationship-narrative repository (find by pair+version, upsert ready, mark failed optional) in `server/src/db/repositories/relationship-narrative-repository.js` | L1:✅ L2:✅ |
- [x] 🚧 **批次7.1门禁: L1 Step4 (启动+数据迁移验证：`[APP_START_COMMAND]` + migration 016 + 仓储冒烟)** | 结果: ✅ health:UP migration:016 agent:relationship@45000 repo_smoke:OK |

---

## 批次 7.2 · Day 1 · US1 契约与单元测试（TDD）

- [x] T005 [P] [US1] Unit tests for claim verification (clubmate/transfer/path allow-list, unknown/not_established not upgraded, honor claims reject, contradictory narrative reject) with 100% branch coverage in `server/tests/unit/relationship-narrative-verifier.test.js` | L1:✅(Red/模块未实现) L2:✅ |
- [x] T006 [P] [US1] Unit tests for ready-gate, Mock AI success/timeout/upstream fail, verification failure path, and `assertAiRateLimit({ agentId: 'relationship' })` 429 with 100% branch coverage in `server/tests/unit/relationship-narrative-agent.test.js` | L1:✅(Red/模块未实现) L2:✅ |
- [x] T007 [P] [US1] Contract tests for `POST /player-pair-analyses/{playerIdA}/{playerIdB}/narrative` (401, 409 not ready, 200 structure with `aiGenerated`/`reused`, 422 verification_failed, 429, 408/503) in `server/tests/contract/relationship-narratives.test.js` | L1:✅(Red/404) L2:✅ |
- [x] 🚧 **批次7.2门禁: L1 Step4 (启动+接口端点验证：unit+contract 用例可执行，实现前可 Red)** | 结果: ✅ unit:Cannot find module; contract:401 pass/其余404 Red |

---

## 批次 7.3 · Day 1–2 · US1 后台 — AI Service + Verifier + Agent + POST（MVP）

- [x] T008 [P] [US1] Implement `AiRelationshipService` and register `createAiRelationshipService` in `server/src/ai/ai-relationship-service.js` and `server/src/ai/factory.js` | L1:✅(480/480) L2:✅ |
- [x] T009 [P] [US1] Implement `relationship-narrative-verifier` (build allowed facts from 005 `result`, validate claims + conservative name check) in `server/src/services/relationship-narrative-verifier.js` | L1:✅ L2:✅ |
- [x] T010 [US1] Implement `RelationshipNarrativeAgent` (load prompt, assemble minimal context from ready analysis, call AI, parse JSON, verify, persist) in `server/src/agents/relationship-narrative-agent.js` | L1:✅ L2:✅ |
- [x] T011 [US1] Implement `relationship-narrative-service` (authenticate caller context, ready check, rate-limit only on real generate, orchestrate agent) in `server/src/services/relationship-narrative-service.js` | L1:✅ L2:✅ |
- [x] T012 [US1] Implement POST narrative route and mount in `server/src/api/relationship-narratives.js` and `server/src/app.js` | L1:✅ L2:✅ |
- [x] 🚧 **批次7.3门禁: L1 Step4 (启动+接口端点验证：POST 调用链 + 契约/单元 PASS + `[REAL_SERVICE_CHECK]` ≥1 + `[MOCK_INDICATOR]` 清洁)** | 结果: ✅ health:UP unit+contract PASS；REAL: glm-4.7-flash 成功（~78s）；MOCK清洁 |

---

## 批次 7.4 · Day 2–3 · US2 — 关系页叙事面板与失败降级

- [x] T013 [P] [US2] Add web API client for narrative GET/POST (incl. `force`) in `web/src/api/relationship-narratives.ts` | L1:✅(vue-tsc) L2:✅ |
- [x] T014 [P] [US2] Create `RelationshipNarrativePanel` (disabled when analysis not ready; empty CTA; loading; success + AI badge; error/timeout/429 + retry) in `web/src/components/relationship/RelationshipNarrativePanel.vue` | L1:✅ L2:✅(成功/失败态互斥) |
- [x] T015 [US2] Integrate narrative panel into relationship page without replacing structured conclusion UI in `web/src/views/RelationshipAnalysisView.vue` | L1:✅ L2:✅ |
- [x] 🚧 **批次7.4门禁: L1 Step4 + 👁 HV-1 (~5 min, 产品/用户)** | 结果: ✅ 👁 HV-1 PASS；vue-tsc ✅；叙事+AI标识可见；T014 成功/失败态互斥已修 |

---

## 批次 7.5 · Day 3–4 · US3 — 版本复用、GET 与重入 UX

- [x] T016 [P] [US3] Unit tests for version-key reuse, `force=true` regenerate, stale when `computed_at` changes, cache-hit skips rate-limit in `server/tests/unit/relationship-narrative-service.test.js` | L1:✅ L2:✅ |
- [x] T017 [US3] Contract tests for `GET .../narrative` (200 match, 404 none/stale, 401, 409) and POST reuse (`reused=true`) in `server/tests/contract/relationship-narratives.test.js` | L1:✅ L2:✅ |
- [x] T018 [US3] Complete GET narrative + POST default-reuse / `force` overwrite against `(analysis_id, analysis_computed_at)` in `server/src/services/relationship-narrative-service.js` and `server/src/api/relationship-narratives.js` | L1:✅ L2:✅(stale=narrative_stale) |
- [x] T019 [US3] Auto-load existing narrative on page enter; show stale hint after analysis refresh; allow regenerate with `force` in `web/src/components/relationship/RelationshipNarrativePanel.vue` and `web/src/views/RelationshipAnalysisView.vue` | L1:✅(vue-tsc) L2:✅ |
- [x] 🚧 **批次7.5门禁: L1 Step4 (启动+接口端点验证：`[APP_START_COMMAND]`+`[UI_START_COMMAND]` + GET/reuse/force/stale + 单元/契约 PASS)** | 结果: ✅ health:UP；491 tests PASS；vue-tsc ✅；GET/reuse/force/stale 已覆盖 |

---

## 批次 7.6 · Day 4–5 · Polish 收官

- [ ] T020 [P] Run quickstart.md validation checklist and record results in `specs/007-relationship-llm-narrative/quickstart.md`（含至少 1 次真实模型调用走查） | L1:- L2:- |
- [ ] T021 [P] Confirm Scope 边界：007 无 diff 改写 005/006 `contracts/openapi.yaml` / `data-model.md`；无多轮 conversation 端点；005 既有 unit/contract 仍 PASS | L1:- L2:- |
- [ ] T022 Verify AI-path unit coverage (verifier + agent + service rate-limit/degrade branches) reaches 100% via `server` Jest coverage for the touched modules | L1:- L2:- |
- [ ] T023 Complete SC-001 sample spot-check (≥5 related pairs + ≥3 unrelated) and SC-003 failure-degrade manual pass; attach notes under `specs/007-relationship-llm-narrative/checklists/requirements.md` | L1:- L2:- |
- [ ] 🚧 **批次7.6门禁: L1 Step4 + 👁 HV-2 (~15–20 min, 产品/用户)** | 结果: - |
