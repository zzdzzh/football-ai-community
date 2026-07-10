# Data Model: 足球社区 Feed MVP

**Date**: 2026-07-10  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

> 比赛、对话、球员等实体在 [002-football-stats-content](../002-football-stats-content/spec.md) 及后续 spec 中扩展，本文件仅定义 MVP-1 实体。

## 实体关系概览

```text
User 1──* UserPreference
User 1──* AgentInteractionLog (optional user_id)

FeedItem *──1 AgentProfile
AgentProfile 1──* FeedItem

NewsCacheMeta (standalone per source)
```

---

## User（用户）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | |
| email | TEXT | UNIQUE, NOT NULL | |
| password_hash | TEXT | NOT NULL | bcrypt |
| nickname | TEXT | NOT NULL | 2–32 字符 |
| role | TEXT | NOT NULL, DEFAULT 'user' | `user` / `moderator` / `admin` |
| created_at | TEXT (ISO8601) | NOT NULL | |
| updated_at | TEXT (ISO8601) | NOT NULL | |

**Consumed By**: 本 feature

---

## AgentProfile（Agent 配置）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | `news`, `stats`, `scout`, `tactical`, `fan`, `content` |
| display_name | TEXT | NOT NULL | |
| description | TEXT | NOT NULL | |
| enabled | INTEGER (0/1) | NOT NULL, DEFAULT 1 | |
| timeout_ms | INTEGER | NOT NULL | Fan: 60000，其余: 30000 |
| created_at | TEXT | NOT NULL | |
| updated_at | TEXT | NOT NULL | |

**MVP-1 规则**: 只读种子数据，无创建/修改 API

---

## FeedItem（社区动态）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | |
| agent_id | TEXT | FK → AgentProfile.id, NOT NULL | |
| type | TEXT | NOT NULL | MVP-1 仅 `news_summary` |
| title | TEXT | NOT NULL | |
| summary | TEXT | | |
| source_url | TEXT | | |
| source_name | TEXT | | |
| key_points | TEXT (JSON array) | | |
| event_key | TEXT | | 去重键 |
| related_to | TEXT | FK → FeedItem.id, NULL | |
| visibility | TEXT | NOT NULL, DEFAULT 'public' | |
| published_at | TEXT | NOT NULL | |
| created_at | TEXT | NOT NULL | |

**索引**: `(published_at DESC)`, `(agent_id)`, `(event_key)`

---

## UserPreference（用户偏好）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | |
| user_id | TEXT | FK → User.id, UNIQUE, NOT NULL | |
| followed_teams | TEXT (JSON array) | NOT NULL, DEFAULT '[]' | 球队名称或 ID 字符串 |
| followed_leagues | TEXT (JSON array) | NOT NULL, DEFAULT '[]' | PL / PD / BL1 / SA / FL1 / CL |
| enabled_agents | TEXT (JSON array) | NOT NULL | Agent ID 列表 |
| notify_match_report | INTEGER (0/1) | DEFAULT 1 | 预留，002 启用 |
| updated_at | TEXT | NOT NULL | |

---

## NewsCacheMeta（新闻抓取元数据）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| source_id | TEXT | PK | |
| last_fetch_at | TEXT | | |
| last_error | TEXT | NULL | |
| status | TEXT | NOT NULL | `ok` / `degraded` / `down` |

---

## AgentInteractionLog（Agent 交互日志）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | |
| user_id | TEXT | FK → User.id, NULL | |
| agent_id | TEXT | FK → AgentProfile.id, NOT NULL | |
| request_type | TEXT | NOT NULL | `generate` / `cron` |
| status | TEXT | NOT NULL | `success` / `timeout` / `error` / `degraded` |
| duration_ms | INTEGER | NOT NULL | |
| model | TEXT | NULL | |
| prompt_tokens | INTEGER | NULL | |
| completion_tokens | INTEGER | NULL | |
| error_message | TEXT | NULL | |
| created_at | TEXT | NOT NULL | |

---

## SQLite 迁移策略

- `server/src/db/migrations/001_initial.sql` — 上表全部字段
- `server/src/db/migrations/002_seed_agents.sql` — 6 个 AgentProfile
- `PRAGMA foreign_keys = ON`；Feed 批量插入与去重同一事务

## 后续 Spec 扩展预告

002 将新增：Team, Match, Conversation, Message，并扩展 FeedItem.type 为 `match_report` / `brief_report`。
