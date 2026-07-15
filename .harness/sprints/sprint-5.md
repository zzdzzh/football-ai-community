# Sprint 5: 球员关系分析全量交付

**Feature**: [005-player-relationship-analysis](../../specs/005-player-relationship-analysis/spec.md)  
**Branch**: `005-player-relationship-analysis`  
**Sprint 编号**: 5  
**时间**: 2026-07-16（周四）→ 2026-07-22（周三）  
**工作日**: 5 天  
**团队规模**: 1 人 + 自动化辅助  
**总预估工时**: ~38.5h（约 4.8 人日）  
**对应 Phase**: Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (US1) + Phase 4 (US2) + Phase 5 (US3) + Phase 6 (Polish)  
**Spec 颗粒度 pre-check**: ✅ 3 US / 30 tasks（原则 XII 阈值内）

## Sprint 目标

本 Sprint 结束时，**登录用户可从 `/relationships` 双搜索并显式消歧选定两名球员，进入 `/relationships/{playerIdA}/{playerIdB}` 在 10 秒内看到俱乐部队友/国家队队友等直接关系结论与共同时段；可看到转会关联、先后加盟同一球队、最短间接路径与关系距离（或明确 no_path）；分析页展示与结论一致的 SVG/CSS 时间线与关系图；履历缺失或 Transfermarkt 同步失败时零虚构并支持重试**。

## 在整体规划中的位置

| 维度 | 说明 |
|------|------|
| 前置 | [001-football-feed-mvp](../../specs/001-football-feed-mvp/spec.md) Auth/JWT 已就绪；本 feature **不依赖、不修改** [003-football-scout-tactical](../../specs/003-football-scout-tactical/spec.md) 的 Player 契约 |
| 本 Sprint | 球员关系分析全量：US1 直接关系 MVP + US2 转会/间接路径 + US3 时间线/关系图 + Polish |
| 解锁 | 球迷关系探查闭环；后续可扩展 LLM 解读或与 Scout 球员身份映射（须在对端 tasks 增补） |
| 外部服务 | Transfermarkt 履历按需采集（CareerDataAdapter / scraper CLI）；不新增 LLM QA |

## 命令约定

| 占位符 | 命令 |
|--------|------|
| `[APP_START_COMMAND]` | `cd server; npm run dev` |
| `[UI_START_COMMAND]` | `cd web; npm run dev` |
| `[TYPECHECK_COMMAND]` | `cd web; npx vue-tsc --noEmit` |
| `[BUILD_COMMAND]` | `cd server; npm test`（契约+单元） |
| `[REAL_SERVICE_CHECK]` | Transfermarkt 履历同步至少 1 次 success（已知球员 search→profile→stints 落库，零虚构） |
| `[E2E_TOOL]` | 人工测试（本项目前台不使用 Playwright） |
| `[MOCK_INDICATOR]` | 生产路径无 mock 残留；UI 无「演示数据」占位 |
| `[EXTERNAL_SERVICE_NAME]` | Transfermarkt（履历按需采集） |

---

## Day 1 · 批次 5.1：关系分析环境配置

**主题**: 履历同步 TTL、路径最大跳数、同步超时环境变量  
**批次类型**: 服务/核心批次  
**预估工时**: 1h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T001 | Add CAREER_SYNC_TTL_DAYS, RELATIONSHIP_MAX_HOPS and CAREER_SYNC_TIMEOUT_MS to server/.env.example | 0.5h | |
| T002 | Extend environment config loader for career sync TTL, max hops and sync timeout | 0.5h | [P] |

**依赖**: Sprint 4 / MVP-1～4 脚手架就绪  
**并行说明**: T002 可与 T001 并行（不同文件）

**批次 5.1 门禁**: `[APP_START_COMMAND]` 启动成功 + 新环境变量加载无报错 + `.env.example` 文档完整

---

## Day 1–2 · 批次 5.2：Foundational — 履历域表 + Repository + 时间归一

**主题**: migration 014、career/club/stint/pair-analysis 仓储、time-normalize  
**批次类型**: 服务/核心批次  
**预估工时**: 4.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T003 | Create SQLite migration 014_player_relationship.sql | 0.5h | |
| T004 | [P] Implement career-player and career-club repositories | 1h | [P] |
| T005 | [P] Implement club-stint and national-team-stint repositories | 1h | [P] |
| T006 | [P] Implement player-pair-analysis repository | 0.5h | [P] |
| T007 | [P] Implement time-normalize helpers | 1.5h | [P] |

