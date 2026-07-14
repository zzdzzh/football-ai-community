# Data Model: Scout Agent 与 Tactical Agent

**Date**: 2026-07-10  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Prerequisites**: [002-football-stats-content/data-model.md](../002-football-stats-content/data-model.md)

> 本文件定义 MVP-3 **新增/扩展**实体。User、AgentProfile、Team、Match、Conversation（基础字段）、Message（基础字段）定义以 001/002 为准，此处仅描述扩展与新增。

## 实体关系概览

```text
Team 1──* Player
Player 1──* PlayerStatsSnapshot (per league_code + season)

User 1──* Conversation (agent_id = scout | tactical)
Conversation 1──* Message
Message 1──0..1 MessageFeedback (per user)

Match *──0..1 Conversation (tactical, context_type=match)
Team *──0..1 Conversation (scout context_type=team | tactical context_type=team)
```

---

## Player（球员）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | football-data.org 球员 ID |
| name | TEXT | NOT NULL | 姓名 |
| team_id | TEXT | FK → Team.id, NOT NULL | 当前所属球队 |
| position | TEXT | | 如 Goalkeeper / Centre-Back / Central Midfield / Left Winger |
| date_of_birth | TEXT (date) | NULL | 用于年龄过滤 |
| nationality | TEXT | NULL | |
| league_code | TEXT | NOT NULL | 球员所属球队当前联赛 |
| updated_at | TEXT (ISO8601) | NOT NULL | 最后同步时间 |

**索引**: `(team_id)`, `(league_code, position)`, `(name COLLATE NOCASE)`

**Validation**:
- Scout 推荐时 MUST 仅返回 `players` 表中存在的记录
- 年龄计算：`floor((today - date_of_birth) / 365.25)`

**Consumed By**: 本 feature（003）

---

## PlayerStatsSnapshot（球员统计快照）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | |
| player_id | TEXT | FK → Player.id, NOT NULL | |
| league_code | TEXT | NOT NULL | |
| season | TEXT | NOT NULL | 如 `2025` |
| goals | INTEGER | DEFAULT 0 | 来自 scorers API |
| assists | INTEGER | DEFAULT 0 | |
| penalties | INTEGER | DEFAULT 0 | |
| appearances | INTEGER | NULL | 若 API 提供 |
| minutes | INTEGER | NULL | FBref 出场分钟 |
| xg / xa | REAL | NULL | FBref 期望进球/助攻（若数据源提供） |
| rating | REAL | NULL | Sofascore 评分 |
| extra_stats_json | TEXT (JSON) | NULL | 扩展指标：首发/射门/射正/拦截/抢断/扑救/零封等 |
| synced_at | TEXT (ISO8601) | NOT NULL | |

**唯一约束**: `(player_id, league_code, season)`

**索引**: `(league_code, season, goals DESC)`

**Consumed By**: 本 feature（003）；Scout `keyStats` 主要来源

---

## PlayerSyncMeta（球员同步元数据）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| league_code | TEXT | PK | PL / PD / BL1 / SA / FL1 / CL / WC |
| last_sync_at | TEXT (ISO8601) | NULL | |
| last_error | TEXT | NULL | |
| status | TEXT | NOT NULL | `ok` / `degraded` / `down` |
| players_count | INTEGER | DEFAULT 0 | 上次同步球员数 |

**Consumed By**: 本 feature（003）

---

## Conversation 扩展（003 变更）

在 [002 Conversation](../002-football-stats-content/data-model.md#conversationstats-对话) 基础上：

| 变更 | 说明 |
|------|------|
| `agent_id` 枚举扩展 | 新增 `scout`、`tactical`（002 仅 `stats`） |
| `context_type` 扩展 | Scout：`general` / `league` / `team`；Tactical：`match` / `team` |
| `context_id` | league 时为联赛代码；team/match 时为对应 ID；general 为 NULL |

**标题约定**:
- Scout + league：`英超 · 球员推荐`
- Scout + team：`{球队名} · 球员推荐`
- Tactical + match：`{主队} vs {客队} · 战术分析`

**Consumed By**: 本 feature（003）

---

## Message 扩展（003 变更）

在 [002 Message](../002-football-stats-content/data-model.md#message对话消息) 基础上：

| 变更 | 说明 |
|------|------|
| 新增列 `recommendations_json` | TEXT (JSON) NULL — Scout assistant 消息的球员推荐列表 |
| 新增列 `tactical_json` | TEXT (JSON) NULL — Tactical assistant 消息的战术结构化分析 |

**recommendations_json 结构**:
```json
[{
  "playerId": "string",
  "playerName": "string",
  "teamName": "string",
  "position": "string",
  "statsSeason": "string|null",
  "statsSeasonLabel": "string|null",
  "matchReason": "string",
  "keyStats": [{ "name": "string", "value": "number|string", "unit": "string?" }]
}]
```

**tactical_json 结构**:
```json
{
  "analysisType": "post_match | pre_match_prediction",
  "formation": "string",
  "phases": [{
    "key": "build_up | pressing | transition | set_piece",
    "label": "string",
    "summary": "string",
    "keyPlayerNames": ["string"]
  }],
  "keyPlayers": [{ "name": "string", "role": "string" }],
  "dataLimitations": ["string"]
}
```

**既有字段复用**:
- `confidence`：Scout/Tactical assistant 消息均使用
- `metrics_json`：Scout 可选填汇总指标（如候选池大小）；Tactical 可选填引用统计项

**Consumed By**: 本 feature（003）

---

## MessageFeedback（消息反馈）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | |
| user_id | TEXT | FK → User.id, NOT NULL | |
| message_id | TEXT | FK → Message.id, NOT NULL | |
| helpful | INTEGER | NOT NULL | 1=有帮助，0=无帮助 |
| created_at | TEXT (ISO8601) | NOT NULL | |

**唯一约束**: `(user_id, message_id)`

**Validation**:
- 仅能对 `role=assistant` 的消息反馈
- 关联 Conversation 的 `agent_id` 须为 `scout` 或 `tactical`

**Consumed By**: 本 feature（003）；指标 SC-004

---

## SQLite 迁移策略

- `server/src/db/migrations/006_scout_tactical.sql`
  - CREATE `players`, `player_stats_snapshots`, `player_sync_meta`, `message_feedback`
  - ALTER `messages` ADD `recommendations_json`, `tactical_json`
  - 种子：白名单联赛 `player_sync_meta` 行
- `PRAGMA foreign_keys = ON`
- player upsert 与 `player_sync_meta` 更新同一事务

## 与 002 的边界

| 002 实体 | 003 操作 |
|----------|----------|
| Team | 只读引用；player-sync 依赖 team 表已有数据 |
| Match | 只读引用；Tactical 上下文构建 |
| Conversation | 扩展 agent_id / context_type 语义，不删改 002 列 |
| Message | ADD 列，不修改既有列语义 |
| MatchSyncMeta | 只读引用，不合并到 player_sync_meta |

若需修改 002 契约（如在 002 openapi 中扩展 Conversation agentId 枚举），须在 **002 tasks.md** 增补任务，由 002 模块完成后再在 003 实现。本 plan 采用 **003 独立契约描述增量** 策略，避免回改 002 契约文件。

## 与 001 的边界

| 001 实体 | 003 操作 |
|----------|----------|
| User | 只读引用 |
| AgentProfile | 只读引用（scout/tactical 已种子） |
