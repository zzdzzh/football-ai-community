# Sprint 2: Stats Agent 与 Content Agent 全量交付

**Feature**: [002-football-stats-content](../../specs/002-football-stats-content/spec.md)  
**Branch**: `002-football-stats-content`  
**Sprint 编号**: 2  
**时间**: 2026-07-17（周四）→ 2026-07-23（周三）  
**工作日**: 5 天  
**团队规模**: 1 人 + 自动化辅助  
**总预估工时**: ~34h（约 4.25 人日）  
**对应 Phase**: Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (US1) + Phase 4 (US2) + Phase 5 (Polish)  
**Spec 颗粒度 pre-check**: ✅ 2 US / 28 tasks（原则 XII 阈值内）

## Sprint 目标

本 Sprint 结束时，**注册用户可从 `/stats` 选择比赛或球队向 Stats Agent 提问，30 秒内获得含关键指标、自然语言解读与置信度标注的回复；比赛结束后 Content Agent 自动生成赛后报道并发布至 Feed，用户可在 `/matches/:matchId` 阅读战报，并从首页 Feed 卡片跳转至比赛专题页**。football-data.org 比赛数据同步、Multi-Agent 协作链路全部可用。

## 在整体规划中的位置

| 维度 | 说明 |
|------|------|
| 前置 | [001-football-feed-mvp](../../specs/001-football-feed-mvp/spec.md) Sprint 1 已完成（认证、Feed、News Agent、偏好） |
| 本 Sprint | MVP-2 全量：US1 Stats 对话 + US2 Content 赛后报道 |
| 解锁 | [003-football-scout-tactical](../../specs/003-football-scout-tactical/spec.md) Scout/Tactical Agent |
| 外部服务 | football-data.org v4 API、OpenAI 兼容 AI 推理服务 |

## 命令约定

| 占位符 | 命令 |
|--------|------|
| `[APP_START_COMMAND]` | `cd server; npm run dev` |
| `[UI_START_COMMAND]` | `cd web; npm run dev` |
| `[TYPECHECK_COMMAND]` | `cd web; npx vue-tsc --noEmit` |
| `[BUILD_COMMAND]` | `cd server; npm test`（契约+单元） |
| `[REAL_SERVICE_CHECK]` | match-sync trigger 成功 + Stats AI 解读至少 1 次 success + match-report-generate 至少 1 条 match_report/brief_report |
| `[E2E_TOOL]` | 人工测试（本项目前台不使用 Playwright） |
| `[MOCK_INDICATOR]` | 生产路径无 mock 残留；UI 无「演示数据」占位 |

---

## Day 1 · 批次 2.1：MVP-2 环境配置

**主题**: football-data 与 cron 环境变量扩展  
**批次类型**: 服务/核心批次  
**预估工时**: 1h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T001 | Add FOOTBALL_DATA_API_KEY, FOOTBALL_DATA_BASE_URL, MATCH_SYNC_CRON and MATCH_REPORT_CRON to server/.env.example | 0.5h | |
| T002 | Extend environment config loader for football-data and cron settings | 0.5h | [P] |

**依赖**: Sprint 1 完成（MVP-1 脚手架就绪）  
**并行说明**: T002 可与 T001 并行（不同文件）

**批次 2.1 门禁**: `[APP_START_COMMAND]` 启动成功 + 新环境变量加载无报错 + `.env.example` 文档完整

---

## Day 1–2 · 批次 2.2：Foundational — 数据层 + football-data 适配器

**主题**: 数据库迁移、Repository、FootballDataAdapter、match-sync Job、matches/teams API  
**批次类型**: 服务/核心批次  
**预估工时**: 8.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T003 | Create SQLite migration 003_stats_content.sql | 0.5h | |
| T004 | [P] Implement team and match repositories | 0.5h | [P] |
| T005 | [P] Implement conversation, message and match-sync-meta repositories | 0.5h | [P] |
| T006 | Extend feed-item-repository for match_report/brief_report | 0.5h | |
| T007 | Implement FootballDataAdapter with 8 req/min rate limiter | 1.5h | |
| T008 | [P] Implement match-service and team-service | 1.5h | [P] |
| T009 | [P] Implement AiAnalysisService and stats-interpret prompt | 1h | [P] |
| T010 | Implement match-sync job and mount matches/teams API routes | 2h | |

