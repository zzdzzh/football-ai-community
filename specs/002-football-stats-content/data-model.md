# Data Model: Stats Agent 与 Content Agent

**Date**: 2026-07-10  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Prerequisites**: [001-football-feed-mvp/data-model.md](../001-football-feed-mvp/data-model.md)

> 本文件定义 MVP-2 **新增/扩展**实体。User、AgentProfile、FeedItem（基础字段）、UserPreference、AgentInteractionLog 定义以 001 为准，此处仅描述扩展与新增。

## 实体关系概览

```text
Team 1──* Match (home)     Match *──1 Team (away)
Match 1──0..1 FeedItem (match_report | brief_report, via event_key)
User 1──* Conversation 1──* Message
Conversation *──0..1 Match | Team (via context_type + context_id)

MatchSyncMeta (standalone per league_code)
FeedItem.match_id → Match.id (nullable, 002 新增列)
```

---

## Team（球队）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | football-data.org 球队 ID（字符串） |
| name | TEXT | NOT NULL | 全名 |
| short_name | TEXT | | 简称 |
| tla | TEXT | | 三字母缩写 |
| crest_url | TEXT | | 队徽 URL |
| league_code | TEXT | NOT NULL | PL / PD / BL1 / SA / FL1 / CL |
| updated_at | TEXT (ISO8601) | NOT NULL | 最后同步时间 |

**索引**: `(league_code)`, `(name COLLATE NOCASE)`

**Consumed By**: 本 feature（002）；[003-football-scout-tactical](../003-football-scout-tactical/spec.md) 消费 Match/Team

---

## Match（比赛）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | football-data.org 比赛 ID |
| league_code | TEXT | NOT NULL | 联赛代码 |
| season | TEXT | | 赛季，如 `2025` |
| matchday | INTEGER | | 轮次 |
| utc_date | TEXT (ISO8601) | NOT NULL | 开球时间 UTC |
| status | TEXT | NOT NULL | `SCHEDULED` / `LIVE` / `FINISHED` / `POSTPONED` / `CANCELLED` |
| home_team_id | TEXT | FK → Team.id, NOT NULL | |
| away_team_id | TEXT | FK → Team.id, NOT NULL | |
| home_score | INTEGER | NULL | 未开赛可为 NULL |
| away_score | INTEGER | NULL | |
| stats_json | TEXT (JSON) | NULL | 控球、射门、射正等；来源 API |
| events_json | TEXT (JSON) | NULL | 进球、红黄牌时间线 |
| data_completeness | TEXT | NOT NULL DEFAULT 'pending' | `complete` / `partial` / `pending` |
| last_synced_at | TEXT (ISO8601) | NOT NULL | |
| created_at | TEXT (ISO8601) | NOT NULL | |
| updated_at | TEXT (ISO8601) | NOT NULL | |

**索引**: `(league_code, utc_date DESC)`, `(status)`, `(home_team_id)`, `(away_team_id)`

**状态转换**:
```text
SCHEDULED → LIVE → FINISHED
SCHEDULED → POSTPONED | CANCELLED
```

**Validation**:
- `FINISHED` 时若 `home_score`/`away_score` 均为 NULL → `data_completeness` 不得为 `complete`
- Stats/Content Agent 读取时：`data_completeness=pending` → 返回「数据同步中」

**Consumed By**: 本 feature（002）

---

## Conversation（Stats 对话）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | |
| user_id | TEXT | FK → User.id, NOT NULL | 用户级隔离 |
| agent_id | TEXT | FK → AgentProfile.id, NOT NULL | MVP-2 固定 `stats` |
| context_type | TEXT | NOT NULL | `match` / `team` / `general` |
| context_id | TEXT | NULL | match_id 或 team_id；general 为 NULL |
| title | TEXT | NOT NULL | 如「曼联 vs 利物浦 · 数据问答」 |
| created_at | TEXT (ISO8601) | NOT NULL | |
| updated_at | TEXT (ISO8601) | NOT NULL | |

**索引**: `(user_id, updated_at DESC)`

**Consumed By**: 本 feature（002）；[003-football-scout-tactical](../003-football-scout-tactical/spec.md) 扩展 agent_id

---

## Message（对话消息）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | |
| conversation_id | TEXT | FK → Conversation.id, NOT NULL | |
| role | TEXT | NOT NULL | `user` / `assistant` |
| content | TEXT | NOT NULL | 自然语言正文 |
| metrics_json | TEXT (JSON) | NULL | assistant 引用的指标 `[{name,value,unit}]` |
| confidence | TEXT | NULL | `high` / `medium` / `low`（仅 assistant） |
| missing_fields_json | TEXT (JSON) | NULL | 缺失数据项列表 |
| created_at | TEXT (ISO8601) | NOT NULL | |

**索引**: `(conversation_id, created_at ASC)`

**Consumed By**: 本 feature（002）

---

## MatchSyncMeta（比赛同步元数据）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| league_code | TEXT | PK | PL / PD / BL1 / SA / FL1 / CL |
| last_sync_at | TEXT (ISO8601) | NULL | |
| last_error | TEXT | NULL | |
| status | TEXT | NOT NULL | `ok` / `degraded` / `down` |
| requests_in_window | INTEGER | DEFAULT 0 | 当前分钟窗口请求计数 |
| window_started_at | TEXT (ISO8601) | NULL | 速率窗口起点 |

**Consumed By**: 本 feature（002）

---

## FeedItem 扩展（002 变更）

在 [001 FeedItem](../001-football-feed-mvp/data-model.md#feeditem社区动态) 基础上：

| 变更 | 说明 |
|------|------|
| `type` 枚举扩展 | 新增 `match_report`、`brief_report` |
| 新增列 `match_id` | TEXT NULL, FK → Match.id |
| 新增列 `body_json` | TEXT (JSON) NULL — 战报正文分节、时间线 |
| 新增列 `data_sources_json` | TEXT (JSON) NULL — Content 引用的 Stats 摘要快照 |
| `event_key` 约定 | `match_report:{matchId}` 去重 |

**agent_id**: Content Agent 发布时固定 `content`

**Consumed By**: 本 feature（002）；Feed 列表/详情 UI 沿用 001

---

## UserPreference 扩展（无 schema 变更）

001 已预留 `notify_match_report`；002 启用：用户偏好 `notify_match_report=1` 且 `followed_teams`/`followed_leagues` 匹配时，战报在 Feed 加权展示（复用 001 `feed-preference-sort.js`）。

---

## SQLite 迁移策略

- `server/src/db/migrations/003_stats_content.sql`
  - CREATE `teams`, `matches`, `conversations`, `messages`, `match_sync_meta`
  - ALTER `feed_items` ADD `match_id`, `body_json`, `data_sources_json`
  - 种子：6 联赛 `match_sync_meta` 行
- `PRAGMA foreign_keys = ON`
- 比赛 upsert 与 `match_sync_meta` 更新同一事务

## 与 001 的边界

| 001 实体 | 002 操作 |
|----------|----------|
| User | 只读引用 |
| AgentProfile | 只读引用（stats/content 已种子） |
| FeedItem | 扩展列 + 新 type，不修改既有 news_summary 语义 |
| UserPreference | 只读 + 排序逻辑扩展，不改表结构 |

若需修改 001 契约（如 FeedItem schema 在 openapi 中扩展），在 **001 tasks.md** 增补「FeedItem 契约扩展」任务，由 001 模块完成 openapi 更新后再在 002 实现。
