# Feature Specification: Scout Agent 与 Tactical Agent

**Feature Branch**: `003-football-scout-tactical`

**Created**: 2026-07-10

**Status**: Draft

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

**Prerequisites**: [002-football-stats-content](../002-football-stats-content/spec.md) 已完成（比赛数据、Stats 对话基础设施）

**Input**: MVP-3 — Scout Agent 球员推荐 + Tactical Agent 战术分析（US4、US5）

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 使用 Scout Agent 获取球员推荐 (Priority: P2)

作为关注转会与阵容的球迷，我希望向 Scout Agent 描述需求（如位置、预算区间、风格），获得符合条件的球员推荐及理由，以便辅助讨论与决策。

**Why this priority**: 球员推荐是独立高价值场景，不阻塞 P1 闭环，但与 Stats Agent 数据可形成协同增强。

**Independent Test**: 用户输入「需要一名擅长压迫的中场，25 岁以下」，在 30 秒内收到至少 3 名球员推荐，每名含推荐理由与关键数据摘要。

**Acceptance Scenarios**:

1. **Given** 用户提交含位置与年龄条件的推荐请求，**When** Scout Agent 完成分析，**Then** 返回至少 3 名球员，每名包含姓名、所属球队、匹配理由与 3 项关键数据
2. **Given** 用户指定某联赛范围，**When** 提交请求，**Then** 推荐结果仅包含该联赛内球员
3. **Given** 条件过于宽泛导致结果过多，**When** Scout Agent 回复，**Then** 先给出排名前 5 的推荐并提示用户可补充条件以缩小范围

---

### User Story 2 - 向 Tactical Agent 请求战术分析 (Priority: P3)

作为战术爱好者，我希望针对某场比赛或某支球队提交战术问题，获得阵型、压迫线路、进攻组织等方面的结构化分析。

**Why this priority**: 战术分析受众更垂直，依赖 Stats 与比赛上下文，适合在核心数据与内容能力稳定后交付。

**Independent Test**: 用户选择一场已结束比赛并询问「主队是如何组织高位压迫的」，收到含阵型示意描述、阶段划分与关键球员作用的战术分析。

**Acceptance Scenarios**:

1. **Given** 用户选定已结束比赛并提交战术问题，**When** Tactical Agent 回复，**Then** 分析包含阵型、主要战术阶段（如出球、压迫、转换）及各阶段 1–2 句说明
2. **Given** 用户询问未来比赛战术，**When** Tactical Agent 处理，**Then** 明确标注为「基于历史数据的赛前战术预判」，不得表述为已发生的场上事实
3. **Given** 比赛视频或事件级数据不可用，**When** 用户请求细粒度战术解读，**Then** Agent 说明数据限制并给出基于公开统计的宏观战术判断，置信度标注为「低」或「中」

---

## Requirements *(mandatory)*

### Functional Requirements

#### Scout Agent

- **FR-013**: Scout Agent MUST 根据用户描述的条件返回球员推荐列表
- **FR-014**: Scout Agent MUST 为每名推荐球员提供至少 3 项可验证的数据依据与文字理由
- **FR-015**: Scout Agent MUST 支持用户指定联赛或球队范围以过滤推荐结果

#### Tactical Agent

- **FR-016**: Tactical Agent MUST 支持针对已结束比赛的战术提问，并返回含阵型与阶段划分的结构化分析
- **FR-017**: Tactical Agent MUST 区分「已发生比赛的复盘分析」与「赛前战术预判」，并在输出中明确标注
- **FR-018**: Tactical Agent MUST NOT 在缺乏事件级数据时声称具体的场上跑位或传球线路等不可验证细节

### Key Entities（本 Feature 新增）

- **Player（球员）**: 含姓名、球队、位置、基础统计快照

## Success Criteria

- **SC-004** [Deferrable: yes]: Scout Agent 推荐请求中，**85%** 的用户在单次会话内获得满意推荐（通过「有帮助/无帮助」反馈统计）

## External Dependencies

| Producer Feature | 消费实体/服务 | 用途 | 引用路径 |
|------------------|---------------|------|----------|
| 002-football-stats-content | Match, Team, Conversation, Message | 比赛上下文、对话基础设施 | [002 spec](../002-football-stats-content/spec.md) |
| 001-football-feed-mvp | User, AgentProfile, Auth | 认证与 Agent 配置 | [001 spec](../001-football-feed-mvp/spec.md) |
