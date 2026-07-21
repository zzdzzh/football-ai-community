# Implementation Plan: 关系分析 LLM 叙事解读

**Branch**: `007-relationship-llm-narrative` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-relationship-llm-narrative/spec.md`

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

**Prerequisites**: [005 球员关系分析](../005-player-relationship-analysis/spec.md) 分析可就绪；[001 认证](../001-football-feed-mvp/spec.md) 登录策略与关系页一致；兑现 005 **FR-019**，解除 005 **FR-018** 对本能力的「本 MVP 不交付」限制（仅限本 feature，不改写 005 履历计算）

## Summary

在已交付的球员对结构化关系结论之上，为登录用户提供**一次性**简体中文关系叙事：输入仅限已入库履历摘要与 005 计算出的结论；经统一 AI 抽象层调用 OpenAI 兼容模型；Prompt 外置；超时/上游失败/内容核验失败时降级保留结构化面板。叙事按「球员对 + 结论版本」持久化以便重入复用；纳入既有 `assertAiRateLimit`。架构沿用 Vue 3 + Element Plus（`web/`）与 Node.js Express + SQLite（`server/`）。本 feature 以独立契约挂载叙事端点，**不修改** 005 OpenAPI 字段语义；内部只读消费 `PlayerPairAnalysis`。本 spec 含 3 个 User Story，预估 tasks ≤ 26，符合 Constitution 原则 XII。

## Technical Context

**Language/Version**: Node.js 20 LTS（后台）；Vue 3.4+ / TypeScript 5.x（前台）

**Primary Dependencies**:
- 后台（沿用）：Express 4.x、better-sqlite3、jsonwebtoken、zod、既有 `server/src/ai/`（OpenAI 兼容适配器）
- 后台（新建）：`AiRelationshipService`（统一业务语义入口）、`RelationshipNarrativeAgent`（组装上下文、调用、核验、持久化）、叙事 API 路由与 repository
- 前台（沿用）：Vite 5.x、Element Plus、Vue Router、Pinia、axios
- 前台（增量）：`RelationshipAnalysisView` 叙事区（生成/加载/失败/AI 标识）
- AI：复用 OpenAI 兼容通道；**不**引入第二套供应商；Prompt：`server/prompts/relationship-narrative.md`

**Storage**: SQLite（`server/data/community.db`）；迁移 `016_relationship_narratives.sql` 新增 `relationship_narratives`；可选种子扩展 `agent_profiles` 增加 `relationship`；**不 ALTER** 005 `player_pair_analyses` 结论字段语义

**Testing**: Jest（`server/` contract + unit）；叙事生成/核验/限流/降级路径 Mock 适配器，**100% 分支覆盖**（Constitution III AI 路径）；前台人工测试（非 Playwright）

**Target Platform**: Windows 开发 + Node.js 后台 + Vue 3 浏览器前台

**Project Type**: Web 应用（前后端分离）

**Performance Goals**:
- 触发生成 → 正文或明确失败提示：p95 < 60s（对齐 SC-002）
- 同结论版本复用读取（本地命中）：p95 < 3s（对齐 SC-004）
- 分析未就绪拒绝生成：p95 < 200ms（本地校验）
- AI 调用超时：沿用 `agent_profiles.timeout_ms`（建议 45000ms，≤60s 门禁）

**Constraints**:
- 前台 Vite dev server 监听 `0.0.0.0`
- 叙事端点需登录（JWT Bearer + RBAC `user`），与关系页一致
- 仅 `status=ready` 的球员对分析可生成；输入禁止未入库外部传闻
- 禁止捏造共同效力/路径/荣誉；矛盾输出须拒绝采信并降级
- MVP 仅一次性介绍，禁止多轮关系聊天 Agent
- 不修改 005 履历采集、队友/BFS 语义；不静默改 005/006 契约字段含义
- 叙事请求纳入 `assertAiRateLimit({ userId, agentId: 'relationship' })`
- 脚本使用 PowerShell；文件 UTF-8
- 多模块：直接引用 [005 data-model/contracts](../005-player-relationship-analysis/)、[001 Auth](../001-football-feed-mvp/)；若未来必须改 005 响应挂载叙事字段，须在 005 `tasks.md` 增补后再改对端

**Scale/Scope**:
- 单页增量：`/relationships/:playerIdA/:playerIdB` 叙事区
- 叙事正文约数百字量级；样例验收 ≥5 对有关系 + ≥3 对无关联（SC-001）
- 3 个 User Story（P1/P2/P3）；预估 tasks ≤ 26（符合原则 XII ≤30）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 判定 | 理由（关联本 plan 的具体方案要素） |
|------|------|-----------------------------------|
| I. 前后端分离架构 | ✅ PASS | `web/` + `server/` + SQLite；URL 仍带双球员核心 ID |
| II. 契约优先 | ✅ PASS | 本 feature `contracts/openapi.yaml` 先定义叙事 GET/POST；005/001 只引用不改正文 |
| III. 测试纪律 | ✅ PASS | 生成/核验/限流/降级单元+契约；AI 路径 Mock 100% 分支 |
| IV. AI/LLM 外部服务治理 | ✅ PASS | `AiRelationshipService` + 外置 Prompt；超时与降级；调用写 `agent_interaction_logs` |
| V. 可观测性优先 | ✅ PASS | 沿用 request-id；记录模型/token/耗时/成功失败；叙事生成事件计数 |
| VI. 简单优先 (YAGNI) | ✅ PASS | 无多轮对话/无审核流/无 Feed 同步；单表持久化 + 结论版本键 |
| VII. 安全与权限 | ✅ PASS | JWT 鉴权；未登录 401；不暴露堆栈；限流防滥用 |
| VIII. 用户界面可视化验证 | ✅ PASS | 生成/失败/限流态人工截图与交互断言；从关系页真实路径进入 |
| IX. 用户界面视觉质量标准 | ✅ PASS | 品牌色；空/加载/失败态；标明 AI 基于本页结论生成 |
| X. Corrector 修正回归纪律 | ✅ PASS | BUG 追溯 tasks.md 任务 ID |
| XI. 模块边界纪律 | ✅ PASS | External Dependencies 显式消费 005/001；007 不改对端契约正文 |
| XII. Spec 颗粒度纪律 | ✅ PASS | 3 个 US；预估 ≤26 task |

**Gate Result**: ALL PASS — 可进入 Phase 0 研究与 Phase 1 设计

**高风险路径标记（L4 审查）**: AI/LLM 叙事生成与内容核验（Constitution III/IV）— 须 Mock 全覆盖 + 至少 1 次真实外部调用端到端走查；鉴权与限流（Constitution VII）；UI 降级路径人工验收（Constitution VIII）

## Project Structure

### Documentation (this feature)

```text
specs/007-relationship-llm-narrative/
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
├── prompts/
│   └── relationship-narrative.md          # 外置 Prompt（事实边界 + 输出格式）
├── src/
│   ├── ai/
│   │   ├── ai-relationship-service.js     # 业务语义 AI 入口（经 adapter）
│   │   └── factory.js                     # 注册 createAiRelationshipService
│   ├── agents/
│   │   └── relationship-narrative-agent.js
│   ├── api/
│   │   └── relationship-narratives.js     # GET/POST 叙事
│   ├── services/
│   │   ├── relationship-narrative-service.js
│   │   └── relationship-narrative-verifier.js  # 主张核验 / 拒绝矛盾
│   └── db/
│       ├── migrations/016_relationship_narratives.sql
│       └── repositories/
│           └── relationship-narrative-repository.js
└── tests/
    ├── contract/                          # narrative 端点
    └── unit/                              # agent / verifier / rate-limit 接入

