# Sprint 1: 足球社区 Feed MVP 全量交付

**Feature**: [001-football-feed-mvp](../../specs/001-football-feed-mvp/spec.md)  
**Branch**: `001-football-feed-mvp`  
**Sprint 编号**: 1  
**时间**: 2026-07-10（周四）→ 2026-07-16（周三）  
**工作日**: 5 天  
**团队规模**: 1 人 + 自动化辅助  
**总预估工时**: ~32h（约 4 人日）  
**对应 Phase**: Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (US1) + Phase 4 (US2) + Phase 5 (Polish)  
**Spec 颗粒度 pre-check**: ✅ 2 US / 30 tasks（原则 XII 阈值内）

## Sprint 目标

本 Sprint 结束时，**足球爱好者可在浏览器打开社区首页，看到 News Agent 抓取并摘要的最新足球新闻；注册用户可登录并设置关注偏好，首页动态按偏好加权排序**。前后端脚手架、JWT 认证、Feed API、News Agent 定时抓取与 AI 摘要、偏好个性化全部可用。

## 在整体规划中的位置

| 维度 | 说明 |
|------|------|
| 前置 | 无（本 feature 为首个可执行 spec） |
| 本 Sprint | MVP-1 全量：US1 新闻 Feed + US2 偏好 |
| 解锁 | [002-football-stats-content](../../specs/002-football-stats-content/spec.md) Stats/Content Agent |
| 外部服务 | 足球新闻 RSS、OpenAI 兼容 AI 推理服务 |

## 命令约定

| 占位符 | 命令 |
|--------|------|
| `[APP_START_COMMAND]` | `cd server; npm run dev` |
| `[UI_START_COMMAND]` | `cd web; npm run dev` |
| `[TYPECHECK_COMMAND]` | `cd web; npx vue-tsc --noEmit` |
| `[BUILD_COMMAND]` | `cd server; npm test`（契约+单元） |
| `[REAL_SERVICE_CHECK]` | 触发 news-fetch → RSS 抓取成功 + AI 摘要至少 1 条 success |
| `[E2E_TOOL]` | 人工测试（本项目前台不使用 Playwright） |

---

## Day 1 · 批次 1.1：项目脚手架初始化

**主题**: 前后端目录结构与依赖就位  
**批次类型**: 用户界面批次（含 Vite 0.0.0.0 配置）  
**预估工时**: 2.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T001 | Create server/ and web/ directory structure | 0.5h | |
| T002 | Initialize server/package.json | 0.5h | [P] |
| T003 | Initialize web/package.json | 0.5h | [P] |
| T004 | Configure Vite dev server 0.0.0.0 | 0.5h | [P] |
| T005 | Update root .gitignore | 0.5h | [P] |

**依赖**: 无  
**并行说明**: T002–T005 可在 T001 完成后并行

**批次 1.1 门禁**: `[UI_START_COMMAND]` 启动成功 + `web/vite.config.ts` 监听 `0.0.0.0` + 依赖安装无报错

---

## Day 1–2 · 批次 1.2：后台基础能力

**主题**: 数据库、认证、AI 抽象层、Express 启动  
**批次类型**: 服务/核心批次  
**预估工时**: 8h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T006 | SQLite migration MVP-1 entities | 0.5h | |
| T007 | AgentProfile seed data (6 agents) | 0.5h | [P] |
| T008 | Database connection + PRAGMA foreign_keys | 0.5h | [P] |
| T009 | Environment config loader | 0.5h | [P] |
| T010 | request-id, logging, error middleware | 1h | [P] |
| T011 | JWT auth middleware + RBAC | 1.5h | |
| T012 | Auth service and routes | 1.5h | |
| T013 | AI content service + OpenAI adapter | 1h | [P] |
| T014 | Express app bootstrap + Swagger UI | 1h | |
| T015 | Jest contract harness + auth tests | 0.5h | [P] |

**依赖**: 批次 1.1 完成  
**并行说明**: T007–T010、T013、T015 可与 T006 后续步骤并行；T014 依赖 T011–T012

**批次 1.2 门禁**: `[APP_START_COMMAND]` 启动成功 + 数据迁移通过 + `cd server; npm run test:contract` auth 契约通过 + Swagger UI 可访问

