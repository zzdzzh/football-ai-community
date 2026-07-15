# Data Model: 足球球员关系分析

**Date**: 2026-07-15  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Prerequisites**: [001-football-feed-mvp/data-model.md](../001-football-feed-mvp/data-model.md)（User / Auth）

> 本文件定义 005 **新增**实体。User 以 001 为准。  
> **与 003 边界**：不引用、不扩展 [003 Player](../003-football-scout-tactical/data-model.md)；CareerPlayer 为独立身份空间。

## 实体关系概览

```text
CareerClub 1──* ClubStint *──1 CareerPlayer
CareerPlayer 1──* NationalTeamStint
CareerPlayer (A) + CareerPlayer (B) ──1 PlayerPairAnalysis
PlayerPairAnalysis 内嵌 RelationPath / TransferLink / DirectRelation 结论（JSON 快照）
User 发起分析（鉴权）；分析结果对登录用户只读共享（非按 user_id 隔离内容，按鉴权门槛）
```

---

## CareerPlayer（履历球员）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | 本系统核心 ID（URL 使用） |
| external_source | TEXT | NOT NULL | 固定 `transfermarkt`（MVP） |
| external_id | TEXT | NOT NULL | TM 球员 ID |
| name | TEXT | NOT NULL | 展示名 |
| name_normalized | TEXT | NOT NULL | 小写去重音检索键 |
| date_of_birth | TEXT | NULL | ISO 日期或仅年 |
| nationality | TEXT | NULL | |
| position | TEXT | NULL | 场上位置（源可得时） |
| current_club_id | TEXT | FK → CareerClub.id, NULL | |
| current_club_name | TEXT | NULL | 冗余展示 |
| synced_at | TEXT (ISO8601) | NULL | 最近成功同步时间 |
| sync_status | TEXT | NOT NULL | `ready` / `stale` / `syncing` / `failed` |
| last_sync_error | TEXT | NULL | 对用户可展示的摘要 |
| created_at | TEXT (ISO8601) | NOT NULL | |
| updated_at | TEXT (ISO8601) | NOT NULL | |

**唯一约束**: `(external_source, external_id)`  
**索引**: `(name_normalized)`, `(synced_at)`

**Validation**:
- 搜索消歧候选 MUST 含可区分线索：`date_of_birth` 或与主俱乐部相关字段（至少一个）
- sync 失败 MUST NOT 用虚构字段填充必填业务结论

**Consumed By**: 本 feature（005）

---

## CareerClub（履历俱乐部）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | |
| external_source | TEXT | NOT NULL | `transfermarkt` |
| external_id | TEXT | NOT NULL | TM 俱乐部 ID（若页面仅有名则可合成稳定 hash） |
| name | TEXT | NOT NULL | |
| name_normalized | TEXT | NOT NULL | |
| created_at | TEXT (ISO8601) | NOT NULL | |
| updated_at | TEXT (ISO8601) | NOT NULL | |

**唯一约束**: `(external_source, external_id)`  
**Consumed By**: 本 feature（005）

---

## ClubStint（俱乐部效力段）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | |
| player_id | TEXT | FK → CareerPlayer.id, NOT NULL | |
| club_id | TEXT | FK → CareerClub.id, NOT NULL | |
| joined_raw | TEXT | NULL | 源原文 |
| left_raw | TEXT | NULL | 源原文 |
| joined_on | TEXT | NULL | 归一后 ISO 日期 |
| left_on | TEXT | NULL | 归一后 ISO 日期；open_ended 时为分析日或 NULL+flag |
| time_precision | TEXT | NOT NULL | `exact` / `month` / `year` / `season` / `open_ended` / `unparseable` |
| transfer_type | TEXT | NULL | 转会/租借等 |
| transfer_fee | TEXT | NULL | 原文或规范化字符串 |
| sort_order | INTEGER | NOT NULL | 页内顺序 |
| created_at | TEXT (ISO8601) | NOT NULL | |
| updated_at | TEXT (ISO8601) | NOT NULL | |

**索引**: `(player_id)`, `(club_id)`, `(club_id, player_id)`

