# Feature Specification: Fan Agent 与社区治理

**Feature Branch**: `004-football-fan-community`

**Created**: 2026-07-10

**Status**: Draft

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

**Prerequisites**: [003-football-scout-tactical](../003-football-scout-tactical/spec.md) 或至少 [002-football-stats-content](../002-football-stats-content/spec.md) 已完成（Feed 与比赛议题可供 Fan Agent 引用）

**Input**: MVP-4 — Fan Agent 模拟球迷讨论 + 内容举报与管理员审核（US6）

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 参与 Fan Agent 模拟球迷讨论 (Priority: P3)

作为社区互动用户，我希望发起或围观 Fan Agent 模拟的不同球队球迷之间的讨论，以便感受多元观点并参与话题互动。

**Why this priority**: 互动娱乐属性强，依赖前述 Agent 产出的议题，适合作为社区活跃度的增强层。

**Independent Test**: 用户发起「曼联 vs 利物浦赛后」讨论主题，选择 2 个球队球迷人格，Fan Agent 生成至少 4 轮观点交锋，用户可插入评论。

**Acceptance Scenarios**:

1. **Given** 用户选择讨论主题与 2 个 Fan Persona，**When** 发起模拟讨论，**Then** 系统在 60 秒内生成至少 4 条交替出现的球迷观点，每条标明所属球队人格
2. **Given** 模拟讨论进行中，**When** 用户发表评论，**Then** Fan Agent 在下一轮回应中参考用户观点，且仍保持各 Persona 的语言风格差异
3. **Given** 讨论涉及人身攻击或歧视性内容，**When** Fan Agent 生成或用户输入此类内容，**Then** 系统拒绝发布并提示社区行为规范

---

## Requirements *(mandatory)*

### Functional Requirements

#### Fan Agent

- **FR-019**: Fan Agent MUST 支持用户选择 2 个及以上 Fan Persona 围绕指定主题生成模拟球迷对话
- **FR-020**: Fan Agent MUST 为每条发言标明对应的球队 Persona，并保持风格差异
- **FR-021**: Fan Agent MUST 允许用户在模拟讨论中插入评论，并在后续轮次中参考用户输入
- **FR-022**: Fan Agent MUST NOT 生成人身攻击、歧视、违法或明显虚假的官方声明类内容

#### 社区治理

- **FR-030**: 系统 MUST 提供用户举报 Agent 输出不当内容的入口；管理员 MUST 能隐藏被举报内容

### Key Entities（本 Feature 新增）

- **FanPersona（模拟球迷人格）**
- **FanDiscussion（模拟讨论）**、**FanDiscussionTurn（讨论轮次）**
- **ContentReport（内容举报）**
- **FeedItem** 扩展：`fan_discussion` 类型

## Success Criteria

- **SC-005** [Deferrable: yes]: Fan Agent 模拟讨论 MUST 在 **60 秒内** 完成至少 **4 轮** 观点交锋，且 **95%** 的会话无社区规范违规内容

## 范围边界

### In Scope

- Fan Agent 讨论 API（`/fan-discussions`）
- 讨论详情页（`/discussions/:discussionId`）
- 内容举报 API、管理员隐藏 API
- Fan Persona 种子数据

### Out of Scope

- 用户间私信、实时聊天室
- 付费订阅与计费

## External Dependencies

| Producer Feature | 消费实体/服务 | 用途 | 引用路径 |
|------------------|---------------|------|----------|
| 001-football-feed-mvp | User, FeedItem, Auth, AgentProfile | Feed 发布、认证 | [001 spec](../001-football-feed-mvp/spec.md) |
| 002-football-stats-content | Match（可选议题上下文） | 赛后讨论主题 | [002 spec](../002-football-stats-content/spec.md) |