**依赖**: 批次 5.1 完成  
**执行顺序**: T003 → T004/T005/T006/T007 并行  
**跨模块注意**: **禁止**修改 001/003 的 `contracts/openapi.yaml` 或 `players` 表；若需统一球员身份，须在 `specs/003-football-scout-tactical/tasks.md` 增补后再改对端

**批次 5.2 门禁**: `[APP_START_COMMAND]` 启动成功 + 数据迁移 014 通过 + 仓储可被 service 调用冒烟 + time-normalize 关键分支可单元冒烟

---

## Day 2 · 批次 5.3：Foundational — Transfermarkt 采集 + 同步服务

**主题**: TM career CLI、CareerDataAdapter、CareerSyncService（TTL/事务替换/零虚构）  
**批次类型**: 服务/核心批次（涉真实外部服务适配）  
**预估工时**: 5.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T008 | [P] Implement Transfermarkt career search/profile CLI | 2h | [P] |
| T009 | Implement CareerDataAdapter and extend scraper-runner career CLI spawn | 1.5h | |
| T010 | Implement CareerSyncService with TTL, per-player replace transaction and zero-fabricated fallback | 2h | |

**依赖**: 批次 5.2 完成（T009 依赖 T008；T010 依赖 T009 + repos）  
**执行顺序**: T008 → T009 → T010

**批次 5.3 门禁**: `[APP_START_COMMAND]` 启动成功 + CareerSyncService 可对 fixture/mock 完成同步事务 + 失败路径零虚构 stints +（若本机凭证可用）Transfermarkt CLI search 冒烟至少 1 次

---

## Day 2–3 · 批次 5.4：US1 契约与单元测试

**主题**: career-players / player-pair-analyses 契约测试 + time-normalize / relationship / career-sync 单元测试（TDD）  
**批次类型**: 服务/核心批次  
**预估工时**: 2.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T011 | [P] [US1] Contract tests for career-players (incl. 401) | 0.5h | [P] |
| T012 | [P] [US1] Contract tests for player-pair-analyses (direct, self-pair 400, 401) | 0.5h | [P] |
| T013 | [P] [US1] Unit tests for time-normalize 100% branch coverage | 0.5h | [P] |
| T014 | [P] [US1] Unit tests for clubmates/national overlap verdicts 100% branch | 0.5h | [P] |
| T015 | [P] [US1] Unit tests for career-sync failure/cache degradation 100% branch | 0.5h | [P] |

**依赖**: 批次 5.3 完成  
**并行说明**: T011–T015 全部可并行（TDD：测试应先 fail 再随实现 PASS）

**批次 5.4 门禁**: `cd server; npm run test:contract` career-players / player-pair-analyses 契约可执行 + time-normalize / relationship / career-sync 单元测试用例已就绪（实现前可 FAIL）

---

## Day 3 · 批次 5.5：US1 后台 — 直接关系分析 + API

**主题**: RelationshipAnalysisService 直接关系、career-players API、player-pair-analyses API  
**批次类型**: 服务/核心批次  
**预估工时**: 4.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T016 | [US1] Implement RelationshipAnalysisService direct clubmates/nationalTeammates | 2h | |
| T017 | [US1] Implement career-players API (search/detail/sync) with requireAuth | 1h | |
| T018 | [US1] Implement player-pair-analyses API (GET reentry + POST retry) | 1.5h | |

**依赖**: 批次 5.4 测试驱动  
**执行顺序**: T016 → T017 / T018（API 可并行于 service 后）

**批次 5.5 门禁**: `[APP_START_COMMAND]` + GET/POST career-players 与 player-pair-analyses 调用链成功 + 直接关系 verdict + freshness/computing 状态正确 + 契约测试 PASS + 未登录 401

---

## Day 3–4 · 批次 5.6：US1 前台 — 搜索消歧 + 分析页文字结论（MVP）

**主题**: web API clients、RelationshipSearchView/PlayerPicker、RelationshipAnalysisView + FreshnessBanner + 路由/导航  
**批次类型**: 集成批次（前后端联调 + 用户可见 UI + 真实 Transfermarkt 同步）  
**预估工时**: 5.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T019 | [P] [US1] Add web API clients for career-players and player-pair-analyses | 0.5h | [P] |
| T020 | [US1] Implement RelationshipSearchView and PlayerPicker (label-on-top dual search) | 2.5h | |
| T021 | [US1] Implement RelationshipAnalysisView text conclusions + FreshnessBanner + routes + nav | 2.5h | |

**依赖**: 批次 5.5 完成  
**执行顺序**: T019 → T020 → T021

