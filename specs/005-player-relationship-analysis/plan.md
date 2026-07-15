# Implementation Plan: 足球球员关系分析

**Branch**: `005-player-relationship-analysis` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-player-relationship-analysis/spec.md`

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

**Prerequisites**: [001-football-feed-mvp](../001-football-feed-mvp/spec.md) 已完成（User / Auth / JWT）；本 feature **不依赖、不修改** [003-football-scout-tactical](../003-football-scout-tactical/spec.md) 的 Player 契约

## Summary

交付球员关系分析能力：按需从 Transfermarkt 公开履历获取并持久化 CareerPlayer 与效力段，为登录用户提供双球员搜索消歧、俱乐部队友/国家队队友判定、转会与间接最短路径、时间线与关系图可视化。架构沿用 Vue 3 + Element Plus（`web/`）与 Node.js Express + SQLite（`server/`）前后端分离；外部履历经独立 adapter + 既有 `scraper/` CLI 抽象访问，关系计算在服务端纯内存 BFS 完成，MVP 不引入 LLM。前台路由 `/relationships` → `/relationships/:playerIdA/:playerIdB`。本 spec 含 3 个 User Story，预估 tasks ≤ 30，符合 Constitution 原则 XII。

## Technical Context

**Language/Version**: Node.js 20 LTS（后台）；Vue 3.4+ / TypeScript 5.x（前台）；Python 3.11+（`scraper/` 履历解析 CLI，沿用现有爬虫运行时）

**Primary Dependencies**:
- 后台（沿用）：Express 4.x、better-sqlite3、jsonwebtoken、zod、swagger-ui-express
- 后台（新建）：`CareerDataAdapter`（Transfermarkt 履历）、`RelationshipAnalysisService`（队友/转会/路径）、`CareerSyncService`（按需同步与缓存）
- 前台（沿用）：Vite 5.x、Element Plus、Vue Router、Pinia、axios
- 前台（可视化）：原生 SVG/CSS 时间线 + 关系图组件（不新增图表 npm 包，见 Complexity Tracking）
- AI：本 MVP **不新增** `Ai*Service`（自然语言关系解读不在本期交付）

**Storage**: SQLite（`server/data/community.db`）；迁移 `014_player_relationship.sql` 新增 `career_players`、`career_clubs`、`club_stints`、`national_team_stints`、`player_pair_analyses` 表；**不 ALTER** 003 `players` 履历语义

**Testing**: Jest（`server/` contract + unit）；关系判定 / 时间归一 / BFS 路径 / 同步降级 100% 分支覆盖（Mock 外部采集）；前台人工测试（非 Playwright）

**Target Platform**: Windows 开发 + Node.js 后台 + Vue 3 浏览器前台

**Project Type**: Web 应用（前后端分离）

**Performance Goals**:
- 本地已有完整俱乐部履历的双球员分析（含直接关系）：p95 < 10s
- 需按需拉取两名球员履历时：同步 + 分析 p95 < 45s（单球员同步超时 20s）
- 球员搜索（本地索引命中）API p95 < 300ms；触发远端搜索后首屏候选 p95 < 15s
- 关系图/时间线仅为已返回 JSON 的前端渲染：首屏可视化交互可响应 < 2s

**Constraints**:
- 前台 Vite dev server 监听 `0.0.0.0`
- 登录后方可分析；JWT Bearer + RBAC（`user`）
- Transfermarkt 访问须限流与超时；失败不得虚构履历；缓存命中须展示数据新鲜度
- 最大间接跳数默认 **6**（可配置 `RELATIONSHIP_MAX_HOPS`）
- 不修改 003 Player / OpenAPI；禁止跨模块静默改对端契约
- 脚本使用 PowerShell；文件 UTF-8
- 多模块：Auth/User 直接引用 [001](../001-football-feed-mvp/data-model.md) 与 [001 contracts](../001-football-feed-mvp/contracts/openapi.yaml)

**Scale/Scope**:
- 按需缓存球员（非全库预爬）；单环境预期分析热集百级球员
- 2 个前台页面：搜索入口 `/relationships` + 分析页 `/relationships/:playerIdA/:playerIdB`
- 3 个 User Story（P1/P2/P3）；预估 tasks ≤ 28（符合原则 XII ≤30）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 判定 | 理由（关联本 plan 的具体方案要素） |
|------|------|-----------------------------------|
| I. 前后端分离架构 | ✅ PASS | `web/` + `server/` + SQLite；路由带双球员 ID |
| II. 契约优先 | ✅ PASS | `contracts/openapi.yaml` 定义 CareerPlayers / PlayerPairAnalyses 增量端点；001 Auth 只引用 |
| III. 测试纪律 | ✅ PASS | 关系引擎与同步降级单元+契约测试；采集层 Mock；高风险路径 100% 分支 |
| IV. AI/LLM 外部服务治理 | ✅ PASS / ➖ N/A（调用） | MVP 不调用 LLM；外部履历走 adapter，非业务直连 SDK；后续 AI 预留边界在 research |
| V. 可观测性优先 | ✅ PASS | 沿用 request-id；指标 career_sync_* / pair_analysis_* |
| VI. 简单优先 (YAGNI) | ✅ PASS | 无图数据库/图 npm；BFS + SVG；无全库爬虫调度 UI |
| VII. 安全与权限 | ✅ PASS | 分析 API `requireAuth`；采集内部控制面不向普通用户暴露 |
| VIII. 用户界面可视化验证 | ✅ PASS | 搜索→消歧→分析→时间线/关系图人工截图与交互断言 |
| IX. 用户界面视觉质量标准 | ✅ PASS | 品牌色、空/加载/失败态；label 上置搜索表单 |
| X. Corrector 修正回归纪律 | ✅ PASS | BUG 追溯 tasks.md 任务 ID |
| XI. 模块边界纪律 | ✅ PASS | External Dependencies：消费 001 Auth；不消费/不修改 003 Player |
| XII. Spec 颗粒度纪律 | ✅ PASS | 3 个 US；预估 ≤28 task |

**Gate Result**: ALL PASS — 可进入 Phase 0 研究与 Phase 1 设计

**高风险路径标记（L4 审查）**: Transfermarkt 按需采集与缓存一致性（外部第三方 + SQLite 事务）、关系判定/路径算法正确性（Constitution III 数据完整性）— 须 Mock 全覆盖 + 至少 1 次真实外部采集端到端走查；登录鉴权沿用 001，本 feature 契约测试须覆盖 401

## Project Structure

### Documentation (this feature)

```text
specs/005-player-relationship-analysis/
├── plan.md              # 本文件
├── research.md          # Phase 0 技术决策
├── data-model.md        # Phase 1 数据模型
├── quickstart.md        # Phase 1 本地启动指南
├── contracts/           # Phase 1 OpenAPI 契约
│   └── openapi.yaml
└── tasks.md             # Phase 2（/speckit-tasks 生成，非本命令产出）
```

### Source Code (repository root)

```text
server/
├── src/
│   ├── adapters/
│   │   ├── career-data-adapter.js        # Transfermarkt 履历抽象（搜索+详情）
│   │   └── scraper-runner.js             # 沿用；扩展 career CLI 调用
│   ├── api/
│   │   ├── career-players.js             # GET 搜索 / GET 详情 / POST sync
│   │   └── player-pair-analyses.js       # GET/POST 双球员分析（可重入）
│   ├── services/
│   │   ├── career-sync-service.js        # 按需同步、TTL、失败降级
│   │   ├── time-normalize.js             # 履历时间归一与精度标记
│   │   └── relationship-analysis-service.js  # 直接关系 / 转会 / BFS 路径
│   └── db/
│       ├── migrations/014_player_relationship.sql
│       └── repositories/                 # career-player, club-stint, pair-analysis
└── tests/
    ├── contract/                         # career-players, player-pair-analyses
    └── unit/                             # time-normalize, relationship-analysis, career-sync

