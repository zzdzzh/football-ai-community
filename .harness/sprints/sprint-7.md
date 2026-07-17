# Sprint 7: 关系分析 LLM 叙事解读全量交付

**Feature**: [007-relationship-llm-narrative](../../specs/007-relationship-llm-narrative/spec.md)  
**Branch**: `007-relationship-llm-narrative`  
**Sprint 编号**: 7  
**时间**: 2026-07-20（周一）→ 2026-07-24（周五）  
**工作日**: 5 天  
**团队规模**: 1 人 + 自动化辅助  
**总预估工时**: ~26.5h（约 3.3 人日）  
**对应 Phase**: Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (US1) + Phase 4 (US2) + Phase 5 (US3) + Phase 6 (Polish)  
**Spec 颗粒度 pre-check**: ✅ 3 US / 23 tasks（原则 XII 阈值内；未 bypass）

## Sprint 目标

本 Sprint 结束时，**登录用户可对分析就绪的球员对一键生成简体中文关系叙事（仅基于已入库履历与 005 结构化结论，经核验后持久化）；关系页展示叙事与 AI 标识，超时/限流/失败时结构化面板仍完整；同一结论版本可重入复用，`force` 或 `computed_at` 变更后可重新生成；不改写 005/006 契约与结论计算语义**。

## 在整体规划中的位置

| 维度 | 说明 |
|------|------|
| 前置 | [001 Auth](../../specs/001-football-feed-mvp/spec.md)；[005 关系分析](../../specs/005-player-relationship-analysis/spec.md) 可产出 `status=ready`；既有 AI 抽象 + `assertAiRateLimit`；Sprint 5/6 关系页已可访问 |
| 本 Sprint | 007 叙事全量：US1 生成/核验 MVP + US2 关系页展示降级 + US3 版本复用 + Polish |
| 解锁 | 兑现 005 FR-019；用户可见「可读关系介绍」差异化体验 |
| 跨模块注意 | **禁止**在 007 内改写 005/006 的 `contracts/openapi.yaml` 或 `data-model.md`；禁止 ALTER 005 `player_pair_analyses` 结论字段；无多轮 conversation 端点 |
| 外部服务 | OpenAI 兼容 LLM（`AiRelationshipService` / `agentId=relationship`）；`[REAL_SERVICE_CHECK]` = 对真实就绪样例 POST 叙事 ≥1 次成功（非 mock） |

## 命令约定

| 占位符 | 命令 |
|--------|------|
| `[APP_START_COMMAND]` | `cd server; npm run dev` |
| `[UI_START_COMMAND]` | `cd web; npm run dev` |
| `[TYPECHECK_COMMAND]` | `cd web; npx vue-tsc --noEmit` |
| `[BUILD_COMMAND]` | `cd server; npm test`（契约+单元） |
| `[REAL_SERVICE_CHECK]` | 对分析就绪的真实球员对 POST `/narrative` 至少 1 次成功，返回简体中文叙事且事实主张可与结构化结论核对（非 mock） |
| `[E2E_TOOL]` | 人工测试（本项目前台不使用 Playwright） |
| `[MOCK_INDICATOR]` | 生产路径无 mock 残留；UI 无「演示数据」占位；叙事区失败时不得静默空白 |
| `[EXTERNAL_SERVICE_NAME]` | OpenAI 兼容 LLM（关系叙事 `agentId=relationship`） |

---

## Day 1 · 批次 7.1：Setup + Foundational — Prompt、配置与叙事表

**主题**: 外置 Prompt、限流/超时注释、migration 016、narrative repository  
**批次类型**: 服务/核心批次  
**预估工时**: 2.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T001 | [P] Create external relationship narrative prompt in `server/prompts/relationship-narrative.md` | 0.5h | [P] |
| T002 | [P] Document `agentId=relationship` / rate-limit / timeout in `server/.env.example` | 0.5h | [P] |
| T003 | Create SQLite migration 016 for `relationship_narratives` (+ optional `agent_profiles` seed) | 0.5h | |
| T004 | Implement relationship-narrative repository | 1h | |

