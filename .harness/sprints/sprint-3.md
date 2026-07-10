# Sprint 3: Scout Agent 与 Tactical Agent 全量交付

**Feature**: [003-football-scout-tactical](../../specs/003-football-scout-tactical/spec.md)  
**Branch**: `003-football-scout-tactical`  
**Sprint 编号**: 3  
**时间**: 2026-07-24（周四）→ 2026-07-30（周三）  
**工作日**: 5 天  
**团队规模**: 1 人 + 自动化辅助  
**总预估工时**: ~34h（约 4.25 人日）  
**对应 Phase**: Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (US1) + Phase 4 (US2) + Phase 5 (Polish)  
**Spec 颗粒度 pre-check**: ✅ 2 US / 28 tasks（原则 XII 阈值内）

## Sprint 目标

本 Sprint 结束时，**注册用户可从 `/scout` 描述位置/年龄/联赛条件，30 秒内获得 ≥3 名球员推荐（含理由与关键数据）；可从比赛专题页或 `/tactical` 向 Tactical Agent 提交战术问题，收到含阵型与战术阶段的结构化分析；赛前比赛明确标注「【赛前战术预判】」，缺事件数据时不编造跑位/传球线路**。球员数据每日同步、Scout/Tactical 双 Agent 对话闭环全部可用。

## 在整体规划中的位置

| 维度 | 说明 |
|------|------|
| 前置 | [002-football-stats-content](../../specs/002-football-stats-content/spec.md) Sprint 2 已完成（比赛/球队数据、Stats 对话、Content 战报、Conversation 基础设施） |
| 本 Sprint | MVP-3 全量：US1 Scout 球员推荐 + US2 Tactical 战术分析 |
| 解锁 | [004-football-fan-community](../../specs/004-football-fan-community/spec.md) Fan Agent 社区讨论 |
| 外部服务 | football-data.org v4 API（squad/scorers）、OpenAI 兼容 AI 推理服务 |

## 命令约定

| 占位符 | 命令 |
|--------|------|
| `[APP_START_COMMAND]` | `cd server; npm run dev` |
| `[UI_START_COMMAND]` | `cd web; npm run dev` |
| `[TYPECHECK_COMMAND]` | `cd web; npx vue-tsc --noEmit` |
| `[BUILD_COMMAND]` | `cd server; npm test`（契约+单元） |
| `[REAL_SERVICE_CHECK]` | player-sync trigger 成功 + Scout AI 推荐至少 1 次 success + Tactical AI 分析至少 1 次 success |
| `[E2E_TOOL]` | 人工测试（本项目前台不使用 Playwright） |
| `[MOCK_INDICATOR]` | 生产路径无 mock 残留；UI 无「演示数据」占位 |

---

## Day 1 · 批次 3.1：MVP-3 环境配置

**主题**: player-sync cron 环境变量扩展  
**批次类型**: 服务/核心批次  
**预估工时**: 1h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T001 | Add PLAYER_SYNC_CRON to server/.env.example | 0.5h | |
| T002 | Extend environment config loader for player-sync cron settings | 0.5h | [P] |

**依赖**: Sprint 2 完成（MVP-2 脚手架就绪）  
**并行说明**: T002 可与 T001 并行（不同文件）

**批次 3.1 门禁**: `[APP_START_COMMAND]` 启动成功 + 新环境变量加载无报错 + `.env.example` 文档完整

---

## Day 1–2 · 批次 3.2：Foundational — 球员数据层 + 同步 Job

**主题**: 数据库迁移、Player Repository、FootballDataAdapter squad/scorers、player-sync Job、players API、Message 扩展  
**批次类型**: 服务/核心批次  
**预估工时**: 6.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T003 | Create SQLite migration 006_scout_tactical.sql | 0.5h | |
| T004 | [P] Implement player, player-stats-snapshot and player-sync-meta repositories | 0.5h | [P] |
| T005 | [P] Implement message-feedback repository | 0.5h | [P] |
| T006 | Extend FootballDataAdapter with squad and scorers endpoints | 1h | |
| T007 | Implement player-sync job with daily cron and internal trigger route | 2h | |
| T008 | Implement players list and detail API | 1h | |
| T009 | Extend message-repository for recommendations_json and tactical_json | 0.5h | |

