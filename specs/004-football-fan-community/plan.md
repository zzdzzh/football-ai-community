# Implementation Plan: Fan Agent 与社区治理

**Branch**: `004-football-fan-community` | **Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-football-fan-community/spec.md`

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

**Prerequisites**: [003-football-scout-tactical](../003-football-scout-tactical/spec.md) 或至少 [002-football-stats-content](../002-football-stats-content/spec.md) 已完成（Feed、Match/Team、Auth 基础设施可供 Fan Agent 引用）

## Summary

在 MVP-1/2/3 脚手架之上交付 MVP-4：实现 Fan Agent 多 Persona 模拟球迷讨论（独立 `fan_discussions` 模型，非 Conversation 复用）；用户可在讨论中插话并触发下一轮 AI 交锋；双层内容安全（生成前过滤 + 用户举报）；管理员/版主可隐藏被举报内容。讨论完成后发布 `fan_discussion` 类型 FeedItem，前台路由 `/discussions/:discussionId` 支持重入。新增 `AiFanService`、`ContentModerationService` 与外置 Prompt；Fan Persona 种子数据覆盖 6 联赛主要球队。本 spec 含 1 个 User Story（P3），预估 tasks ≤ 26，符合 Constitution 原则 XII。

## Technical Context

**Language/Version**: Node.js 20 LTS（后台）；Vue 3.4+ / TypeScript 5.x（前台）

**Primary Dependencies**:
- 后台（沿用）：Express 4.x、better-sqlite3、jsonwebtoken、zod、swagger-ui-express
- 后台（扩展）：`AiFanService`（新建）；`ContentModerationService`（规则 + Prompt 约束，无新 npm 包）
- 前台（沿用）：Vite 5.x、Element Plus、Vue Router、Pinia、axios
- AI：OpenAI 兼容适配器（沿用 `server/src/ai/` 工厂）

**Storage**: SQLite（`server/data/community.db`）；新增 `fan_personas`、`fan_discussions`、`fan_discussion_turns`、`content_reports` 表；扩展 `feed_items.type` 枚举与 `visibility` 语义

**Testing**: Jest（`server/` contract + unit）；Fan Agent / 内容过滤 / 举报审核路径 Mock AI，100% 分支覆盖；前台人工测试

**Target Platform**: Windows 开发 + Node.js 后台 + Vue 3 浏览器前台

**Project Type**: Web 应用（前后端分离）

**Performance Goals**:
- 创建讨论并生成首轮 ≥4 条 Persona 发言：p95 < 60s（对齐 AgentProfile `fan.timeout_ms=60000` 与 SC-005）
- 用户插话后下一轮 AI 响应：p95 < 30s（单轮续写，较首轮轻量）
- Fan Persona 列表 API p95 < 100ms（SQLite 种子数据）
- 举报提交 API p95 < 200ms

**Constraints**:
- 前台 Vite dev server 监听 `0.0.0.0`
- Fan Agent 首轮生成超时 60s；续写轮次超时 30s
- 人身攻击、歧视、违法、虚假官方声明类内容 MUST 在持久化前拦截（FR-022）
- 脚本使用 PowerShell；文件 UTF-8
- 多模块：User/FeedItem/Auth/Team/Match 直接引用 [001](../001-football-feed-mvp/data-model.md)、[002](../002-football-stats-content/data-model.md) 与对应 contracts；004 契约仅描述 MVP-4 增量端点

**Scale/Scope**:
- Fan Persona 种子：6 联赛 × 2–3 支代表球队 ≈ 12–18 条 Persona
- 1 个前台入口页 `/fan` + 1 个讨论详情页 `/discussions/:discussionId`
- 1 个管理员审核页 `/admin/reports`（moderator/admin）
- 预估 tasks ≤ 26（符合原则 XII ≤30）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 判定 | 理由（关联本 plan 的具体方案要素） |
|------|------|-----------------------------------|
| I. 前后端分离架构 | ✅ PASS | `web/` + `server/` + SQLite；路由 `/fan`、`/discussions/:discussionId`、`/admin/reports` |
| II. 契约优先 | ✅ PASS | `contracts/openapi.yaml` 先定义 FanDiscussions/ContentReports/Admin 端点 |
| III. 测试纪律 | ✅ PASS | fan-agent / content-moderation / reports 契约测试 + AI 路径 Mock 100% 分支 |
| IV. AI/LLM 外部服务治理 | ✅ PASS | `AiFanService` + 外置 `prompts/fan-discussion.md`；超时降级 |
| V. 可观测性优先 | ✅ PASS | 沿用 request-id 日志；新增 fan_discussion_created / content_report_submitted 指标 |
| VI. 简单优先 (YAGNI) | ✅ PASS | 无实时聊天/WebSocket；SQLite 单库；Persona 种子只读 |
| VII. 安全与权限 | ✅ PASS | 讨论按 `user_id` 隔离；举报需登录；隐藏 API 限 moderator/admin RBAC |
| VIII. 用户界面可视化验证 | ✅ PASS | Fan 入口 → 讨论详情 → 插话 → 举报 → 管理员隐藏路径人工截图 |
| IX. 用户界面视觉质量标准 | ✅ PASS | Persona 气泡/球队色标签沿用 `#1B5E20` 品牌色与空/加载/违规提示态 |
| X. Corrector 修正回归纪律 | ✅ PASS | BUG 追溯 tasks.md 任务 ID |
| XI. 模块边界纪律 | ✅ PASS | External Dependencies 显式消费 001 User/Feed/Auth、002 Match/Team |
| XII. Spec 颗粒度纪律 | ✅ PASS | 1 个 US；预估 ≤26 task |