**依赖**: 批次 2.1 完成  
**执行顺序**: T003 → T004/T005/T006 并行 → T007 → T008/T009 并行 → T010  
**跨模块注意**: 若 001 OpenAPI FeedItem 枚举未含 `match_report`/`brief_report`，须先在 `specs/001-football-feed-mvp/tasks.md` 增补契约扩展任务后再继续 T006

**批次 2.2 门禁**: `[APP_START_COMMAND]` 启动成功 + 数据迁移 003 通过 + match-sync dev trigger 成功 + GET /matches 与 GET /teams 可调用

---

## Day 2 · 批次 2.3：US1 契约与单元测试

**主题**: matches/teams/conversations/match-sync 契约测试 + Adapter/Stats Agent 单元测试  
**批次类型**: 服务/核心批次  
**预估工时**: 2h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T011 | [P] [US1] Contract tests for GET /matches and GET /teams | 0.5h | [P] |
| T012 | [P] [US1] Contract tests for conversations API | 0.5h | [P] |
| T013 | [P] [US1] Contract test for POST /internal/jobs/match-sync | 0.5h | [P] |
| T014 | [P] [US1] Unit tests for FootballDataAdapter and stats-agent (100% branch) | 0.5h | [P] |

**依赖**: 批次 2.2 完成  
**并行说明**: T011–T014 全部可并行启动（TDD：测试应先 fail 再随实现 PASS）

**批次 2.3 门禁**: `cd server; npm run test:contract` matches/teams/conversations/match-sync 契约全 PASS + stats-agent/adapter 单元测试 100% 分支覆盖

---

## Day 3 · 批次 2.4：US1 后台 — Stats Agent 对话闭环

**主题**: stats-context-builder、stats-agent、conversation-service、conversations API  
**批次类型**: 服务/核心批次  
**预估工时**: 5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T015 | [US1] Implement stats-context-builder with no-fabrication guard | 1.5h | |
| T016 | [US1] Implement stats-agent orchestration with AiAnalysisService | 2h | |
| T017 | [US1] Implement conversation-service and conversations API | 1.5h | |

**依赖**: 批次 2.3 完成（T014 stats-agent 测试驱动）  
**执行顺序**: T015 → T016 → T017

**批次 2.4 门禁**: `[APP_START_COMMAND]` + POST /conversations + POST /conversations/:id/messages 调用链成功 + Stats 回复含 ≥3 项指标与置信度字段 + conversations 契约测试 PASS

---

## Day 4 · 批次 2.5：US1 前台 — Stats 对话 UI

**主题**: StatsStartView、ConversationView、API clients、路由注册  
**批次类型**: 集成批次（前后端联调 + 用户可见 UI + 真实外部服务）  
**预估工时**: 5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T018 | [P] [US1] Implement web API clients (matches, teams, conversations) | 0.5h | [P] |
| T019 | [P] [US1] Implement StatsStartView, ConversationView and conversation components | 4h | [P] |
| T020 | [US1] Register /stats and /conversations/:conversationId routes | 0.5h | |

**依赖**: 批次 2.4 完成  
**并行说明**: T018/T019 可并行于 T017 完成后；T020 依赖 T019

**批次 2.5 门禁**: L1 Step4 + 👁 **HV-1** (~5 min, 产品/用户)  
- `[APP_START_COMMAND]` + `[UI_START_COMMAND]` 同时 UP  
- 登录用户打开 `/stats` 选择已结束比赛，提问「这场比赛控球与射门表现如何」  
- 30 秒内收到 ≥3 项指标 + 自然语言解读 + 置信度标注  
- 截图存证 ≥2 张（Stats 入口页 + 对话含指标与置信度）  
- `[REAL_SERVICE_CHECK]` match-sync 至少 1 次 success + Stats AI 解读至少 1 次 success  
- `[MOCK_INDICATOR]` 清洁