**批次 5.6 门禁**: L1 Step4 + 👁 **HV-1** (~5 min, 产品/用户)  
- `[APP_START_COMMAND]` + `[UI_START_COMMAND]` 同时 UP  
- `[TYPECHECK_COMMAND]` 通过  
- 登录用户打开 `/relationships`，双搜索 + 候选消歧；未选定前不可提交  
- 选定后进入 `/relationships/{playerIdA}/{playerIdB}`，10 秒内看到直接关系文字结论与共同时段  
- 失败/重试态可见；未登录跳转 `/login` 回跳带双 ID URL  
- 截图存证 ≥2 张（搜索消歧页 + 分析页俱乐部队友结论）  
- `[REAL_SERVICE_CHECK]` Transfermarkt 履历同步至少 1 次 success（或本地 fixture 履历已就绪且同步路径可达）  
- `[MOCK_INDICATOR]` 清洁

#### 👁 人工验证节点 HV-1

| 节点 ID | 所在批次 | 触发时机 | 验证动作 | 预期时间 | 验证人 |
|---------|---------|---------|---------|---------|--------|
| HV-1 | 批次 5.6 | US1 MVP 可用 | 浏览器打开 `/relationships` 与分析 URL · 肉眼验收搜索→消歧→直接关系 · 截图 ≥2 张 | ~5 min | 产品/用户 |

---

## Day 4 · 批次 5.7：US2 — 转会关联与间接路径

**主题**: transfer / successiveSameClub / BFS 路径单元测试扩展 + service/API 持久化 + 分析页展示  
**批次类型**: 集成批次  
**预估工时**: 5.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T022 | [P] [US2] Extend unit tests for transfer/successiveSameClub/BFS (maxHops/no_path) | 1h | [P] |
| T023 | [US2] Extend RelationshipAnalysisService for TransferLink, successiveSameClub and bipartite BFS | 2h | |
| T024 | [US2] Persist and return transfer/indirectPath/relationDistance/pathStatus | 1h | |
| T025 | [US2] Display transfer conclusions and indirect path/distance on RelationshipAnalysisView | 1.5h | |

**依赖**: 批次 5.6 HV-1 PASS  
**执行顺序**: T022 可与 T023 前并行起草 → T023 → T024 → T025

**批次 5.7 门禁**: `[APP_START_COMMAND]` + `[UI_START_COMMAND]` + 无共同交集但可连通的球员对展示间接路径与距离 + maxHops 内不连通显示 no_path + 刷新同一 URL 结论一致 + relationship-analysis 相关单元测试 100% 分支覆盖

---

## Day 5 · 批次 5.8：US3 — 时间线与关系图可视化

**主题**: RelationshipTimeline、RelationGraph、分析页 loading/empty/error 集成  
**批次类型**: 用户界面批次（含与 JSON 结论一致性）  
**预估工时**: 7.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T026 | [P] [US3] Implement RelationshipTimeline SVG/CSS dual-track | 3h | [P] |
| T027 | [P] [US3] Implement RelationGraph SVG layered layout | 3h | [P] |
| T028 | [US3] Integrate timeline, graph, loading/empty/error into RelationshipAnalysisView | 1.5h | |

**依赖**: 批次 5.7 完成（图最丰富时需 US2 path nodes）  
**并行说明**: T026 ‖ T027；T028 after both

**批次 5.8 门禁**: `[UI_START_COMMAND]` + `[TYPECHECK_COMMAND]` 通过 + 时间线共同区间高亮 + 关系图与 path/节点边一致 + 无关系空状态不造假节点 + computing/syncing 态明确

---

## Day 5 · 批次 5.9：Polish 收官

**主题**: 可观测性指标、Scope 边界清单与 quickstart 回归  
**批次类型**: 集成批次（含真实外部服务 + 全 US UI 收官）  
**预估工时**: 2h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T029 | [P] Emit career_sync_success/failure and pair_analysis_latency_ms/cache_hit metrics | 1h | [P] |
| T030 | Run Scope 边界验证清单 and quickstart.md regression | 1h | [P] |

**依赖**: 批次 5.8 完成

**批次 5.9 门禁**: L1 Step4 + 👁 **HV-2** (~15–20 min, 产品/用户)  
- `cd server; npm test` 全部通过（time-normalize / relationship-analysis / career-sync 100% 分支）  
- `[APP_START_COMMAND]` + `[UI_START_COMMAND]` 同时 UP  
- `[REAL_SERVICE_CHECK]` Transfermarkt 履历同步至少 1 次 success  
- 人工走查 US1/US2/US3 路径各 1 次 · 截图 ≥2 张（时间线共同区间 + 关系图路径 / no_path 文案）  
- 路径：`/relationships` → 消歧 → 分析页直接关系 → 转会/间接路径 → 时间线+图 → 失败重试  
- quickstart.md §4–5、§8 可复现；plan.md Scope 边界（无 003 players ALTER、无 LLM QA、maxHops no_path、零虚构 stints）全通过  
- `[MOCK_INDICATOR]` 清洁