---

## Day 2 · 批次 1.3：前台基础壳层

**主题**: Router、API Client、Layout、品牌样式  
**批次类型**: 用户界面批次  
**预估工时**: 2h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T016 | Web foundation (router, axios, layout, styles) | 2h | [P] |

**依赖**: 批次 1.1 完成（可与 1.2 后端任务并行，但门禁在 1.2 之后）

**批次 1.3 门禁**: `[UI_START_COMMAND]` 启动成功 + `[TYPECHECK_COMMAND]` 通过 + Layout 页面可访问

---

## Day 3 · 批次 2.1：US1 后台 — News Agent + Feed API

**主题**: RSS 抓取、AI 摘要、Feed 服务与接口  
**批次类型**: 服务/核心批次  
**预估工时**: 7.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T017 | Contract tests GET /feed, GET /feed/{feedId} | 0.5h | [P] |
| T018 | FeedItem + NewsCacheMeta repositories | 1h | [P] |
| T019 | News RSS adapter multi-source fetch | 1.5h | |
| T020 | news-summary prompt + news-agent | 1h | |
| T021 | feed-service dedup + unit tests | 2h | |
| T022 | Feed API routes (list, detail) | 1h | |
| T023 | news-fetch cron + dev trigger | 0.5h | |

**依赖**: 批次 1.2 完成  
**执行顺序**: T018 → T019 → T020 → T021 → T022 → T023；T017 可与 T018 并行

**批次 2.1 门禁**: `[APP_START_COMMAND]` + news-fetch dev trigger 成功 + `cd server; npm run test:contract` feed 契约通过 + GET /feed 返回 ≥1 条数据

---

## Day 4 · 批次 2.2：US1 前台 — Feed 浏览 UI

**主题**: 首页 Feed 列表、详情页、新闻源降级提示  
**批次类型**: 集成批次（前后端联调 + 用户可见 UI）  
**预估工时**: 4h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T024 | Feed UI (FeedList, FeedCard, SourceStatusBanner, HomeView, FeedDetailView) | 4h | [P] |

**依赖**: 批次 2.1 完成

**批次 2.2 门禁**: L1 Step4 + 👁 **HV-1** (~5 min, 产品/用户)  
- `[APP_START_COMMAND]` + `[UI_START_COMMAND]` 同时 UP  
- 浏览器打开 `/` 5 秒内见 ≥5 条新闻摘要  
- 点击条目进入 `/feed/:feedId` 见完整摘要、原文链接、关键信息点  
- 截图存证 ≥2 张（首页 Feed + 详情页）  
- `[REAL_SERVICE_CHECK]` RSS 抓取至少 1 次成功  
- `[MOCK_INDICATOR]` 清洁（生产路径无 mock 残留）

#### 👁 人工验证节点 HV-1

| 节点 ID | 所在批次 | 触发时机 | 验证动作 | 预期时间 | 验证人 |
|---------|---------|---------|---------|---------|--------|
| HV-1 | 批次 2.2 | US1 MVP 可用 | 浏览器打开首页/详情 · 肉眼验收核心 UI · 截图 ≥2 张 | ~5 min | 产品/用户 |

---

## Day 5 · 批次 3.1：US2 — 偏好与认证 UI

**主题**: 用户注册登录、偏好设置、Feed 个性化排序  
**批次类型**: 集成批次  
**预估工时**: 7h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T025 | Contract tests GET/PUT /users/me/preferences | 0.5h | [P] |
| T026 | UserPreference repository + preferences API | 1.5h | [P] |
| T027 | feed-service preference-weighted sorting + enabled_agents filter | 2h | |
| T028 | Auth views + Pinia auth store | 2h | [P] |
| T029 | PreferencesView label-top form rows | 1h | |

**依赖**: 批次 2.2 完成；T027 依赖 T021 feed-service  
**并行说明**: T025/T026/T028 可并行启动；T027 需 T026 完成后；T029 需 T028 完成后

**批次 3.1 门禁**: `[APP_START_COMMAND]` + `[UI_START_COMMAND]` + 登录→设置偏好→首页排序变化 接口调用链成功 + preferences 契约测试通过

---