**依赖**: Sprint 5 关系分析可运行；既有 AI 抽象可用  
**执行顺序**: T001 ‖ T002 → T003 → T004  
**跨模块注意**: migration **仅 CREATE**；禁止 ALTER 005 `player_pair_analyses`

**批次 7.1 门禁**: `[APP_START_COMMAND]` 启动成功 + 数据迁移 016 通过 + 叙事仓储可被 Agent/Service 调用冒烟

---

## Day 1 · 批次 7.2：US1 契约与单元测试（TDD）

**主题**: 核验/Agent/限流单元测试 + POST 叙事契约（先写后实现）  
**批次类型**: 服务/核心批次  
**预估工时**: 4h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T005 | [P] [US1] Unit tests for claim verification（100% 分支） | 1.5h | [P] |
| T006 | [P] [US1] Unit tests for ready-gate / Mock AI / rate-limit 429（100% 分支） | 1.5h | [P] |
| T007 | [P] [US1] Contract tests for `POST .../narrative`（401/409/200/422/429/408/503） | 1h | [P] |

**依赖**: 批次 7.1 完成  
**并行说明**: T005 ‖ T006 ‖ T007（TDD：实现前可 FAIL）

**批次 7.2 门禁**: `cd server; npm run test:contract` / unit 用例可执行（实现前可 Red）+ 核验/限流/降级场景清单齐全

---

## Day 1–2 · 批次 7.3：US1 后台 — AI Service + Verifier + Agent + POST（MVP）

**主题**: 就绪门控、事实核验、限流、持久化与 POST 生成  
**批次类型**: 服务/核心批次（涉真实 LLM）  
**预估工时**: 7.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T008 | [P] [US1] Implement `AiRelationshipService` + factory 注册 | 1.5h | [P] |
| T009 | [P] [US1] Implement `relationship-narrative-verifier` | 1.5h | [P] |
| T010 | [US1] Implement `RelationshipNarrativeAgent` | 2h | |
| T011 | [US1] Implement `relationship-narrative-service` | 1.5h | |
| T012 | [US1] Implement POST narrative route and mount | 1h | |

**依赖**: 批次 7.2 测试驱动  
**执行顺序**: T008 ‖ T009 → T010 → T011 → T012

**批次 7.3 门禁**: `[APP_START_COMMAND]` + POST 调用链（401/409/200 Mock）+ 契约/核验/Agent 单元 PASS + `[REAL_SERVICE_CHECK]` 真实就绪样例 ≥1 次成功 + `[MOCK_INDICATOR]` 清洁

---

## Day 2–3 · 批次 7.4：US2 — 关系页叙事面板与失败降级

**主题**: Web client、`RelationshipNarrativePanel`、集成到关系分析页  
**批次类型**: 集成批次（前后端联调 + 用户可见 UI + 真实 LLM）  
**预估工时**: 4h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T013 | [P] [US2] Add web API client for narrative GET/POST（incl. `force`） | 0.5h | [P] |
| T014 | [P] [US2] Create `RelationshipNarrativePanel`（空态/加载/成功/失败/429） | 2h | [P] |
| T015 | [US2] Integrate narrative panel into `RelationshipAnalysisView`（不替换结构化结论） | 1.5h | |

**依赖**: 批次 7.3 完成（UI 需可用的 POST API）  
**执行顺序**: T013 ‖ T014 → T015

**批次 7.4 门禁**: L1 Step4 + 👁 **HV-1** (~5 min, 产品/用户)  
- `[APP_START_COMMAND]` + `[UI_START_COMMAND]` 同时 UP  
- `[TYPECHECK_COMMAND]` 通过  
- 登录用户打开已就绪关系页，60 秒内完成「触发生成 → 看到叙事正文」或「明确失败提示且结构化面板完整」  
- AI 标识「由 AI 基于本页结构化结论生成」可见  
- 失败/超时后时间线/关系图仍完整；未就绪时生成按钮禁用  
- `[REAL_SERVICE_CHECK]` 真实模型调用 ≥1 次成功（或已有可演示失败降级截图路径）  
- 截图存证 ≥2 张（成功叙事 + AI 标识；失败/超时降级）  
- `[MOCK_INDICATOR]` 清洁

