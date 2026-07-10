# Feature Specification: Stats Agent 与 Content Agent

**Feature Branch**: `002-football-stats-content`

**Created**: 2026-07-10

**Status**: Draft

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

**Prerequisites**: [001-football-feed-mvp](../001-football-feed-mvp/spec.md) 已完成（认证、Feed、News Agent、偏好）

**Input**: MVP-2 — Stats Agent 比赛数据对话 + Content Agent 赛后报道（US2、US3）

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 向 Stats Agent 查询比赛数据 (Priority: P1)

作为数据导向的球迷，我希望向 Stats Agent 提问某场比赛或某支球队的关键数据，以便获得易读的数据解读而非原始数字表格。

**Why this priority**: 比赛数据分析是社区的核心差异化能力，与新闻形成「资讯 + 深度」双支柱，且可独立于其他 Agent 验收。

**Independent Test**: 用户选择一场比赛或输入球队名称，向 Stats Agent 发起提问，在 30 秒内收到包含关键指标与自然语言解读的回复。

**Acceptance Scenarios**:

1. **Given** 用户已登录且指定一场已结束的比赛，**When** 用户询问「这场比赛控球与射门表现如何」，**Then** Stats Agent 返回控球率、射门次数、射正次数及对比解读，并标注置信度
2. **Given** 用户询问尚未开赛的比赛，**When** Stats Agent 处理请求，**Then** 返回赛前可获得的预测性数据或历史交锋数据，并明确标注「赛前数据，结果未产生」
3. **Given** 用户输入无法识别的球队或比赛，**When** 提交问题，**Then** 系统提示「未找到匹配项」并给出可选的相似球队或近期比赛列表

---

### User Story 2 - 阅读 Content Agent 赛后报道 (Priority: P2)

作为赛后追更的用户，我希望在比赛结束后自动看到 Content Agent 生成的赛后报道，以便快速回顾比赛进程、关键事件与结果影响。

**Why this priority**: 赛后报道依赖 Stats Agent 的数据与 News Agent 的背景信息，是 Multi-Agent 协作的首个完整链路，但可在 P1 能力就绪后增量交付。

**Independent Test**: 指定一场已结束比赛，用户在比赛结束 15 分钟内可在社区中看到一篇包含比分、关键事件时间线、球员表现点评的赛后报道。

**Acceptance Scenarios**:

1. **Given** 一场比赛已结束且基础统计数据可用，**When** 用户进入该比赛专题页，**Then** 用户看到 Content Agent 生成的报道，包含标题、导语、分节正文与关键事件时间线
2. **Given** 报道已生成，**When** 用户阅读报道，**Then** 每条关键事实（比分、进球者、红黄牌）均可追溯到 Stats Agent 提供的数据摘要
3. **Given** 比赛数据不完整，**When** Content Agent 无法生成完整报道，**Then** 发布「简要战报」并标注缺失的数据项，而非发布含虚构细节的报道

---

### Edge Cases

- **比赛数据延迟**：Stats / Content Agent 在数据未就绪时不得猜测比分或事件；显示「数据同步中」状态
- **football-data.org 限流**：免费层 10 req/min，通过缓存与增量同步降级
- **AI 超时**：Stats 对话 30s 上限；Content 生成失败时不得发布虚构战报

## Requirements *(mandatory)*

### Functional Requirements

#### Stats Agent

- **FR-009**: Stats Agent MUST 支持用户按比赛、球队、球员维度查询公开比赛统计数据
- **FR-010**: Stats Agent MUST 以自然语言解读返回数据，并列出所依据的关键指标名称与数值
- **FR-011**: Stats Agent MUST 对每条解读标注置信度；数据不完整时 MUST 说明缺失项
- **FR-012**: Stats Agent MUST NOT 在缺少数据时编造比分、进球者或统计数值

#### Content Agent

- **FR-023**: Content Agent MUST 在比赛结束后自动生成该场比赛的赛后报道并发布至社区
- **FR-024**: Content Agent 生成的报道 MUST 包含比分、关键事件时间线与至少一段对比赛走势的文字评述
- **FR-025**: Content Agent MUST 在数据不足时发布简要战报并标注缺失信息，MUST NOT 填充虚构细节

#### Multi-Agent 协作

- **FR-026**: 系统 MUST 支持用户向 Stats Agent 发起对话；Content Agent 生成报道时 MUST 能引用 Stats Agent 的数据摘要

### Key Entities（本 Feature 新增/扩展）

- **Team（球队）**、**Match（比赛）**、**Conversation（对话）**、**Message（消息）**
- **FeedItem** 扩展：`match_report` / `brief_report` 类型

> 数据模型详见本 spec 的 `data-model.md`（plan 阶段生成）；须引用 [001-football-feed-mvp/data-model.md](../001-football-feed-mvp/data-model.md) 中已有实体。

## Success Criteria

- **SC-002** [Deferrable: no]: 注册用户向 Stats Agent 提交比赛数据问题后，**90%** 的请求 MUST 在 **30 秒内** 收到含至少 **3 项** 数据指标的完整回复
- **SC-003** [Deferrable: no]: 比赛结束后 **15 分钟内**，**80%** 的已覆盖联赛比赛 MUST 自动生成 Content Agent 赛后报道并可被用户打开阅读

## 范围边界

### In Scope

- football-data.org 适配器、比赛/球队同步定时任务
- Stats Agent 对话 API 与前台会话页（`/conversations/:conversationId`）
- Content Agent 赛后报道生成、比赛专题页（`/matches/:matchId`）
- 联赛白名单：英超、西甲、德甲、意甲、法甲、欧冠

### Out of Scope

- Scout / Tactical / Fan Agent → [003](../003-football-scout-tactical/spec.md)、[004](../004-football-fan-community/spec.md)
- 内容举报与管理员审核 → [004](../004-football-fan-community/spec.md)

## External Dependencies

| Producer Feature | 消费实体/服务 | 用途 | 引用路径 |
|------------------|---------------|------|----------|
| 001-football-feed-mvp | User, AgentProfile, FeedItem, Auth API | 认证、Feed 发布、Agent 配置 | [data-model.md](../001-football-feed-mvp/data-model.md)、[contracts/](../001-football-feed-mvp/contracts/) |

**外部服务**: football-data.org v4 API、OpenAI 兼容 AI 推理服务。
