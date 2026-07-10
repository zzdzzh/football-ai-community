# Data Model: Fan Agent 与社区治理

**Date**: 2026-07-10  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Prerequisites**: [003-football-scout-tactical/data-model.md](../003-football-scout-tactical/data-model.md)（或至少 [002-football-stats-content/data-model.md](../002-football-stats-content/data-model.md)）

> 本文件定义 MVP-4 **新增/扩展**实体。User、AgentProfile、FeedItem（基础字段）、Team、Match 定义以 001/002 为准，此处仅描述扩展与新增。

## 实体关系概览

```text
Team 1──* FanPersona
FanPersona *──* FanDiscussion (via fan_discussion_personas 关联表)
User 1──* FanDiscussion 1──* FanDiscussionTurn
FanDiscussion 1──0..1 FeedItem (fan_discussion, via event_key)
FanDiscussion *──0..1 Match (optional match_id)
User 1──* ContentReport
FanDiscussionTurn 1──* ContentReport (target)
FanDiscussion 1──* ContentReport (target)
```

---

## FanPersona（模拟球迷人格）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | 如 `persona-man-united` |
| team_id | TEXT | FK → Team.id, NOT NULL | 关联球队 |
| display_name | TEXT | NOT NULL | 如「红魔老球迷老张」 |
| style_traits_json | TEXT (JSON) | NOT NULL | 风格标签数组，如 `["乐观","护短"]` |
| accent_phrases_json | TEXT (JSON) | NOT NULL | 口癖/惯用语示例 |
| enabled | INTEGER (0/1) | NOT NULL, DEFAULT 1 | |
| created_at | TEXT (ISO8601) | NOT NULL | |
| updated_at | TEXT (ISO8601) | NOT NULL | |

**索引**: `(team_id)`, `(enabled)`

**Validation**:
- 创建讨论时选择的 persona MUST `enabled=1` 且互不相同
- 至少选择 2 个 persona（FR-019）

**Consumed By**: 本 feature（004）

---

## FanDiscussion（模拟讨论）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | |
| user_id | TEXT | FK → User.id, NOT NULL | 发起人；用户级隔离 |
| topic | TEXT | NOT NULL | 讨论主题，1–200 字符 |
| match_id | TEXT | FK → Match.id, NULL | 可选，赛后议题 |
| status | TEXT | NOT NULL, DEFAULT 'active' | `active` / `hidden` / `archived` |
| turn_count | INTEGER | NOT NULL, DEFAULT 0 | 冗余计数，含 user + persona turns |
| feed_item_id | TEXT | FK → FeedItem.id, NULL | 发布后回填 |
| created_at | TEXT (ISO8601) | NOT NULL | |
| updated_at | TEXT (ISO8601) | NOT NULL | |

**索引**: `(user_id, updated_at DESC)`, `(status)`, `(match_id)`

**状态转换**:
```text
active → hidden（管理员 hide 或关联举报处理）
active → archived（预留，MVP-4 不暴露 API）
```

**Consumed By**: 本 feature（004）

---

## FanDiscussionPersona（讨论-Persona 关联）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| discussion_id | TEXT | FK → FanDiscussion.id, NOT NULL | |
| persona_id | TEXT | FK → FanPersona.id, NOT NULL | |

**主键**: `(discussion_id, persona_id)`

**Consumed By**: 本 feature（004）

---

## FanDiscussionTurn（讨论轮次）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | |
| discussion_id | TEXT | FK → FanDiscussion.id, NOT NULL | |
| sequence | INTEGER | NOT NULL | 会话内递增序号，从 1 开始 |
| role | TEXT | NOT NULL | `persona` / `user` |
| persona_id | TEXT | FK → FanPersona.id, NULL | role=persona 时必填 |
| user_id | TEXT | FK → User.id, NULL | role=user 时必填 |
| content | TEXT | NOT NULL | 发言正文 |
| is_hidden | INTEGER (0/1) | NOT NULL, DEFAULT 0 | 管理员隐藏单条 |
| created_at | TEXT (ISO8601) | NOT NULL | |

**索引**: `(discussion_id, sequence ASC)`

**Validation**:
- role=persona → persona_id NOT NULL, user_id NULL
- role=user → user_id NOT NULL, persona_id NULL
- content 写入前 MUST 通过 ContentModerationService（FR-022）
- 首轮创建后 persona turns ≥ 4（SC-005）

**Consumed By**: 本 feature（004）

---

## ContentReport（内容举报）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | |
| reporter_user_id | TEXT | FK → User.id, NOT NULL | 举报人 |
| target_type | TEXT | NOT NULL | `fan_discussion` / `fan_discussion_turn` |
| target_id | TEXT | NOT NULL | 目标 ID |
| reason | TEXT | NOT NULL | 举报原因，1–500 字符 |
| status | TEXT | NOT NULL, DEFAULT 'pending' | `pending` / `hidden` / `dismissed` |
| reviewed_by | TEXT | FK → User.id, NULL | 处理人 |
| reviewed_at | TEXT (ISO8601) | NULL | |
| created_at | TEXT (ISO8601) | NOT NULL | |

**索引**: `(status, created_at DESC)`, `(target_type, target_id)`

**Validation**:
- 同一 reporter + target 24h 内不可重复举报（防刷）
- hide 操作 MUST 更新 target 的 hidden 状态（FR-030）

**Consumed By**: 本 feature（004）

---

## FeedItem 扩展（004 变更）

在 [001 FeedItem](../001-football-feed-mvp/data-model.md#feeditem社区动态) + [002 扩展](../002-football-stats-content/data-model.md#feeditem-扩展002-变更) 基础上：

| 变更 | 说明 |
|------|------|
| `type` 枚举扩展 | 新增 `fan_discussion` |
| `visibility` 语义扩展 | 已有字段；取值 `public` / `hidden`（管理员 hide 时设为 hidden） |
| 新增列 `body_json` 复用 | 002 已 ADD；004 写入 `{ discussionId, personaIds[], turnCount }` |
| `event_key` 约定 | `fan_discussion:{discussionId}` 去重 |
| `agent_id` | 固定 `fan` |

**Consumed By**: 本 feature（004）；Feed 列表/详情 UI 沿用 001

---

## AgentProfile（无 schema 变更）

001 种子已含 `fan`，`timeout_ms=60000`。004 实现层读取该配置。

---

## SQLite 迁移策略

- `server/src/db/migrations/007_fan_community.sql`：
  - CREATE `fan_personas`, `fan_discussions`, `fan_discussion_personas`, `fan_discussion_turns`, `content_reports`
  - INSERT Fan Persona 种子（12–18 条，关联已有 teams）
- `PRAGMA foreign_keys = ON`
- 讨论创建：persona 关联 + turns 批量插入 + FeedItem 插入同一事务

## 跨模块引用说明

| 实体 | 定义位置 | 本 feature 操作 |
|------|----------|-----------------|
| User, Auth | 001 | 只读引用 |
| FeedItem 基础字段 | 001 | 扩展 type/visibility 用法；若 001 OpenAPI FeedItem.type 枚举未含 `fan_discussion`，须在 `specs/001-football-feed-mvp/tasks.md` 增补契约扩展任务 |
| Team, Match | 002 | 只读引用（FanContextBuilder） |
| Conversation, Message | 002/003 | 不修改、不扩展 agent_id=fan |