## Day 5 · 批次 4.1：Polish 收官

**主题**: 认证单元测试、quickstart 验证、Scope 边界审计  
**批次类型**: 集成批次  
**预估工时**: 2h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T030 | Auth unit tests 100% branch + quickstart validation + scope audit | 2h | |

**依赖**: 批次 3.1 完成

**批次 4.1 门禁**: L1 Step4 + 👁 **HV-2** (~15–20 min, 产品/用户)  
- `cd server; npm test` 全部通过（含 auth 100% 分支）  
- `[REAL_SERVICE_CHECK]` RSS + AI 各至少 1 次 success  
- 人工走查 US1 + US2 全路径各 1 次 · 截图 ≥2 张  
- quickstart.md 步骤可复现  
- MVP-1 scope 边界：零 billing、AgentProfile 只读

#### 👁 人工验证节点 HV-2

| 节点 ID | 所在批次 | 触发时机 | 验证动作 | 预期时间 | 验证人 |
|---------|---------|---------|---------|---------|--------|
| HV-2 | 批次 4.1 | Sprint 收官前 | RSS+AI 真实服务 + 登录/偏好/Feed 全路径肉眼验收 | ~15–20 min | 产品/用户 |

---

## 任务依赖图

```text
Phase 1 (T001–T005)
    ↓
Phase 2 Backend (T006–T015) ──┬── Phase 2 Web (T016)
    ↓                         ↓
Phase 3 Backend (T017–T023)   (并行等待后端 Feed API)
    ↓
Phase 3 UI (T024) ← HV-1
    ↓
Phase 4 (T025–T029)
    ↓
Phase 5 (T030) ← HV-2
```

## 验证检查点

- [ ] `[APP_START_COMMAND]` — 后台无异常退出，Swagger UI 可访问
- [ ] `[UI_START_COMMAND]` — 前台监听 0.0.0.0，页面入口可访问
- [ ] `[TYPECHECK_COMMAND]` — 前台类型检查通过
- [ ] `cd server; npm run test:contract` — auth / feed / preferences 契约全 PASS
- [ ] `cd server; npm test` — 单元测试全 PASS（auth 100% 分支覆盖）
- [ ] news-fetch dev trigger — 至少产生 5 条 24h 内 Feed 条目
- [ ] 👁 HV-1 PASS — US1 首页+详情肉眼验收
- [ ] 👁 HV-2 PASS — US1+US2 全路径 + 真实服务验收

## Sprint 完成标准

1. 未登录用户打开 `/` 可在 5 秒内看到 ≥5 条 News Agent 摘要动态（SC-001）
2. 点击 Feed 条目进入详情页，可见完整摘要、原文链接、关键信息点
3. 注册用户可登录、设置偏好，首页动态按偏好加权排序（相关内容 ≥60%）
4. 关闭某 Agent 类型后刷新首页不再出现该类型动态
5. Agent 超时/失败场景展示明确降级态，无空白成功态（SC-006）
6. quickstart.md 全流程可复现；Scope 边界审计通过
7. **所有批次门禁 + HV-1 + HV-2 全部 PASS**

## 风险项与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 外部 RSS 源不可用 | US1 无法演示 | 配置多源 + NewsCacheMeta 缓存降级；dev 环境准备备用 RSS URL |
| OpenAI 兼容 API 凭证缺失 | 摘要生成失败 | 保留原文标题降级态；本地 `.env` 提前配置 |
| better-sqlite3 Windows 编译 | 后台无法启动 | 单独 `npm install better-sqlite3`；使用预编译 binary |
| T024 Feed UI 复杂度超预期 | Day 4 延期 | 先 MVP 列表+详情，SourceStatusBanner 可简化 |
| T027 偏好排序逻辑 | US2 验收不达标 | 单元测试覆盖权重算法；seed 数据含关注球队样本 |

---

## Sprint 总览

| Sprint | 目标 | 任务数 | 总工时 | HV 节点数 | 关键交付物 |
|--------|------|--------|--------|----------|-----------|
| 1 | Feed MVP 全量（US1+US2） | 30 | ~32h | 2 | 新闻 Feed 首页、详情页、登录注册、偏好设置、News Agent 抓取摘要 |