#### 👁 人工验证节点 HV-1

| 节点 ID | 所在批次 | 触发时机 | 验证动作 | 预期时间 | 验证人 |
|---------|---------|---------|---------|---------|--------|
| HV-1 | 批次 7.4 | US1+US2 首个用户可见闭环 | 浏览器打开关系分析页 · 触发生成 · 肉眼验收叙事/AI 标识/降级 · 截图 ≥2 张 | ~5 min | 产品/用户 |

---

## Day 3–4 · 批次 7.5：US3 — 版本复用、GET 与重入 UX

**主题**: 复用单测/契约 + GET/`force`/stale + 页进入自动加载  
**批次类型**: 集成批次（服务 + UI）  
**预估工时**: 4.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T016 | [P] [US3] Unit tests for version-key reuse / force / stale / cache-hit 跳过限流 | 1h | [P] |
| T017 | [US3] Contract tests for GET narrative + POST reuse（`reused=true`） | 0.5h | |
| T018 | [US3] Complete GET + POST default-reuse / `force` overwrite | 1.5h | |
| T019 | [US3] Auto-load on enter；stale hint；`force` 重新生成（Panel + View） | 1.5h | |

**依赖**: 批次 7.3 持久化完成；建议 HV-1 PASS 后再开 UI 部分（T019）  
**执行顺序**: T016 → T017（与 T007 同文件须串行）→ T018 → T019

**批次 7.5 门禁**: `[APP_START_COMMAND]` + `[UI_START_COMMAND]` + GET 200/404/401/409 + POST `reused=true` 秒级返回 + 缓存命中不触发限流 + 分析刷新后 stale 提示 + 单元/契约 PASS

---

## Day 4–5 · 批次 7.6：Polish 收官

**主题**: quickstart 真实走查、Scope 边界、覆盖率 100%、SC-001/SC-003 样例抽检  
**批次类型**: 集成批次（含真实 LLM + 全 US UI 收官）  
**预估工时**: 4h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T020 | [P] Run quickstart.md validation（含 ≥1 次真实模型调用）并记录结果 | 1h | [P] |
| T021 | [P] Confirm Scope 边界：007 无 diff 改写 005/006 contracts/data-model；005 既有测试仍 PASS | 0.5h | [P] |
| T022 | Verify AI-path unit coverage（verifier + agent + service）达到 100% | 1h | |
| T023 | Complete SC-001 sample spot-check（≥5 related + ≥3 unrelated）+ SC-003 降级人工 PASS | 1.5h | |

**依赖**: 批次 7.4 / 7.5 完成（功能齐后再跑抽检与 quickstart）

**批次 7.6 门禁**: L1 Step4 + 👁 **HV-2** (~15–20 min, 产品/用户)  
- `cd server; npm test` 全部通过（verifier/agent/service 100% 分支；narrative 契约 PASS）  
- `[APP_START_COMMAND]` + `[UI_START_COMMAND]` 同时 UP  
- `[REAL_SERVICE_CHECK]` 真实模型调用 ≥1 次成功  
- 人工走查 US1/US2/US3 路径各 1 次 · 截图 ≥2 张（成功叙事；失败降级或重入复用）  
- 路径：就绪页生成 → AI 标识 → 二次进入复用 → force/刷新后新叙事 → 超时/限流降级  
- SC-001 样例抽检零矛盾；SC-003 失败降级 100% 结构化面板可读  
- quickstart.md 与 plan.md Scope（无 005/006 契约改写；无多轮 conversation；migration 仅 CREATE）全通过  
- `[MOCK_INDICATOR]` 清洁

#### 👁 人工验证节点 HV-2

| 节点 ID | 所在批次 | 触发时机 | 验证动作 | 预期时间 | 验证人 |
|---------|---------|---------|---------|---------|--------|
| HV-2 | 批次 7.6 | Sprint 收官前 | 真实 LLM + US1～US3 全路径肉眼验收 + SC-001/SC-003 + Scope/quickstart 回归 | ~15–20 min | 产品/用户 |

