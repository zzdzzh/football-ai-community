# Sprint 6: 球员实体对齐（统计域 ↔ 履历域）全量交付

**Feature**: [006-player-entity-alignment](../../specs/006-player-entity-alignment/spec.md)  
**Branch**: `006-player-entity-alignment`  
**Sprint 编号**: 6  
**时间**: 2026-07-20（周一）→ 2026-07-24（周五）  
**工作日**: 5 天  
**团队规模**: 1 人 + 自动化辅助  
**总预估工时**: ~19h（约 2.4 人日）  
**对应 Phase**: Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (US1) + Phase 4 (US2) + Phase 5 (US3) + Phase 6 (Polish)  
**Spec 颗粒度 pre-check**: ✅ 3 US / 20 tasks（原则 XII 阈值内；未 bypass）

## Sprint 目标

本 Sprint 结束时，**系统可按 Transfermarkt ID 精确唯一匹配建立高置信度双向可查映射（冲突不自动建链、缺 TM 不伪造）；登录用户在关系分析页 30 秒内看到关联态并跳转到带 `playerId` 的轻量统计入口 `/players/{statsPlayerId}`；未对齐无失效链接；可编程双向 resolve 返回对端 ID/依据/置信度或 404；两侧球员主键语义不变，且不改写 003/005 契约**。

## 在整体规划中的位置

| 维度 | 说明 |
|------|------|
| 前置 | [001 Auth](../../specs/001-football-feed-mvp/spec.md)；[003 Stats Player](../../specs/003-football-scout-tactical/spec.md) 与 [005 CareerPlayer](../../specs/005-player-relationship-analysis/spec.md) 已可运行；Sprint 5 关系分析已交付 |
| 本 Sprint | 006 映射层全量：US1 对齐建链 MVP + US2 关系页跳转 + US3 双向 resolve + Polish |
| 解锁 | 履历域球员可进入统计/Scout 能力；后续跨域推荐/内容可消费 identity links |
| 跨模块注意 | **禁止**在 006 内改写 003/005 的 `contracts/openapi.yaml` 或 `data-model.md`；若客户端需在 003 Player JSON 见 `transfermarktId`，须切换到 **003** 完成 T029–T032 |
| 外部服务 | 对齐消费库内已有 TM ID（migration 008）；本 Sprint 不新增 TM 直播采集调用；`[REAL_SERVICE_CHECK]` = 对真实库样例执行 align ≥1 次成功 |

## 命令约定

| 占位符 | 命令 |
|--------|------|
| `[APP_START_COMMAND]` | `cd server; npm run dev` |
| `[UI_START_COMMAND]` | `cd web; npm run dev` |
| `[TYPECHECK_COMMAND]` | `cd web; npx vue-tsc --noEmit` |
| `[BUILD_COMMAND]` | `cd server; npm test`（契约+单元） |
| `[REAL_SERVICE_CHECK]` | 对真实库中两侧均有相同 TM ID 的样例执行 align（用户或 internal）至少 1 次成功，产出 `confidence=high` active 映射（非 mock 编造） |
| `[E2E_TOOL]` | 人工测试（本项目前台不使用 Playwright） |
| `[MOCK_INDICATOR]` | 生产路径无 mock 残留；UI 无「演示数据」占位；无姓名模糊 high 映射 |
| `[EXTERNAL_SERVICE_NAME]` | Transfermarkt ID（库内字段精确匹配；不新增直播采集） |

---

## Day 1 · 批次 6.1：Setup + Foundational — 映射域表与 Repository

**主题**: Internal 鉴权文档、migration 015、link/conflict/align_runs 仓储  
**批次类型**: 服务/核心批次  
**预估工时**: 2.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T001 | Document player-identity-align internal route reuse of `INTERNAL_API_KEY` in `server/.env.example` | 0.5h | |
| T002 | Create SQLite migration 015 for `player_identity_links` / `conflicts` / `align_runs` | 0.5h | |
| T003 | [P] Implement player-identity-link repository | 1h | [P] |
| T004 | [P] Implement player-identity-conflict repository | 0.5h | [P] |

**依赖**: Sprint 5 / 003+005 球员域可运行  
**执行顺序**: T001 → T002 → T003 ‖ T004  
**跨模块注意**: migration **仅 CREATE**；禁止 ALTER/MERGE 003/005 球员表

**批次 6.1 门禁**: `[APP_START_COMMAND]` 启动成功 + 数据迁移 015 通过 + link/conflict/align_runs 仓储可被服务调用冒烟

---

## Day 1 · 批次 6.2：US1 契约与单元测试（TDD）

**主题**: 对齐规则单元测试 + align/internal 契约测试（先写后实现）  
**批次类型**: 服务/核心批次  
**预估工时**: 2h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T005 | [P] [US1] Unit tests for TM exact unique match / skip / conflict / no name-only high（100% 分支） | 1.5h | [P] |
| T006 | [P] [US1] Contract tests for `POST /player-identity-links/align` and internal align（401 + counters） | 0.5h | [P] |

**依赖**: 批次 6.1 完成  
**并行说明**: T005 ‖ T006（TDD：实现前可 FAIL）