**Validation**:
- `time_precision=unparseable` 的段不参与「成立」交集判定
- 同步时按 player 级替换策略：事务内删旧插新，保证一致性

**Consumed By**: 本 feature（005）

---

## NationalTeamStint（国家队效力段）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | |
| player_id | TEXT | FK → CareerPlayer.id, NOT NULL | |
| nation_key | TEXT | NOT NULL | 规范化国家队键（如 `argentina`） |
| nation_name | TEXT | NOT NULL | 展示名 |
| joined_raw / left_raw | TEXT | NULL | |
| joined_on / left_on | TEXT | NULL | |
| time_precision | TEXT | NOT NULL | 同 ClubStint |
| created_at / updated_at | TEXT (ISO8601) | NOT NULL | |

**索引**: `(player_id)`, `(nation_key)`

**Validation**: 任一方缺失该类型国家队效力段时，国家队关系结论 MUST 为 `unknown`（不得判 `not_established`）；双方均无国家队段时同为 `unknown`

**Consumed By**: 本 feature（005）

---

## PlayerPairAnalysis（球员对分析快照）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT (UUID) | PK | |
| player_id_low | TEXT | FK → CareerPlayer.id, NOT NULL | 字典序较小 |
| player_id_high | TEXT | FK → CareerPlayer.id, NOT NULL | 字典序较大 |
| result_json | TEXT (JSON) | NOT NULL | 完整结论快照（见下） |
| data_freshness_json | TEXT (JSON) | NOT NULL | 双方 synced_at 与滞后说明 |
| max_hops | INTEGER | NOT NULL | 计算时使用的上限 |
| computed_at | TEXT (ISO8601) | NOT NULL | |
| created_at | TEXT (ISO8601) | NOT NULL | |
| updated_at | TEXT (ISO8601) | NOT NULL | |

**唯一约束**: `(player_id_low, player_id_high)`  
**索引**: `(computed_at DESC)`

### result_json 结构（逻辑模型）

```text
{
  clubmates: DirectRelationVerdict,      # established | not_established | unknown
  nationalTeammates: DirectRelationVerdict,
  clubmateDetails: [{ clubId, clubName, overlapFrom, overlapTo, precision }],
  nationalTeammateDetails: [...],
  transfer: TransferLink,
  indirectPath: RelationPath | null,     # null + pathStatus
  pathStatus: found | no_path | skipped,
  relationDistance: number | null,
  selfPair: boolean                      # true 时短路无效
}
```

**DirectRelationVerdict**: `{ status, reason? }`  
**TransferLink**: `{ directTransferLink: boolean, successiveSameClub: boolean, evidence: string[] }`  
**RelationPath**: `{ distance, nodes: [{ type: player|club, id, name }], edges: [{ from, to }] }`

**Validation**:
- `player_id_low !== player_id_high`；相同 ID → 业务 400，不写建立结论
- 禁止在无 stint 证据时写入 `established` 或非空伪造 path nodes

**Consumed By**: 本 feature（005）

---

## 状态与同步

### CareerPlayer.sync_status

```text
ready ──(TTL 过期)──► stale
ready / stale ──(开始同步)──► syncing ──(成功)──► ready
                               syncing ──(失败)──► failed
failed ──(重试成功)──► ready
```

### 分析页加载语义

- 任一侧 `syncing`：API 可返回 `202` 或响应体 `status=computing`（契约二选一，见 OpenAPI：采用 **200 + `status` 字段** 简化前台轮询）
- 两侧 `ready`/`stale` 且允许缓存：直接返回快照；`stale` 时 freshness 提示更醒目

---

## 与 001 / 003 的消费关系

| 实体 | Owning Feature | Consumed By |
|------|----------------|-------------|
| User / JWT 会话 | 001 | 005（鉴权，只读复用） |
| Player（football-data） | 003 | **本 MVP 不消费** |
| CareerPlayer 等 | 005 | 005 |

若未来需要统一球员身份，MUST 在 003 的 `tasks.md` 增补映射任务后再改对端，禁止在 005 内修改 003 契约。
