# Implementation Plan: 球员实体对齐（统计域 ↔ 履历域）

**Branch**: `006-player-entity-alignment` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-player-entity-alignment/spec.md`

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

**Prerequisites**: [001 Auth](../001-football-feed-mvp/spec.md)；[003 Stats Player](../003-football-scout-tactical/spec.md) 与 [005 CareerPlayer](../005-player-relationship-analysis/spec.md) 已可运行；本 feature **不合并** 两域主键，仅新增映射层

## Summary

在 003 统计球员与 005 履历球员之间建立可追溯的身份映射：以 Transfermarkt 外部 ID 精确唯一匹配为 MVP 唯一自动规则，生成高置信度双向可查链接；冲突不自动建链并留存观测记录；提供按需/批处理对齐、双向解析 API，以及关系分析页的跨域跳转入口。架构沿用 Vue 3 + Element Plus（`web/`）与 Node.js Express + SQLite（`server/`）；映射表独立于 `players` / `career_players`。若需强化 003 侧 TM ID 可查性与契约暴露，按多模块规约在 [003 tasks.md](../003-football-scout-tactical/tasks.md) 增补任务，禁止在 006 内静默改对端 OpenAPI。本 spec 含 3 个 User Story，预估 tasks ≤ 28，符合 Constitution 原则 XII。

## Technical Context

**Language/Version**: Node.js 20 LTS（后台）；Vue 3.4+ / TypeScript 5.x（前台）

**Primary Dependencies**:
- 后台（沿用）：Express 4.x、better-sqlite3、jsonwebtoken、zod
- 后台（新建）：`PlayerIdentityAlignService`（TM ID 匹配/冲突检测）、`PlayerIdentityResolveService`（双向解析）、对齐批处理 Job
- 前台（沿用）：Vite 5.x、Element Plus、Vue Router、Pinia、axios
- 前台（增量）：关系分析页关联状态 + 跳转；轻量统计球员入口页 `/players/:playerId`
- AI：本 feature **不调用** LLM

**Storage**: SQLite（`server/data/community.db`）；迁移 `015_player_identity_links.sql` 新增 `player_identity_links`、`player_identity_conflicts`（及可选 `player_identity_align_runs` 汇总）；**不 ALTER** 003/005 球员主键语义；读取既有 `players.transfermarkt_id` 与 `career_players.(external_source, external_id)`

**Testing**: Jest（`server/` contract + unit）；对齐规则/冲突/解析 100% 分支覆盖；前台人工测试（非 Playwright）

**Target Platform**: Windows 开发 + Node.js 后台 + Vue 3 浏览器前台

**Project Type**: Web 应用（前后端分离）

**Performance Goals**:
- 双向解析（本地索引命中）：p95 < 200ms（对齐 SC-003）
- 存量对齐批处理（千级可匹配球员）：单次全量跑完 p95 < 60s（本机 SQLite）
- 关系页批量解析（2 名球员）：附加请求 p95 < 300ms
- 用户路径「看到关联 → 进入统计域入口」：人工 < 30s（SC-002）

**Constraints**:
- 前台 Vite dev server 监听 `0.0.0.0`
- 解析与跨域跳转需登录（与关系页一致，JWT Bearer + RBAC `user`）
- MVP 仅 TM ID 精确唯一匹配可产生 `confidence=high`；禁止姓名模糊自动高置信度
- 冲突不得静默覆盖；无 TM ID 不得伪造映射
- 禁止合并两域表或改变 003/005 主键策略
- 003 契约/模型变更 MUST 在 003 `tasks.md` 增补后由 003 落地
- 脚本使用 PowerShell；文件 UTF-8
- 多模块：直接引用 [003 data-model/contracts](../003-football-scout-tactical/)、[005 data-model/contracts](../005-player-relationship-analysis/)、[001 Auth](../001-football-feed-mvp/)

**Scale/Scope**:
- 映射覆盖「两侧均有相同 TM ID」的子集即可；不要求全库 100% 对齐
- 前台：关系分析页增量 + 1 个轻量 `/players/:playerId` 入口
- 3 个 User Story（P1/P2/P3）；预估 tasks ≤ 28（符合原则 XII ≤30）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 判定 | 理由（关联本 plan 的具体方案要素） |
|------|------|-----------------------------------|
| I. 前后端分离架构 | ✅ PASS | `web/` + `server/` + SQLite；统计入口 URL 带 `playerId` |
| II. 契约优先 | ✅ PASS | 本 feature `contracts/openapi.yaml` 先定义解析/对齐端点；003/005 只引用；对端变更走 003 tasks |
| III. 测试纪律 | ✅ PASS | 对齐/冲突/解析单元+契约测试；映射事务完整性 100% 分支；采集层 N/A |
| IV. AI/LLM 外部服务治理 | ➖ N/A | 本 feature 无 LLM/外部 AI 调用 |
| V. 可观测性优先 | ✅ PASS | 沿用 request-id；对齐 run 输出成功/冲突/跳过计数指标与日志 |
| VI. 简单优先 (YAGNI) | ✅ PASS | 无图库/无手工合并 UI/无模糊匹配引擎；单表映射 + 冲突表 |
| VII. 安全与权限 | ✅ PASS | 解析/对齐触发需鉴权；批处理内部路由沿用 Internal 模式；不暴露堆栈 |
| VIII. 用户界面可视化验证 | ✅ PASS | 关系页关联态/跳转/未关联提示人工截图与交互断言 |
| IX. 用户界面视觉质量标准 | ✅ PASS | 品牌色；空/加载/待确认态；跳转区不误导失效链接 |
| X. Corrector 修正回归纪律 | ✅ PASS | BUG 追溯 tasks.md 任务 ID |
| XI. 模块边界纪律 | ✅ PASS | External Dependencies 显式消费 003/005/001；006 不改对端契约正文 |
| XII. Spec 颗粒度纪律 | ✅ PASS | 3 个 US；预估 ≤28 task |

**Gate Result**: ALL PASS — 可进入 Phase 0 研究与 Phase 1 设计

**高风险路径标记（L4 审查）**: SQLite 映射事务与冲突拒绝逻辑（Constitution III 数据完整性）；鉴权覆盖解析 API（Constitution VII）— 须单元/契约全覆盖；UI 跨域跳转路径人工验收（Constitution VIII）

## Project Structure

### Documentation (this feature)

```text
specs/006-player-entity-alignment/
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
│   ├── api/
│   │   └── player-identity-links.js   # 解析查询、批量状态、按需对齐触发
│   ├── services/
│   │   ├── player-identity-align-service.js
│   │   └── player-identity-resolve-service.js
│   ├── jobs/
│   │   └── player-identity-align.js   # 批处理对齐（定时或 internal POST）
│   └── db/
│       ├── migrations/015_player_identity_links.sql
│       └── repositories/
│           ├── player-identity-link-repository.js
│           └── player-identity-conflict-repository.js
└── tests/
    ├── contract/                      # player-identity-links
    └── unit/                          # align / resolve / conflict rules