**批次 6.2 门禁**: `cd server; npm run test:contract` / unit 用例可执行（实现前可 Red）+ 对齐分支场景清单齐全

---

## Day 1–2 · 批次 6.3：US1 后台 — AlignService + Job + API（MVP）

**主题**: 可核验身份映射：精确匹配建链、冲突留存、run 计数  
**批次类型**: 服务/核心批次  
**预估工时**: 4h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T007 | [US1] Implement `PlayerIdentityAlignService` | 2h | |
| T008 | [US1] Implement internal/batch align job | 1h | |
| T009 | [US1] Implement user align API and mount user + internal routes | 1h | |

**依赖**: 批次 6.2 测试驱动  
**执行顺序**: T007 → T008 → T009

**批次 6.3 门禁**: `[APP_START_COMMAND]` + 用户/内部 align 调用链成功 + `created`/`conflict`/`skipped` 计数正确 + 契约/对齐单元 PASS + 未登录 401 + 冲突不建 active high

---

## Day 2–3 · 批次 6.4：US2 — 批量链接态 + 关系页徽章 + 统计入口

**主题**: career→stats 批量状态、Badge、关系页集成、`/players/:playerId`  
**批次类型**: 集成批次（前后端联调 + 用户可见 UI + 真实库 align 样例）  
**预估工时**: 6.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T010 | [P] [US2] Contract tests for `GET /player-identity-links?careerPlayerIds=` | 0.5h | [P] |
| T011 | [US2] Implement batch career→stats link status + `GET /player-identity-links` | 1.5h | |
| T012 | [P] [US2] Add web API client for player-identity-links | 0.5h | [P] |
| T013 | [P] [US2] Create `PlayerIdentityLinkBadge` | 1h | [P] |
| T014 | [US2] Integrate identity badges into `RelationshipAnalysisView` | 1.5h | |
| T015 | [US2] Create lightweight stats entry page + `/players/:playerId` route | 1.5h | [P] |

**依赖**: 批次 6.3 完成（UI 需可查询的映射样例；可用 fixture links）  
**执行顺序**: T010 → T011；契约稳定后 T012 ‖ T013 ‖ T015；T014 依赖 T011 + T013

**批次 6.4 门禁**: L1 Step4 + 👁 **HV-1** (~5 min, 产品/用户)  
- `[APP_START_COMMAND]` + `[UI_START_COMMAND]` 同时 UP  
- `[TYPECHECK_COMMAND]` 通过  
- 登录用户打开已对齐双球员关系页，30 秒内看到「统计域已关联」并进入 `/players/{statsPlayerId}`  
- unlinked 无失效 `<a>`；pending_confirmation 显示「待确认」  
- `[REAL_SERVICE_CHECK]` 真实库样例 align ≥1 次成功（或已有 active high 映射可演示）  
- 截图存证 ≥2 张（关系页 linked 态 + `/players/{id}` 入口）  
- `[MOCK_INDICATOR]` 清洁

#### 👁 人工验证节点 HV-1

| 节点 ID | 所在批次 | 触发时机 | 验证动作 | 预期时间 | 验证人 |
|---------|---------|---------|---------|---------|--------|
| HV-1 | 批次 6.4 | US1+US2 首个用户可见闭环 | 浏览器打开关系分析页与 `/players/{id}` · 肉眼验收关联态/跳转/无失效链接 · 截图 ≥2 张 | ~5 min | 产品/用户 |

---

## Day 3–4 · 批次 6.5：US3 — 双向解析查询

**主题**: resolve 单元/契约 + 双向 API  
**批次类型**: 服务/核心批次  
**预估工时**: 2.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T016 | [P] [US3] Unit tests for bidirectional resolve and not-found（100% 分支） | 1h | [P] |
| T017 | [P] [US3] Contract tests for `GET /player-identity-links/resolve` | 0.5h | [P] |
| T018 | [US3] Complete bidirectional `resolve` service + API | 1h | |

**依赖**: 批次 6.1 完成 + 至少一条 active link（由 US1 产生）；与 US2 UI 无硬依赖，但建议 HV-1 PASS 后再开以免样例不足  
**执行顺序**: T016 ‖ T017 → T018（可复用 T011 resolve skeleton）

**批次 6.5 门禁**: `[APP_START_COMMAND]` + resolve 双向 200 结构正确 + 400 both/neither + 401 + 404 不编造 + 单元 100% 分支 + 契约 PASS

---

## Day 4–5 · 批次 6.6：Polish 收官

**主题**: 对齐可观测性指标、Scope 边界与 quickstart 回归  
**批次类型**: 集成批次（含真实库 align + 全 US UI 收官）  
**预估工时**: 1.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T019 | [P] Emit structured align metrics/logs（created/conflict/skipped） | 0.5h | [P] |
| T020 | Run Scope 边界验证清单 and quickstart.md regression | 1h | [P] |

**依赖**: 批次 6.4 / 6.5 完成（功能齐后再跑 T020）

