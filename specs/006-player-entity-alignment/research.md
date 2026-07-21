# Research: 球员实体对齐（统计域 ↔ 履历域）

**Date**: 2026-07-17  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## R1: 映射归属与表设计

**Decision**: 新建 `player_identity_links`（有效映射）与 `player_identity_conflicts`（冲突观测）；可选 `player_identity_align_runs` 记录批处理汇总计数。不 ALTER 003 `players` / 005 `career_players` 主键，不在任一侧写入对端主键为必填外键列。

**Rationale**:
- Spec FR-004 明确两域表结构保持独立；005 plan 曾刻意与 003 分表
- 映射元数据（依据、置信度、状态、时间）属于跨域关注点，独立表便于审计与失效
- 多模块规约：消费 003/005 实体，但不在 006 内改对端模型正文

**Alternatives considered**:
- **在 `career_players` 增加 `stats_player_id`**：把跨域关系塞进 005 表，边界不清，且冲突搁置难表达
- **在 `players` 增加 `career_player_id`**：静默改 003 模型，违反 FR-009
- **运行时 JOIN 不算持久映射**：无法满足可追溯映射与批处理可观测（FR-001/FR-010）

## R2: 对齐键与置信度规则（MVP）

**Decision**:
- 唯一自动高置信度规则：`players.transfermarkt_id`（非空）与 `career_players` 中 `external_source='transfermarkt'` 且 `external_id` 相等的**精确字符串匹配**
- 匹配前规范化：trim；拒绝字面量 `"null"` / 空串（沿用既有爬虫脏数据教训）
- `confidence=high` 仅当两侧各恰好 1 条候选且建立 active 链接
- `medium` / `low`：MVP **不自动产生**；预留枚举供后续 feature
- `career_players.sync_status=failed`：仍可读已有 identity；新对齐若该球员不可用则计入 skip，不删已有 active 链接

**Rationale**: Spec Clarifications 与 FR-002/FR-003；TM ID 是当前两侧唯一可靠外键。

**Alternatives considered**:
- **姓名+出生年模糊匹配自动 high**：Out of Scope，污染高置信度
- **仅用 005 external_id 覆盖写 003 id**：改变主键语义，禁止

## R3: 冲突检测与不覆盖策略

**Decision**:
- **统计侧冲突**：同一 `transfermarkt_id` 对应 ≥2 名 `players` → 不建/不更新 active 链接；写入 `player_identity_conflicts`（`match_key`、候选 ID 列表、侧别=`stats`）
- **履历侧冲突**：同一 `(transfermarkt, external_id)` 理论上有唯一约束；若检测到重复行 → 同等冲突处理（`side=career`）
- **已有 active 链接与新冲突**：不静默改写对端；将相关链接标为 `conflict_shelved` 或保持原状并记冲突（实现选：冲突时拒绝新建，已存在且键仍唯一则保留；键变为多候选则 shelve）
- 运维通过冲突表 + align run 计数人工复核（SC-004）

**Rationale**: FR-005；避免错误合并两名真实球员。

**Alternatives considered**:
- **按 updated_at 自动选最新**：静默覆盖，违反 Spec
- **仅日志无表**：不利于契约与人工复核

## R4: 003 侧 TM ID 可查性（跨模块）

**Decision**:
- 运行时事实：migration `008_scraper_external_ids.sql` 已为 `players.transfermarkt_id` 建列与索引；`upsertPlayer` 已写入；但 003 `data-model.md` / OpenAPI `Player` **未文档化**，`mapPlayerRow` **未对外暴露** `transfermarktId`，且无 `findPlayersByTransfermarktId`
- **006 对齐服务**可在同库内只读查询 `players.transfermarkt_id`（消费已存在列，不改 003 契约文件）
- **若要对客户端暴露 TM ID、或把「按 TM ID 查找」升为 003 公共仓库 API**：按 FR-009 在 [003 tasks.md](../003-football-scout-tactical/tasks.md) 增补任务（本 research 已触发增补提示），由 003 模块落地后再被 006 调用

**Rationale**: 多模块规约；006 不得静默改对端 OpenAPI。

**Alternatives considered**:
- **006 直接改 003 openapi.yaml**：禁止
- **等 003 全部改完再开 006**：不必要；内部只读列即可交付对齐 MVP，契约暴露可并行

## R5: API 形态与触发方式

**Decision**:
- `GET /api/player-identity-links/resolve?statsPlayerId=` 或 `?careerPlayerId=`（二选一）：返回对端 ID、依据、置信度、状态；无映射 → **404**（业务「未找到」，非 500）
- `GET /api/player-identity-links?careerPlayerIds=id1,id2`：关系页批量状态（每人 linked / unlinked / pending_confirmation）
- `POST /api/player-identity-links/align`：登录用户可触发按需对齐（可带可选 `careerPlayerId` / `statsPlayerId` 缩小范围；默认增量扫描可匹配子集）
- `POST /api/internal/player-identity-align`：批处理（沿用项目 Internal Job 模式 + 可选 cron）
- 每次对齐响应/日志包含 `created` / `conflict` / `skipped` 计数

**Rationale**: 覆盖 US1 触发、US2 批量展示、US3 双向解析、FR-006/FR-008/FR-010。

**Alternatives considered**:
- **扩展 005 `GET /career-players/{id}` 内嵌 statsLink**：会改 005 契约，应在 005 tasks 增补；MVP 用 006 独立资源更清晰
- **仅 cron 无按需**：Spec 要求至少一种；两者都提供更利验收

## R6: 前台跨域跳转 UX

**Decision**:
- 在 `RelationshipAnalysisView` 结论区为每位球员展示 `PlayerIdentityLinkBadge`
  - `confidence=high` + `status=active` → 「统计域已关联」+ 跳转 `/players/:statsPlayerId`
  - 非高置信度（若未来有）→ 「待确认」可跳但标注警告
  - 无映射 → 「暂未关联统计库」，**无链接**
- 新增轻量 `PlayerStatsEntryView`（`/players/:playerId`）：展示 003 `GET /players/{id}` 基础信息 + 进入 Scout 的明确 CTA（如带 query 的 `/scout`）；满足 URL 核心 ID 与可重入

**Rationale**: US2 / SC-002；现网无球员详情路由，纯链 Scout 会丢核心 ID。

**Alternatives considered**:
- **只链 `/scout` 不带 playerId**：违反 Constitution URL 约束
- **本期新建完整球员统计大盘**：超出对齐 MVP

## R7: 测试与可观测性

**Decision**:
- 单元：匹配成功、缺 TM ID 跳过、统计侧冲突、履历 failed 跳过、双向 resolve、shelve 行为
- 契约：401、404 未找到、200 结构、align 计数字段
- 指标/日志：`player_identity_align_created_total`、`_conflict_total`、`_skipped_total`；每次 run 写 `align_runs` 或等价结构化日志

**Rationale**: SC-001/SC-004；Constitution III/V。

**Alternatives considered**:
- **仅人工看 DB**：无法回归