#### 👁 人工验证节点 HV-2

| 节点 ID | 所在批次 | 触发时机 | 验证动作 | 预期时间 | 验证人 |
|---------|---------|---------|---------|---------|--------|
| HV-2 | 批次 5.9 | Sprint 收官前 | Transfermarkt 真实同步 + US1～US3 全路径肉眼验收 + Scope/quickstart 回归 | ~15–20 min | 产品/用户 |

---

## 任务依赖图

```text
Phase 1 (T001–T002)
    ↓
Phase 2 Foundational data (T003–T007)
    ↓
Phase 2 Scraper+Sync (T008–T010)
    ↓
Phase 3 Tests (T011–T015)
    ↓
Phase 3 Backend (T016–T018)
    ↓
Phase 3 UI (T019–T021) ← HV-1
    ↓
Phase 4 US2 (T022–T025)
    ↓
Phase 5 US3 (T026–T028)
    ↓
Phase 6 Polish (T029–T030) ← HV-2
```

## 验证检查点

- [ ] `[APP_START_COMMAND]` — 后台无异常退出，Swagger UI 可访问
- [ ] `[UI_START_COMMAND]` — 前台监听 0.0.0.0，页面入口可访问
- [ ] `[TYPECHECK_COMMAND]` — 前台类型检查通过
- [ ] `cd server; npm run db:migrate` — 014_player_relationship.sql 迁移成功
- [ ] `cd server; npm run test:contract` — career-players / player-pair-analyses 契约全 PASS
- [ ] `cd server; npm test` — time-normalize / relationship-analysis / career-sync 单元测试全 PASS（100% 分支）
- [ ] 双球员分析 URL 重入 — GET 同一 sorted pair 结论一致
- [ ] 👁 HV-1 PASS — US1 搜索→消歧→直接关系肉眼验收
- [ ] 👁 HV-2 PASS — US1～US3 全路径 + Transfermarkt 真实同步 + Scope/quickstart 验收

## Sprint 完成标准

1. 登录用户从 `/relationships` 显式消歧选定两名球员，进入双 ID 分析页看到直接关系文字结论与共同时段（FR-001～FR-011；SC-001/SC-002）
2. 分析页输出转会关联、先后加盟同一球队、最短间接路径与关系距离；不可达时明确 no_path；URL 重入一致（FR-012～FR-014；SC-003）
3. 时间线高亮共同效力区间，关系图与文字/path 结论零矛盾；加载/空/失败态明确（FR-015～FR-017；SC-004）
4. 履历同步失败零虚构 stints；FreshnessBanner + 重试可用
5. 未登录访问返回 401 / 引导登录；不修改 003 `players` 表与 LLM QA 端点
6. quickstart.md §4–5、§8 与 plan.md Scope 边界验证清单全通过
7. **所有批次门禁 + HV-1 + HV-2 全部 PASS**

## 风险项与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Transfermarkt 反爬/超时/结构变更 | 履历同步失败，US1 演示阻塞 | CAREER_SYNC_TIMEOUT_MS；失败降级 + 本地 fixture；T015 100% 分支覆盖失败路径 |
| 时间字段模糊（season/open_ended） | 队友判定误报/漏报 | T007/T013 exact/month/year/season/open_ended/unparseable 全覆盖；禁止虚构精确日 |
| BFS maxHops 图过大 | 间接路径延迟或无结果 | RELATIONSHIP_MAX_HOPS 可配；T022 覆盖 no_path；UI 明确无路径文案 |
| T026/T027 SVG 可视化工时超估 | Day 5 延期 | 先 MVP 静态双轨/分层布局；复杂交互可后续迭代 |
| 误改 003 players 契约/表 | 跨模块回归失败 | T030 Scope 清单显式审计；tasks 禁止 ALTER 003 |
| 分析页 URL 未带双球员 ID | 无法重入/面包屑 | 路由强制 `/relationships/:playerIdA/:playerIdB`；HV-1/HV-2 验收 |
| 前台布局宽度不足（双搜索+消歧） | UI 可用性差 | label-on-top；HV-1 截图验收宽度 |

---

## Sprint 总览

| Sprint | 目标 | 任务数 | 总工时 | HV 节点数 | 关键交付物 |
|--------|------|--------|--------|----------|-----------|
| 5 | 球员关系分析全量（US1+US2+US3） | 30 | ~38.5h | 2 | `/relationships` 搜索消歧、分析页直接/转会/间接关系、时间线、关系图、TM 按需同步 |