**依赖**: 批次 3.1 完成  
**执行顺序**: T003 → T004/T005 并行 → T006 → T007（依赖 T004、T006）→ T008（依赖 T003–T004）→ T009  
**跨模块注意**: 若 002 Conversation `agentId` 枚举未含 `scout`/`tactical`，须先在 `specs/002-football-stats-content/tasks.md` 增补契约扩展任务后再继续 T016/T025

**批次 3.2 门禁**: `[APP_START_COMMAND]` 启动成功 + 数据迁移 006 通过 + player-sync dev trigger 成功 + GET /players 可调用

---

## Day 2 · 批次 3.3：US1 契约与单元测试

**主题**: players/player-sync/scout-conversations 契约测试 + Scout context-builder/agent 单元测试  
**批次类型**: 服务/核心批次  
**预估工时**: 2h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T010 | [P] [US1] Contract tests for GET /players and POST /internal/jobs/player-sync | 0.5h | [P] |
| T011 | [P] [US1] Contract tests for Scout conversations and message feedback | 0.5h | [P] |
| T012 | [P] [US1] Unit tests for scout-context-builder and scout-agent (100% branch) | 1h | [P] |

**依赖**: 批次 3.2 完成  
**并行说明**: T010–T012 全部可并行启动（TDD：测试应先 fail 再随实现 PASS）

**批次 3.3 门禁**: `cd server; npm run test:contract` players/player-sync/scout-conversations 契约全 PASS + scout-agent/context-builder 单元测试 100% 分支覆盖

---

## Day 3 · 批次 3.4：US1 后台 — Scout Agent 推荐闭环

**主题**: scout-context-builder、scout-agent、conversation-service scout 分支、conversations API + feedback  
**批次类型**: 服务/核心批次  
**预估工时**: 5.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T013 | [P] [US1] Create scout-recommend prompt and AiScoutService | 1h | [P] |
| T014 | [US1] Implement scout-context-builder with league filter and candidate cap | 1.5h | |
| T015 | [US1] Implement scout-agent orchestration with recommendations_json persistence | 2h | |
| T016 | [US1] Extend conversation-service and conversations API for agentId=scout and feedback | 1.5h | |

**依赖**: 批次 3.3 完成（T012 scout-agent 测试驱动）  
**执行顺序**: T013/T014 可并行 → T015 → T016

**批次 3.4 门禁**: `[APP_START_COMMAND]` + POST /conversations（agentId=scout）+ POST /conversations/:id/messages 调用链成功 + Scout 回复含 ≥3 名推荐球员与 keyStats + scout-conversations 契约测试 PASS

---

## Day 4 · 批次 3.5：US1 前台 — Scout 推荐 UI

**主题**: ScoutStartView、ScoutFilterForm、PlayerRecommendationCard、ConversationView scout 渲染、路由注册  
**批次类型**: 集成批次（前后端联调 + 用户可见 UI + 真实外部服务）  
**预估工时**: 5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T017 | [P] [US1] Extend web API clients for players and scout conversations | 0.5h | [P] |
| T018 | [P] [US1] Implement ScoutStartView and scout components | 3h | [P] |
| T019 | [US1] Extend ConversationView for scout recommendations and register /scout route | 1.5h | |

**依赖**: 批次 3.4 完成  
**并行说明**: T017/T018 可并行于 T016 完成后；T019 依赖 T018

**批次 3.5 门禁**: L1 Step4 + 👁 **HV-1** (~5 min, 产品/用户)  
- `[APP_START_COMMAND]` + `[UI_START_COMMAND]` 同时 UP  
- 登录用户打开 `/scout` 选择英超，输入「需要一名擅长压迫的中场，25 岁以下」  
- 30 秒内收到 ≥3 名球员推荐卡片，每名含推荐理由与 ≥3 项 keyStats  
- 截图存证 ≥2 张（Scout 入口页 + 对话推荐卡片）  
- `[REAL_SERVICE_CHECK]` player-sync 至少 1 次 success + Scout AI 推荐至少 1 次 success  
- `[MOCK_INDICATOR]` 清洁

#### 👁 人工验证节点 HV-1

