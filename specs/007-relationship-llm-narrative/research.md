# Research: 关系分析 LLM 叙事解读

**Date**: 2026-07-17  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## R1: 与 005 的边界与挂载方式

**Decision**: 007 新增独立 REST 资源（叙事 GET/POST），路径挂在球员对之下以便与页面核心 ID 一致：

- `GET /api/player-pair-analyses/{playerIdA}/{playerIdB}/narrative`
- `POST /api/player-pair-analyses/{playerIdA}/{playerIdB}/narrative`

契约写在 **007** `contracts/openapi.yaml`，**不修改** 005 OpenAPI 正文，也不往 `PlayerPairAnalysisResponse` 内嵌叙事字段。服务端内部只读调用既有球员对分析查询（同库 / 同服务层）。

**Rationale**:
- Spec FR-012：禁止静默改写 005/006 契约字段含义；扩展须本模块声明，对端变更走对端 tasks
- 005 已交付分析页与 `analysisId`/`computedAt`；独立端点可增量验收，无需阻塞 005 契约回归
- URL 仍使用双球员 ID，满足重入与面包屑

**Alternatives considered**:
- **扩展 005 GET 分析响应内嵌 `narrative`**：须改 005 OpenAPI → 按规约先在 005 `tasks.md` 增补；拉长协作链，本期不必要
- **全新顶级 `/relationship-narratives` 无 path 球员 ID**：可用，但与关系页核心 ID 绑定弱于 path 方案

## R2: 结论版本键与复用策略

**Decision**:
- 版本键 = `analysis_id`（005 `player_pair_analyses.id`）+ `computed_at`（ISO8601）
- 唯一约束：`(player_id_low, player_id_high, analysis_id, computed_at)` 或等价 `(analysis_id, computed_at)`（分析行已唯一对应球员对）
- `GET`：若存在 `status=ready` 且版本匹配当前分析 → 直接返回正文（复用，不计 AI 限流或可选计轻量读）
- `POST`：默认「有匹配版本则返回已有」；`force=true` 时基于当前结论重新生成并覆盖/插入新版本行
- 分析强制重算导致 `computed_at` 变化 → 旧叙事视为过期；GET 可返回 `stale` 提示或 404 + 引导重新生成

**Rationale**: FR-010 / US3；005 快照以 `computed_at` 标识结论时间。

**Alternatives considered**:
- **对 `result_json` 做 hash 作版本**：更严，但重算未变内容仍会变 id；`computed_at` 已足够表达「用户触发了重算」
- **每次进入强制重新生成**：违背 SC-004 与成本控制

## R3: AI 抽象、Prompt 与 Agent 形态

**Decision**:
- 新增 `AiRelationshipService`：经 `factory` + OpenAI 兼容 adapter 调用；写 `agent_interaction_logs`（模型、token、耗时、成功/失败）
- `agentId = 'relationship'`；migration 种子写入 `agent_profiles`（timeout_ms 建议 45000）
- 领域编排放在 `RelationshipNarrativeAgent`：加载外置 `server/prompts/relationship-narrative.md`，组装**最小充分**上下文（双方姓名、结构化结论摘要、关键效力段摘要），禁止塞入未入库新闻
- 业务入口 `relationship-narrative-service`：就绪校验 → 限流（仅真实生成）→ Agent → 持久化

**Rationale**: Constitution IV；005 research 已预留 `AiRelationshipService` + 外置 Prompt；与 Content/Stats 并列清晰。

**Alternatives considered**:
- **复用 ContentAgent**：语义是赛后战报，混用易误改事实规则
- **业务直调 adapter**：违反 Constitution IV

## R4: 防捏造与矛盾核验

**Decision**:
- Prompt 硬约束：仅使用输入 JSON 中的事实；`unknown`/`not_established` 不得改写为成立；无关联须如实说明；禁止荣誉/未给出的路径节点
- 模型输出约定为 JSON：`{ "narrative": "...", "claims": [ ... ] }`（或等价结构化字段）
- `relationship-narrative-verifier`：
  - 从 005 `result` 构建**允许事实集合**（俱乐部名/重叠区间、转会证据、路径节点 id/name、各 verdict status）
  - 校验每条 claim 可映射到允许集合；`status` 类 claim 不得升级
  - 叙事正文中出现的俱乐部/球员专名若可抽取，须落在允许名表（启发式，失败偏保守 → reject）
  - 核验失败 → 不持久化成功叙事，API 返回可展示错误（如 `narrative_verification_failed`），前台降级结构化面板
- 解析失败 / 超时 / 上游错误 → 同等降级，不吞分析结论

**Rationale**: SC-001 零矛盾；Edge Cases「矛盾主张不得原样展示」；对齐 Content Agent 对 timeline 的过滤思路。

**Alternatives considered**:
- **仅靠 Prompt、无服务端核验**：无法满足硬门禁与可测性
- **人工审核工作流**：Out of Scope

## R5: 限流、鉴权与触发时机

**Decision**:
- 所有叙事端点 `authenticate` + 登录用户；未登录 401（与 005 关系页一致）
- `assertAiRateLimit({ userId, agentId: 'relationship' })` 仅在**实际调用模型**前执行；纯缓存命中的 GET/POST 复用路径不消耗配额（或单独配置；默认不消耗）
- 触发：用户主动「生成关系解读」；分析一就绪不自动生成（Assumptions）
- 分析非 `ready`：返回 409（或 400）业务错误，文案提示等待完成

**Rationale**: FR-001/007/008；控制成本与滥用。

**Alternatives considered**:
- **分析就绪自动生成**：易打满限流且浪费配额
- **复用也计入限流**：损害 SC-004 重入体验

## R6: 前台展示与降级 UX

**Decision**:
- 在 `RelationshipAnalysisView` 增加 `RelationshipNarrativePanel`：
  - 分析未就绪：禁用生成 + 说明
  - 空：CTA「生成关系解读」
  - 加载中：明确加载态
  - 成功：正文 + 「由 AI 基于本页结构化结论生成」标识
  - 失败/超时/限流：可读错误 + 重试；**结构化结论区始终保留**
- 若 GET 已有 ready 叙事，进入页面可自动展示（无需再点）；强制重算后显示过期提示并允许重新生成

**Rationale**: US2 / FR-005/006/011；Constitution VIII/IX。

**Alternatives considered**:
- **失败时整页替换为错误页**：违反降级要求
- **无 AI 标识**：违反 FR-011

## R7: 跨模块协作与测试

**Decision**:
- 本期 **不** 要求修改 005 `tasks.md`（因不改对端契约正文）；若实现中发现必须扩展分析响应字段，再按规约增补 005 任务并暂停在 007 内改对端文件
- 单元：就绪门禁、版本复用、force 重生成、核验通过/拒绝、限流 429、超时降级
- 契约：401、409 未就绪、200 结构、429、核验失败错误码
- L4：至少 1 次真实模型调用走查 + UI 截图 ≥2

**Rationale**: 多模块规约；Constitution III/VIII。

**Alternatives considered**:
- **先改 005 再开 007**：不必要，独立资源已覆盖 US