web/
├── src/
│   ├── views/
│   │   └── RelationshipAnalysisView.vue   # 增量：叙事区
│   ├── components/
│   │   └── relationship/
│   │       └── RelationshipNarrativePanel.vue
│   └── api/
│       └── relationship-narratives.ts
```

**Structure Decision**: 延续 `server/` + `web/` 布局。叙事作为 007 独立资源与表，经服务层只读调用 005 已有分析仓储/服务，避免把 LLM 字段塞进 005 `result_json` 或改对端 OpenAPI。AI 走统一抽象 + 外置 Prompt；前台仅在既有关系分析页增量展示，URL 核心 ID 不变。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 独立 `relationship_narratives` 表 | FR-010 要求按结论版本持久化复用；与分析快照解耦 | 仅内存/客户端缓存无法跨会话重入，也无法审计生成版本 |
| 独立 `AiRelationshipService` | Constitution IV 要求业务语义 AI 接口，与 Content/Analysis 并列 | 业务直调 adapter 违反抽象层；硬塞进 ContentAgent 会混淆赛后战报语义 |
| `relationship-narrative-verifier` | FR-003/Edge：拒绝矛盾捏造，不能原样展示 | 纯 Prompt 约束无法满足 SC-001 零矛盾门禁 |

## Scope 边界验证清单

| 边界承诺 | 验证方式 |
|----------|----------|
| 不修改 005 履历采集 / 队友 / BFS 语义 | 005 既有 unit/contract 仍 PASS；007 无改 `014_player_relationship.sql` 结论计算 |
| 不静默改 005/006 OpenAPI 字段含义 | 007 contracts 独立文件；对端 yaml 无 diff |
| 无多轮关系聊天 | contract 无 conversation 式 follow-up 端点；仅一次性 narrative |
| 仅分析 ready 可生成 | unit/contract：computing/failed → 409/400 业务拒绝 |
| 失败降级不吞结构化面板 | 前台失败态仍渲染 005 结论；API 错误不删除分析 |
| 未登录不可叙事 | contract：无 token → 401 |
| 纳入 AI 限流 | unit：超限 429；agentId=`relationship` |
| 禁止荣誉类未验证主张 | verifier unit：荣誉 claim → reject |

## Post-Design Constitution Re-Check

Phase 1 设计完成后复验：RelationshipNarrative 与 contracts 边界清晰；消费 005/001 为只读引用；AI 经 `AiRelationshipService` + 外置 Prompt + 超时降级；高风险 AI 路径可测。**Gate Result**: ALL PASS