**批次 6.6 门禁**: L1 Step4 + 👁 **HV-2** (~15–20 min, 产品/用户)  
- `cd server; npm test` 全部通过（align / resolve 100% 分支；player-identity-links 契约 PASS）  
- `[APP_START_COMMAND]` + `[UI_START_COMMAND]` 同时 UP  
- `[REAL_SERVICE_CHECK]` 真实库样例 align ≥1 次成功  
- 人工走查 US1/US2/US3 路径各 1 次 · 截图 ≥2 张（双球员 linked 跳转 + unlinked 无链接 / resolve 或对齐计数）  
- 路径：触发 align → 关系页关联态 → `/players/{id}` → resolve 双向/404 → 冲突/缺 TM 不建 high  
- quickstart.md 与 plan.md Scope（migration 仅 CREATE；003/005 contracts/data-model 未被 006 改写；无姓名模糊 high；冲突不建链；未登录 401）全通过  
- `[MOCK_INDICATOR]` 清洁

#### 👁 人工验证节点 HV-2

| 节点 ID | 所在批次 | 触发时机 | 验证动作 | 预期时间 | 验证人 |
|---------|---------|---------|---------|---------|--------|
| HV-2 | 批次 6.6 | Sprint 收官前 | 真实库 align + US1～US3 全路径肉眼验收 + Scope/quickstart 回归 | ~15–20 min | 产品/用户 |

---

## 任务依赖图

```text
Phase 1 Setup (T001)
    ↓
Phase 2 Foundational (T002 → T003 ‖ T004)
    ↓
Phase 3 US1 Tests (T005 ‖ T006)
    ↓
Phase 3 US1 Backend (T007 → T008 → T009)
    ↓
Phase 4 US2 (T010 → T011 → T012 ‖ T013 ‖ T015 → T014) ← HV-1
    ↓
Phase 5 US3 (T016 ‖ T017 → T018)
    ↓
Phase 6 Polish (T019 ‖ T020) ← HV-2
```

## 验证检查点

- [ ] `[APP_START_COMMAND]` — 后台无异常退出，新路由可挂载
- [ ] `[UI_START_COMMAND]` — 前台监听 0.0.0.0，关系页与 `/players/:playerId` 可访问
- [ ] `[TYPECHECK_COMMAND]` — 前台类型检查通过
- [ ] `cd server; npm run db:migrate` — 015_player_identity_links.sql 迁移成功（仅 CREATE）
- [ ] `cd server; npm run test:contract` — player-identity-links 契约全 PASS（401/404/align 计数/resolve）
- [ ] `cd server; npm test` — align / resolve 单元测试全 PASS（100% 分支）
- [ ] 👁 HV-1 PASS — 关系页关联态 + 统计入口跳转肉眼验收
- [ ] 👁 HV-2 PASS — US1～US3 全路径 + 真实库 align + Scope/quickstart 验收

## Sprint 完成标准

1. 两侧均有相同 TM ID 的样例可触发对齐，得到 `confidence=high` 的 active 映射；缺 TM / 冲突不建高置信度映射；响应含 `created`/`conflict`/`skipped`（FR-001～FR-006、FR-010；SC-001、SC-004）
2. 关系分析页展示关联态；已对齐可进入 `/players/{statsPlayerId}`；未对齐无失效链接；非高置信度标「待确认」（FR-007；SC-002）
3. `GET /player-identity-links/resolve` 支持 stats↔career 双向解析；无映射 404 不编造（FR-008；SC-003）
4. 未登录访问返回 401；不修改 003/005 球员主键语义与对端 contracts/data-model
5. quickstart.md 与 plan.md Scope 边界验证清单全通过
6. **所有批次门禁 + HV-1 + HV-2 全部 PASS**

## 风险项与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 真实库缺少两侧同 TM ID 样例 | HV-1/HV-2 / REAL_SERVICE_CHECK 阻塞 | 预先用已知 TM ID 的 stats+career fixture；quickstart 样例集 |
| 误改 003/005 contracts 或 ALTER 球员表 | 跨模块回归失败 | T020 Scope 清单显式审计；migration 仅 CREATE |
| 姓名模糊误建 high 映射 | 数据完整性破坏 | T005/T007 禁止 name-only high；冲突写 conflict 表 |
| 003 `transfermarktId` 未暴露到客户端 | 部分联调不便 | 对齐服务同库只读 `players.transfermarkt_id`；客户端暴露走 003 T029–T032 |
| 关系页徽章布局宽度不足 | UI 可用性差 | label/徽章紧凑；HV-1 截图验收宽度 |
| 统计入口 URL 未带 playerId | 无法重入/面包屑 | 路由强制 `/players/:playerId`；HV-1/HV-2 验收 |
| 需要重启后台 | Agent 误自启导致环境混乱 | Agent 不自行重启；提示用户重启 |

---

## Sprint 总览

| Sprint | 目标 | 任务数 | 总工时 | HV 节点数 | 关键交付物 |
|--------|------|--------|--------|----------|-----------|
| 6 | 球员实体对齐全量（US1+US2+US3） | 20 | ~19h | 2 | TM 精确对齐建链、关系页关联态跳转、`/players/:playerId`、双向 resolve、Scope 边界守住 |