| 节点 ID | 所在批次 | 触发时机 | 验证动作 | 预期时间 | 验证人 |
|---------|---------|---------|---------|---------|--------|
| HV-1 | 批次 3.5 | US1 MVP 可用 | 浏览器打开 `/scout` 与对话页 · 肉眼验收 Scout 核心 UI · 截图 ≥2 张 | ~5 min | 产品/用户 |

---

## Day 4 · 批次 3.6：US2 契约与单元测试

**主题**: tactical-conversations 契约测试 + Tactical context-builder/agent 单元测试  
**批次类型**: 服务/核心批次  
**预估工时**: 1.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T020 | [P] [US2] Contract tests for Tactical conversations | 0.5h | [P] |
| T021 | [P] [US2] Unit tests for tactical-context-builder and tactical-agent (100% branch) | 1h | [P] |

**依赖**: 批次 3.5 HV-1 PASS  
**并行说明**: T020–T021 全部可并行启动

**批次 3.6 门禁**: `cd server; npm run test:contract` tactical-conversations 契约 PASS + tactical-agent/context-builder 单元测试 100% 分支覆盖

---

## Day 4–5 · 批次 3.7：US2 后台 — Tactical Agent 分析闭环

**主题**: tactical-context-builder、tactical-agent、conversation-service tactical 分支  
**批次类型**: 服务/核心批次  
**预估工时**: 6h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T022 | [P] [US2] Create tactical-analysis prompt and AiTacticalService | 1h | [P] |
| T023 | [US2] Implement tactical-context-builder with analysisType derivation and data-limitation guard | 1.5h | |
| T024 | [US2] Implement tactical-agent orchestration with tactical_json persistence | 2h | |
| T025 | [US2] Extend conversation-service and conversations API for agentId=tactical | 1.5h | |

**依赖**: 批次 3.6 完成（T021 tactical-agent 测试驱动）  
**执行顺序**: T022/T023 可并行 → T024 → T025

**批次 3.7 门禁**: `[APP_START_COMMAND]` + POST /conversations（agentId=tactical）调用链成功 + Tactical 回复含阵型与战术阶段 + 缺事件数据时 confidence=low 且不编造跑位 + tactical-conversations 契约测试 PASS

---

## Day 5 · 批次 3.8：US2 前台 — 战术分析 UI + 比赛页入口

**主题**: TacticalStartView、TacticalPhasePanel、FormationBadge、MatchDetailView 战术入口、ConversationView tactical 渲染  
**批次类型**: 集成批次  
**预估工时**: 5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T026 | [P] [US2] Implement TacticalStartView, tactical components and MatchDetailView entry | 3.5h | [P] |
| T027 | [US2] Extend ConversationView for tactical analysis rendering and register /tactical route | 1.5h | |

**依赖**: 批次 3.7 完成  
**并行说明**: T026 可与 T025 后端并行启动；T027 依赖 T026

**批次 3.8 门禁**: `[APP_START_COMMAND]` + `[UI_START_COMMAND]` + `[TYPECHECK_COMMAND]` 通过 + 比赛页「战术分析」→ `/conversations/:id` 导航成功 + 战术阶段面板与阵型标签可见

---

## Day 5 · 批次 3.9：Polish 收官

**主题**: 002 Stats 对话回归、quickstart 验证、MVP-3 Scope 边界审计  
**批次类型**: 集成批次  
**预估工时**: 1h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T028 | Run 002 Stats conversations contract regression and MVP-3 scope boundary audit | 1h | |

**依赖**: 批次 3.8 完成

**批次 3.9 门禁**: L1 Step4 + 👁 **HV-2** (~15–20 min, 产品/用户)  
- `cd server; npm test` 全部通过（含 Scout/Tactical/player-sync 100% 分支）  
- `[REAL_SERVICE_CHECK]` player-sync + Scout AI + Tactical AI 各至少 1 次 success  
- 人工走查 US1 + US2 全路径各 1 次 · 截图 ≥2 张（战术阶段面板 + 赛前预判标注 + Scout 边缘态 top5/narrowHint）  
- 路径：比赛页 → 战术分析；`/scout` → 联赛过滤验证  
- quickstart.md §11 范围边界自检全通过  
- MVP-3 scope 边界：无 Fan Agent、002 Stats 回归正常