#### 👁 人工验证节点 HV-1

| 节点 ID | 所在批次 | 触发时机 | 验证动作 | 预期时间 | 验证人 |
|---------|---------|---------|---------|---------|--------|
| HV-1 | 批次 2.5 | US1 MVP 可用 | 浏览器打开 `/stats` 与对话页 · 肉眼验收 Stats 核心 UI · 截图 ≥2 张 | ~5 min | 产品/用户 |

---

## Day 4–5 · 批次 2.6：US2 后台 — Content Agent 战报生成

**主题**: content-agent、match-report-generate job、matches/:matchId report API、Feed 扩展  
**批次类型**: 服务/核心批次  
**预估工时**: 6h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T021 | [P] [US2] Unit tests for content-agent and stats-context-builder report mode | 1h | [P] |
| T022 | [US2] Create match-report prompt and implement content-agent | 2h | |
| T023 | [US2] Implement match-report-generate job with event_key dedup | 1.5h | |
| T024 | [US2] Extend GET /matches/:matchId with report and feed-service | 1.5h | |

**依赖**: 批次 2.5 HV-1 PASS；T022 依赖 T015 stats-context-builder  
**并行说明**: T021 可与 T022 先行；T023 依赖 T022；T024 依赖 T023

**批次 2.6 门禁**: `[APP_START_COMMAND]` + match-report-generate dev trigger 成功 + GET /matches/:matchId 返回 report + Feed 含 match_report/brief_report 条目 + content-agent 单元测试 100% 分支覆盖

---

## Day 5 · 批次 2.7：US2 前台 — 比赛专题页 + Feed 战报卡片

**主题**: MatchDetailView、FeedCard 扩展、首页导航  
**批次类型**: 集成批次  
**预估工时**: 4.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T025 | [P] [US2] Implement MatchDetailView and match components | 3h | [P] |
| T026 | [US2] Extend FeedCard for match_report/brief_report and navigation | 1.5h | |

**依赖**: 批次 2.6 完成  
**并行说明**: T025 可与 T024 后端并行启动；T026 依赖 T025

**批次 2.7 门禁**: `[APP_START_COMMAND]` + `[UI_START_COMMAND]` + `[TYPECHECK_COMMAND]` 通过 + 首页 Feed → `/matches/:matchId` 导航成功 + 比赛专题页展示战报与时间线

---

## Day 5 · 批次 2.8：Polish 收官

**主题**: 偏好加权、quickstart 验证、Scope 边界审计  
**批次类型**: 集成批次  
**预估工时**: 2h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T027 | [P] Extend feed-preference-sort for notify_match_report weighting | 1h | [P] |
| T028 | Run quickstart.md validation and MVP-2 scope boundary audit | 1h | |

**依赖**: 批次 2.7 完成  
**并行说明**: T027 可与 T028 前半并行

**批次 2.8 门禁**: L1 Step4 + 👁 **HV-2** (~15–20 min, 产品/用户)  
- `cd server; npm test` 全部通过（含 Stats/Content/Adapter 100% 分支）  
- `[REAL_SERVICE_CHECK]` football-data.org sync + Stats AI + Content 战报各至少 1 次 success  
- 人工走查 US1 + US2 全路径各 1 次 · 截图 ≥2 张（比赛专题页战报 + Feed 战报卡片 + brief_report 缺失标注）  
- 路径：首页 Feed → 比赛页 → 「向 Stats 提问」  
- quickstart.md 步骤可复现  
- MVP-2 scope 边界：6 联赛白名单、零 Scout/Tactical/Fan

#### 👁 人工验证节点 HV-2

