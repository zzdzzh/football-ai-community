# Data Model: 球员实体对齐

**Date**: 2026-07-17  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Prerequisites**:
- [001-football-feed-mvp/data-model.md](../001-football-feed-mvp/data-model.md)（User / Auth）
- [003-football-scout-tactical/data-model.md](../003-football-scout-tactical/data-model.md)（Stats Player，只读消费）
- [005-player-relationship-analysis/data-model.md](../005-player-relationship-analysis/data-model.md)（CareerPlayer，只读消费）

> 本文件定义 006 **新增**实体。Stats Player / CareerPlayer / User 以对端为准，**不在此重定义字段全集**。  
> 运行时 `players.transfermarkt_id` 已存在（migration 008）；正式文档化与 API 暴露见 003 增补任务。

## 实体关系概览

```text
Stats Player (003) ──1── PlayerIdentityLink ──1── CareerPlayer (005)
                         │
                         └── match_key = Transfermarkt 外部 ID（高置信度）

同一 match_key 多候选 ──*── PlayerIdentityConflict（不自动建链）

AlignRun 1── 汇总 created/conflict/skipped 计数（批处理可观测）
```

---

## PlayerIdentityLink（球员身份映射）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | |
| stats_player_id | TEXT | NOT NULL | 003 `players.id`（软引用，不强制 FK 跨域级联） |
| career_player_id | TEXT | NOT NULL | 005 `career_players.id` |
| match_basis | TEXT | NOT NULL | MVP 固定 `transfermarkt_id` |
| match_key | TEXT | NOT NULL | 对齐所用 TM ID 字符串 |
| confidence | TEXT | NOT NULL | `high` / `medium` / `low`；MVP 自动仅写 `high` |
| status | TEXT | NOT NULL | `active` / `conflict_shelved` / `invalid` |
| created_at | TEXT (ISO8601) | NOT NULL | |
| updated_at | TEXT (ISO8601) | NOT NULL | |

**唯一约束**:
- `(stats_player_id, career_player_id)` 全局唯一
- 部分唯一（应用层强制）：同一 `stats_player_id` 至多一条 `status=active`
- 部分唯一（应用层强制）：同一 `career_player_id` 至多一条 `status=active`

**索引**: `(stats_player_id)`, `(career_player_id)`, `(match_key)`, `(status, confidence)`

**Validation**:
- `confidence=high` MUST 仅来自 TM ID 精确唯一匹配
- 无 `match_key` MUST NOT 插入 active 行
- 冲突检测触发时 MUST NOT 新建 `active`；可将旧链接改为 `conflict_shelved`

**State transitions**:
```text
(无) → active                 # 唯一 TM 匹配成功
active → conflict_shelved     # 随后发现同键多候选
active → invalid              # 任一侧球员删除/不可用（若未来支持）
conflict_shelved → active     # 人工/后续规则解除冲突后重建（MVP 可不实现自动回切）
```

**Consumed By**: 本 feature（006）；关系分析页（005 UI 消费解析 API）；后续 Scout/Feed 可编程解析

---

## PlayerIdentityConflict（对齐冲突记录）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | |
| match_basis | TEXT | NOT NULL | `transfermarkt_id` |
| match_key | TEXT | NOT NULL | 冲突的 TM ID |
| side | TEXT | NOT NULL | `stats` / `career` / `both` |
| candidate_stats_ids_json | TEXT | NOT NULL | JSON 数组，可为 `[]` |
| candidate_career_ids_json | TEXT | NOT NULL | JSON 数组，可为 `[]` |
| detail | TEXT | NULL | 人类可读摘要 |
| detected_at | TEXT (ISO8601) | NOT NULL | |
| resolved_at | TEXT (ISO8601) | NULL | MVP 可空（无手工解决 UI） |

**索引**: `(match_key)`, `(detected_at)`

**Validation**:
- 写入冲突记录时 MUST NOT 同时新建对应 `active` 链接
- 同一 `match_key` 可多次检测；以最新 `detected_at` 供运维查看

**Consumed By**: 本 feature（006，运维/日志）；不对普通用户前台展示明细（MVP）

---

## PlayerIdentityAlignRun（对齐批处理运行摘要）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | |
| trigger | TEXT | NOT NULL | `cron` / `api` / `internal` |
| created_count | INTEGER | NOT NULL DEFAULT 0 | 新建 active 数 |
| conflict_count | INTEGER | NOT NULL DEFAULT 0 | 冲突次数 |
| skipped_count | INTEGER | NOT NULL DEFAULT 0 | 跳过（无 TM ID、failed sync 等） |
| started_at | TEXT (ISO8601) | NOT NULL | |
| finished_at | TEXT (ISO8601) | NULL | |
| notes | TEXT | NULL | 跳过原因汇总摘要 |

**Consumed By**: 本 feature（006，可观测 / SC-004）

---

## 对端实体引用（只读）

### Stats Player（003）

- 主键：`players.id`
- 对齐键列：`players.transfermarkt_id`（可空；实现已存在）
- 详情展示：经 003 `GET /players/{playerId}`（契约见 [003 contracts](../003-football-scout-tactical/contracts/openapi.yaml)）
- **Consumed By**: 006（对齐读取）；006 前台统计入口

### CareerPlayer（005）

- 主键：`career_players.id`（UUID）
- 对齐键：`(external_source, external_id)`，MVP `external_source=transfermarkt`
- `sync_status`：对齐跳过 `failed` 的新链建立，但不破坏已有映射读取
- **Consumed By**: 006（对齐读取）；关系页展示

### User（001）

- 解析与按需对齐 API 鉴权；与关系页一致需登录
- **Consumed By**: 006 API

---

## Migration

- `015_player_identity_links.sql`：CREATE 上述三表及索引
- **禁止**：DROP/MERGE 003/005 球员表；禁止修改其主键列

## 跨模块文档缺口（不在本文件修复）

下列事项须在 **003** 模块 tasks 落地，而非在 006 data-model 内改写 003 正文：

1. 在 003 `data-model.md` 为 Player 文档化 `transfermarkt_id`（及既有外部 ID 列）
2. 在 003 OpenAPI `Player`/`PlayerDetail` 暴露可选 `transfermarktId`（若产品需要客户端可见）
3. 在 `player-repository` 增加 `findPlayersByTransfermarktId` 供对齐与冲突检测复用（可选公共化）