---

## 任务依赖图

```text
Phase 1 Setup (T001 ‖ T002)
    ↓
Phase 2 Foundational (T003 → T004)
    ↓
Phase 3 US1 Tests (T005 ‖ T006 ‖ T007)
    ↓
Phase 3 US1 Backend (T008 ‖ T009 → T010 → T011 → T012)
    ↓
Phase 4 US2 (T013 ‖ T014 → T015) ← HV-1
    ↓
Phase 5 US3 (T016 → T017 → T018 → T019)
    ↓
Phase 6 Polish (T020 ‖ T021 → T022 → T023) ← HV-2
```

## 验证检查点

- [ ] `[APP_START_COMMAND]` — 后台无异常退出，叙事路由可挂载
- [ ] `[UI_START_COMMAND]` — 前台监听 0.0.0.0，关系页叙事区可访问
- [ ] `[TYPECHECK_COMMAND]` — 前台类型检查通过
- [ ] `cd server; npm run db:migrate` — 016_relationship_narratives.sql 迁移成功（仅 CREATE）
- [ ] `cd server; npm run test:contract` — relationship-narratives 契约全 PASS
- [ ] `cd server; npm test` — verifier / agent / service 单元全 PASS（100% 分支）
- [ ] 👁 HV-1 PASS — 关系页生成叙事 + AI 标识 + 失败降级肉眼验收
- [ ] 👁 HV-2 PASS — US1～US3 全路径 + 真实 LLM + SC-001/SC-003 + Scope/quickstart 验收

## Sprint 完成标准

1. 登录用户对 `status=ready` 球员对可 POST 得简体中文叙事；事实主张可与结构化结论核对；未就绪 409；未登录 401；矛盾/超时不采信（FR-001～FR-004、FR-007～FR-009、FR-013；SC-001、SC-002）
2. 关系页提供叙事区与生成/加载/失败反馈；标明 AI 基于本页结论；失败时结构化面板完整（FR-005、FR-006、FR-011；SC-002、SC-003）
3. 同一 `(analysis_id, analysis_computed_at)` 可复用；GET/重入可用；`force` 或结论版本变更可重新生成（FR-007、FR-010；SC-004）
4. 不修改 005 履历/结论语义；007 无 diff 改写 005/006 contracts/data-model；无多轮 conversation
5. quickstart.md 与 plan.md Scope 边界验证清单全通过；AI-path 单元覆盖率 100%
6. **所有批次门禁 + HV-1 + HV-2 全部 PASS**

## 风险项与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 真实 LLM 不可用 / 配额耗尽 | HV-1/HV-2 / REAL_SERVICE_CHECK 阻塞 | Mock 路径先绿；真实调用用 1 对样例；失败路径用降级截图验收 |
| 模型捏造荣誉/路径 | SC-001 失败 | T005/T009 核验 allow-list；矛盾拒绝 422 |
| 误改 005/006 contracts 或 ALTER 结论表 | 跨模块回归失败 | T021 Scope 清单显式审计；migration 仅 CREATE |
| 限流过严导致演示失败 | HV 体验差 | 缓存命中跳过限流（US3）；演示前确认配额 |
| 关系页布局宽度不足 | UI 可用性差 | 叙事区 label-on-top；HV-1 截图验收宽度 |
| 需要重启后台 | Agent 误自启导致环境混乱 | Agent 不自行重启；提示用户重启 |
| US3 契约与 T007 同文件冲突 | 并行写坏契约文件 | T017 串行增补；禁止与 T007 并行改同一文件 |

---

## Sprint 总览

| Sprint | 目标 | 任务数 | 总工时 | HV 节点数 | 关键交付物 |
|--------|------|--------|--------|----------|-----------|
| 7 | 关系 LLM 叙事全量（US1+US2+US3） | 23 | ~26.5h | 2 | 叙事生成/核验/限流、关系页展示降级、版本复用、Scope 边界守住 |