| 节点 ID | 所在批次 | 触发时机 | 验证动作 | 预期时间 | 验证人 |
|---------|---------|---------|---------|---------|--------|
| HV-2 | 批次 2.8 | Sprint 收官前 | football-data + AI 真实服务 + US1/US2 全路径肉眼验收 | ~15–20 min | 产品/用户 |

---

## 任务依赖图

```text
Phase 1 (T001–T002)
    ↓
Phase 2 Foundational (T003–T010)
    ↓
Phase 3 Tests (T011–T014)
    ↓
Phase 3 Backend (T015–T017)
    ↓
Phase 3 UI (T018–T020) ← HV-1
    ↓
Phase 4 Backend (T021–T024)
    ↓
Phase 4 UI (T025–T026)
    ↓
Phase 5 (T027–T028) ← HV-2
```

## 验证检查点

- [ ] `[APP_START_COMMAND]` — 后台无异常退出，Swagger UI 可访问
- [ ] `[UI_START_COMMAND]` — 前台监听 0.0.0.0，页面入口可访问
- [ ] `[TYPECHECK_COMMAND]` — 前台类型检查通过
- [ ] `cd server; npm run db:migrate` — 003_stats_content.sql 迁移成功
- [ ] `cd server; npm run test:contract` — matches/teams/conversations/match-sync 契约全 PASS
- [ ] `cd server; npm test` — Stats/Content/Adapter 单元测试全 PASS（AI 路径 100% 分支）
- [ ] match-sync dev trigger — 6 联赛数据同步成功（受 8 req/min 限制）
- [ ] match-report-generate dev trigger — 至少 1 条 match_report 或 brief_report
- [ ] 👁 HV-1 PASS — US1 Stats 对话肉眼验收
- [ ] 👁 HV-2 PASS — US1+US2 全路径 + 真实服务验收

## Sprint 完成标准

1. 注册用户从 `/stats` 选择比赛提问，90% 请求 30 秒内收到 ≥3 项指标 + 解读 + 置信度（SC-002）
2. Stats Agent 在数据不完整时说明缺失项，不编造比分或统计数值（FR-012）
3. 比赛 FINISHED 后 15 分钟内 match-report-generate 产出战报并发布至 Feed（SC-003）
4. 用户在 `/matches/:matchId` 可见战报含比分、时间线与走势评述；数据不足时显示 brief_report（FR-024/FR-025）
5. 首页 Feed 战报卡片可跳转至比赛专题页；偏好 notify_match_report 加权生效
6. quickstart.md 全流程可复现；MVP-2 scope 边界审计通过
7. **所有批次门禁 + HV-1 + HV-2 全部 PASS**

## 风险项与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| football-data.org API Key 缺失或限流 | 比赛数据无法同步 | `.env` 提前配置；adapter 硬编码 8 req/min；MatchSyncMeta 缓存降级 |
| 001 FeedItem 枚举未扩展 | T006 阻塞 | tasks.md 已标注跨模块依赖；优先检查 001 OpenAPI |
| Stats AI 30s 超时 | SC-002 不达标 | AgentProfile 超时配置；stats-context-builder 预裁剪上下文 |
| Content 数据不完整 | 无法生成完整战报 | brief_report 降级路径 + 缺失项标注（FR-025） |
| T019 对话 UI 复杂度 | Day 4 延期 | 先 MVP 消息列表 + 输入框，边缘态（同步中/未找到）可简化 |
| 跨模块 Feed 类型冲突 | Feed 卡片渲染异常 | T006 与 T026 对齐 body_json 结构；契约测试覆盖 |

---

## Sprint 总览

| Sprint | 目标 | 任务数 | 总工时 | HV 节点数 | 关键交付物 |
|--------|------|--------|--------|----------|-----------|
| 2 | Stats/Content MVP 全量（US1+US2） | 28 | ~34h | 2 | Stats 对话页、比赛专题页、Content 战报、football-data 同步、Feed 战报卡片 |