web/
├── src/
│   ├── views/
│   │   ├── RelationshipAnalysisView.vue  # 增量：关联状态 + 跳转
│   │   └── PlayerStatsEntryView.vue      # /players/:playerId 轻量统计域入口
│   ├── components/
│   │   └── relationship/
│   │       └── PlayerIdentityLinkBadge.vue
│   ├── api/
│   │   └── player-identity-links.ts
│   └── router/index.ts                # 注册 /players/:playerId
```

**Structure Decision**: 延续 `server/` + `web/` 布局。映射作为独立 006 域表与 API，避免把履历语义写回 003 `players` 或把阵容 ID 并入 005。对齐与解析放在可单测的 `services/`；前台仅在关系页消费解析结果并跳转到带核心 ID 的统计入口页，不引入新运行时依赖。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 独立 `player_identity_links` 表（非改 003/005 主键） | Spec FR-004 禁止合并两域表；映射需置信度/依据/状态 | 在任一侧加外键列会改变对端模型归属并违反多模块规约 |
| 独立 `player_identity_conflicts` 表 | FR-005/FR-010 要求冲突可观测且不静默覆盖 | 仅打日志无法结构化复核与契约验收 |
| 轻量 `/players/:playerId` 前台页 | US2 需要可重入的统计域入口 URL；现网无球员详情路由 | 仅链到 `/scout` 无核心球员 ID，违反 URL 带核心 ID 约束 |

## Scope 边界验证清单

| 边界承诺 | 验证方式 |
|----------|----------|
| 不修改 003/005 球员主键语义与表合并 | migration 015 仅 CREATE 新表；003/005 既有 contract 测试仍 PASS |
| 不在 006 内静默改 003 OpenAPI / data-model | 对端变更仅出现在 003 `tasks.md` 增补项；006 contracts 只引用对端路径 |
| MVP 无姓名模糊高置信度映射 | unit：仅姓名相同且无 TM ID → 不建 high 链接 |
| 冲突不自动建链 | unit：同 TM ID 多名统计球员 → 无 active link + conflicts 行 |
| 无 LLM / 无手工合并 UI | contract 无 merge-admin 端点；无 Ai*Service |
| 未登录不可解析 | contract：无 token → 401 |

## Post-Design Constitution Re-Check

Phase 1 设计完成后复验：PlayerIdentityLink / Conflict / AlignRun 与 contracts 边界清晰；消费 003/005/001 均为只读引用或经对端 tasks 增补；无 LLM；映射事务与冲突策略可测。**Gate Result**: ALL PASS