scraper/
└── scraper/
    └── transfermarkt_career.py           # 球员搜索 + 俱乐部/国家队履历页解析 CLI

web/
├── src/
│   ├── views/
│   │   ├── RelationshipSearchView.vue    # /relationships
│   │   └── RelationshipAnalysisView.vue  # /relationships/:playerIdA/:playerIdB
│   ├── components/
│   │   └── relationship/                 # PlayerPicker, Timeline, RelationGraph, FreshnessBanner
│   └── api/                              # career-players.ts, player-pair-analyses.ts
```

**Structure Decision**: 延续既有 `server/` + `web/` + `scraper/` 布局。履历域与 003 `players`（football-data/阵容源）分表分 API，避免污染 Scout 契约；关系计算放在 `services/` 纯函数/可测模块，不引入 Neo4j 等运行时；可视化用本地 Vue 组件消费分析 JSON，与 Fan/Scout 入口→详情路由模式一致。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 独立 `career_*` 表与 API（非复用 003 `players`） | Spec External Dependencies 禁止本 MVP 修改/消费 003 Player；TM 履历字段（效力段、转会费）与阵容 Player 语义不同 | 扩展 `players` 表会静默改对端模型，违反多模块规约 |
| Python `scraper/` 扩展 career CLI | 现有 kader 爬取无职业履历页；HTML 解析放 Python 与现网 scraper 一致，Node 只做编排/入库 | 仅用 Node cheerio 重写等于第二套爬虫；现有 `scraper-runner` 已可复用 |
| `player_pair_analyses` 结果缓存表 | 重复提交须一致结论且减外压；URL 重入需稳定快照 | 每次纯实时重算在外源限流下易超 10s 且结论抖动 |
| 可视化用 SVG 组件而非现成图表库 | US3 需时间线+关系图；新 npm 图库增加 YAGNI 与包体积 | Element Plus 无图组件；若后期交互复杂度超出 SVG，再单独立项引入库 |

## Scope 边界验证清单

| 边界承诺 | 验证方式 |
|----------|----------|
| 不修改 003 `players` 表结构与 `/api/players` 契约语义 | migration 014 仅 CREATE 新表；003 contract/player 测试仍 PASS |
| 不修改 001 User/Auth 契约语义 | 仅复用 `requireAuth`；001 openapi 不变 |
| 本 MVP 无 LLM 关系解读端点 | contract test 断言无 `/relationship-qa`、无 AiRelationshipService |
| 无全库预爬管理 UI | 无 admin career-crawl 路由（若仅有 sync 单球员） |
| 间接路径跳数 ≤ 配置上限 | unit：超过 6 跳返回 no_path |
| 外源失败零虚构 | unit：adapter 失败 + 无缓存 → 503/友好错误，无入库假 stint |

## Post-Design Constitution Re-Check

Phase 1 设计完成后复验：CareerPlayer/ClubStint/NationalTeamStint/PlayerPairAnalysis 与 contracts 模块边界清晰；Auth 消费 001；无 003 写依赖；无 LLM 业务调用；采集经 adapter。**Gate Result**: ALL PASS