**Gate Result**: ALL PASS — 可进入 Phase 0 研究与 Phase 1 设计

**高风险路径标记（L4 审查）**: Fan Agent 多 Persona 生成（FR-019–022）、社区内容发布与审核（FR-030、Constitution III 社区内容路径）— 须 Mock + 真实调用各至少 1 次端到端走查

## Project Structure

### Documentation (this feature)

```text
specs/004-football-fan-community/
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
│   ├── agents/
│   │   └── fan-agent.js                  # Fan 讨论编排（首轮批量 + 续写轮）
│   ├── ai/
│   │   └── ai-fan-service.js             # Fan 专用语义接口
│   ├── api/
│   │   ├── fan-discussions.js            # /fan-discussions、/fan-personas
│   │   ├── content-reports.js            # 用户举报
│   │   └── admin-reports.js              # 管理员审核/隐藏
│   ├── services/
│   │   ├── fan-discussion-service.js     # 讨论 CRUD + 轮次持久化
│   │   ├── fan-context-builder.js        # 主题/Match/Feed 上下文组装
│   │   ├── content-moderation-service.js # 生成前/用户输入过滤
│   │   └── feed-service.js               # 扩展 fan_discussion 发布
│   ├── db/
│   │   ├── migrations/007_fan_community.sql
│   │   └── repositories/                 # fan-persona, fan-discussion, content-report
│   └── prompts/
│       └── fan-discussion.md
└── tests/
    ├── contract/                         # fan-discussions, content-reports, admin-reports
    └── unit/                             # fan-agent, content-moderation, fan-context-builder

web/
├── src/
│   ├── views/
│   │   ├── FanStartView.vue              # /fan
│   │   ├── FanDiscussionView.vue         # /discussions/:discussionId
│   │   └── AdminReportsView.vue          # /admin/reports
│   ├── components/
│   │   └── fan/                          # PersonaPicker, TurnBubble, ReportDialog
│   └── api/                              # fan-discussions.ts, content-reports.ts
```

**Structure Decision**: 延续 MVP-1/2/3 的 `server/` + `web/` 单体布局。Fan 讨论采用独立表而非复用 `Conversation`，因多 Persona 交替轮次、批量首轮生成与 Feed 聚合语义与 Stats/Scout 单 Agent 对话模式本质不同；举报/审核作为独立 API 模块，复用既有 RBAC 中间件。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `fan_discussions` + `fan_discussion_turns` 独立表 | 多 Persona 交替、批量首轮 ≥4 轮、每轮绑定 persona_id | 复用 `Conversation`/`Message` 无法表达多 Persona 同会话且与 agent_id 单 Agent 模型冲突 |
| `AiFanService` 独立语义接口 | Constitution IV 要求业务语义分离；输出 schema 为 `{turns[]}` 非 Stats metrics | 复用 `AiContentService` 无法约束多 Persona 结构化输出与轮次编排 |
| `ContentModerationService` + `content_reports` 表 | FR-022 生成前拦截 + FR-030 举报/隐藏双路径；高风险审核须 100% 分支覆盖 | 仅靠 Prompt 无法保证违规内容不入库；无持久化则管理员无法追溯举报 |
| `fan_personas` 种子表 | FR-019/020 要求可选 ≥2 Persona 且风格差异可验证 | 运行时 LLM 即兴编造 Persona 导致风格不可复现、无法契约测试 |
| FeedItem `fan_discussion` 类型 + `visibility=hidden` | 讨论发布至 Feed 且管理员可隐藏（FR-030） | 仅软删 turn 会导致 Feed 仍展示入口；需在 Feed 层统一过滤 |

## Scope 边界验证清单

| 边界承诺 | 验证方式 |
|----------|----------|
| 不修改 001 User/Auth 契约语义 | 004 migration 仅 ADD 新表；001 表结构不变 |
| 不修改 002 Match/Team 表定义 | fan_context_builder 只读 Match/Team |
| 无用户私信/实时聊天 API | contract test 断言无 `/messages/direct`、`/chat-rooms` |
| 无 Conversation agentId=fan 路径 | contract test 断言 conversations API 不含 fan 分支 |
| 违规内容不入库 | content-moderation 单元测试：人身攻击样例 → 422 + 无 turn 写入 |
| 管理员隐藏后 Feed 不可见 | admin-reports 契约测试：hide 后 GET /feed 不含该 discussion |
| 002/003 功能回归 | 既有 conversations.test.js / scout 测试套件仍 PASS |

## Post-Design Constitution Re-Check

Phase 1 设计完成后复验：FanPersona/FanDiscussion/ContentReport 实体与 contracts 通过模块边界检查；AI Prompt 外置、内容过滤双层、RBAC 隐藏、Feed 扩展均已落地。**Gate Result**: ALL PASS
