# Data Model: 关系分析 LLM 叙事解读

**Date**: 2026-07-17  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Prerequisites**:
- [001-football-feed-mvp/data-model.md](../001-football-feed-mvp/data-model.md)（User / Auth，鉴权复用）
- [005-player-relationship-analysis/data-model.md](../005-player-relationship-analysis/data-model.md)（PlayerPairAnalysis / CareerPlayer，只读事实来源）

> 本文件定义 007 **新增**实体。User、PlayerPairAnalysis、CareerPlayer 以对端为准，**不在此重定义字段全集**。  
> 不修改 005 `result_json` 结构语义。

## 实体关系概览

```text
User（001，鉴权） ──发起──► NarrativeGenerationRequest（瞬时）
                              │
PlayerPairAnalysis（005） 1──* RelationshipNarrative（007）
        │                         │
        └── analysis_id + computed_at = 结论版本键
```

---

## RelationshipNarrative（关系叙事）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | |
| player_id_low | TEXT | NOT NULL | 与 005 一致的字典序较小履历球员 ID |
| player_id_high | TEXT | NOT NULL | 字典序较大 |
| analysis_id | TEXT | NOT NULL | 对应 005 `player_pair_analyses.id` |
| analysis_computed_at | TEXT (ISO8601) | NOT NULL | 生成时所绑定的结论 `computed_at` |
| status | TEXT | NOT NULL | `ready` / `failed`（持久化成功正文仅用 ready；失败可不落库或落库供调试） |
| narrative_text | TEXT | NULL | 简体中文介绍正文；`ready` 时 NOT NULL |
| model | TEXT | NULL | 生成所用模型名 |
| prompt_version | TEXT | NULL | Prompt 文件版本或哈希（可观测） |
| claims_json | TEXT (JSON) | NULL | 模型声明的可核验主张（核验通过后可选保存） |
| error_code | TEXT | NULL | 失败时业务码（如 `timeout` / `verification_failed`） |
| error_message | TEXT | NULL | 对用户可展示的失败摘要 |
| created_by_user_id | TEXT | NULL | 触发生成的用户（审计；内容本身不按 user 隔离） |
| created_at | TEXT (ISO8601) | NOT NULL | |
| updated_at | TEXT (ISO8601) | NOT NULL | |

**唯一约束**: `(analysis_id, analysis_computed_at)` — 同一结论版本至多一条成功叙事（`force` 重生成时 UPDATE 或先删后插）

**索引**: `(player_id_low, player_id_high)`, `(analysis_id)`, `(created_at DESC)`

**Validation**:
- 仅当对应分析 `status=ready` 且 `computed_at` 匹配时允许写入 `status=ready`
- `narrative_text` 中的事实主张 MUST 已通过 verifier；未通过 MUST NOT 以 `ready` 持久化
- MUST NOT 存储未经核验的「荣誉夺冠」类主张为事实

**State transitions**:
```text
(无) ──生成成功──► ready
(无) ──生成/核验失败──►（不落库或 failed 行，供排障；用户侧表现为错误提示）
ready ──force 重生成成功──► ready（同版本覆盖正文）
ready ──分析 computed_at 变更──► 逻辑过期（行仍在，GET 判定 stale）
```

**Consumed By**: 本 feature（007）；关系分析页 UI

**Owning Feature**: 007-relationship-llm-narrative

---

## NarrativeGenerationRequest（叙事生成请求，逻辑实体）

非持久化 API 请求语义：

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| playerIdA / playerIdB | UUID | 路径必填 | 与关系页核心 ID 一致 |
| force | boolean | 可选，默认 false | true 时忽略同版本缓存并重新调用模型 |

**Validation**:
- 未登录 → 拒绝
- 分析非 ready → 拒绝生成
- 超限流 → 429，不调用模型

**Consumed By**: API 层（瞬时）

---

## 只读消费：PlayerPairAnalysis（005）

本 feature **消费**字段（不拥有）：

| 字段 | 用途 |
|------|------|
| id / analysisId | 版本关联 |
| computedAt | 版本关联与 stale 判定 |
| status | 仅 `ready` 允许生成 |
| result（clubmates / transfer / path 等） | 叙事唯一事实来源 |
| dataFreshness | 可选写入 Prompt 上下文说明滞后 |

**Consumed By**: 007（只读）  
**Owning Feature**: 005-player-relationship-analysis

---

## AgentProfile 扩展（可选种子）

| id | display_name | timeout_ms | 说明 |
|----|--------------|------------|------|
| relationship | 关系叙事 Agent | 45000 | 供限流 agentId 与超时配置 |

若沿用通用配置而不新增行，MUST 仍使用稳定 `agentId='relationship'` 写入交互日志与限流键。

**Consumed By**: 007 AI 调用与限流

---

## 与 001 / 005 的消费关系

| 实体 | Owning Feature | Consumed By |
|------|----------------|-------------|
| User / JWT 会话 | 001 | 007（鉴权） |
| PlayerPairAnalysis / CareerPlayer | 005 | 007（只读事实） |
| RelationshipNarrative | 007 | 007 |

若未来需在 005 分析响应中内嵌叙事摘要，MUST 在 005 `tasks.md` 增补契约任务后再改对端，禁止在 007 内静默修改 005 OpenAPI。