#### 👁 人工验证节点 HV-2

| 节点 ID | 所在批次 | 触发时机 | 验证动作 | 预期时间 | 验证人 |
|---------|---------|---------|---------|---------|--------|
| HV-2 | 批次 3.9 | Sprint 收官前 | football-data + AI 真实服务 + US1/US2 全路径肉眼验收 | ~15–20 min | 产品/用户 |

---

## 任务依赖图

```text
Phase 1 (T001–T002)
    ↓
Phase 2 Foundational (T003–T009)
    ↓
Phase 3 Tests (T010–T012)
    ↓
Phase 3 Backend (T013–T016)
    ↓
Phase 3 UI (T017–T019) ← HV-1
    ↓
Phase 4 Tests (T020–T021)
    ↓
Phase 4 Backend (T022–T025)
    ↓
Phase 4 UI (T026–T027)
    ↓
Phase 5 (T028) ← HV-2
```

## 验证检查点

- [ ] `[APP_START_COMMAND]` — 后台无异常退出，Swagger UI 可访问
- [ ] `[UI_START_COMMAND]` — 前台监听 0.0.0.0，页面入口可访问
- [ ] `[TYPECHECK_COMMAND]` — 前台类型检查通过
- [ ] `cd server; npm run db:migrate` — 006_scout_tactical.sql 迁移成功
- [ ] `cd server; npm run test:contract` — players/player-sync/scout/tactical conversations 契约全 PASS
- [ ] `cd server; npm test` — Scout/Tactical/context-builders 单元测试全 PASS（AI 路径 100% 分支）
- [ ] player-sync dev trigger — 6 联赛球员数据同步成功（受 8 req/min 限制）
- [ ] 👁 HV-1 PASS — US1 Scout 推荐肉眼验收
- [ ] 👁 HV-2 PASS — US1+US2 全路径 + 真实服务验收

## Sprint 完成标准

1. 注册用户从 `/scout` 描述条件提问，30 秒内收到 ≥3 名球员推荐，每名含理由与 ≥3 项 keyStats（FR-013–014）
2. Scout 联赛过滤生效，条件过宽时返回 top5 + narrowHint（FR-015）
3. 用户从比赛页或 `/tactical` 提交战术问题，收到含阵型与战术阶段的结构化分析（FR-016）
4. 未开赛比赛标注「【赛前战术预判】」，缺事件数据时不编造跑位/传球线路（FR-017–018）
5. message_feedback API 可用（SC-004 预埋，Sprint 内不要求仪表盘）
6. quickstart.md 全流程可复现；MVP-3 scope 边界审计通过；002 Stats 对话回归正常
7. **所有批次门禁 + HV-1 + HV-2 全部 PASS**

## 风险项与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| football-data.org API Key 缺失或限流 | 球员数据无法同步 | `.env` 提前配置；adapter 硬编码 8 req/min；PlayerSyncMeta 缓存降级 |
| 002 Conversation agentId 枚举未扩展 | T016/T025 阻塞 | tasks.md 已标注跨模块依赖；优先检查 002 OpenAPI |
| Scout AI 30s 超时 | FR-013 不达标 | AgentProfile 超时配置；scout-context-builder 预裁剪候选球员 |
| 球员同步首次耗时过长 | Day 1–2 门禁延迟 | player-sync 分批 cron；Foundational 门禁用 dev trigger 抽样验证 |
| Tactical 无事件级数据 | 分析质量不足 | tactical-context-builder data-limitation guard + confidence=low 降级（FR-018） |
| T018 Scout 推荐卡片 UI 复杂度 | Day 4 延期 | 先 MVP 卡片列表 + keyStats，边缘态（top5/narrowHint）可简化 |
| 跨模块 Conversation 扩展冲突 | Stats 对话回归失败 | T028 显式回归 002 契约测试；T016/T025 按 agentId 分支增量合并 |

---

## Sprint 总览

| Sprint | 目标 | 任务数 | 总工时 | HV 节点数 | 关键交付物 |
|--------|------|--------|--------|----------|-----------|
| 3 | Scout/Tactical MVP 全量（US1+US2） | 28 | ~34h | 2 | Scout 推荐页、Tactical 分析页、球员同步、players API、比赛页战术入口、message_feedback |
