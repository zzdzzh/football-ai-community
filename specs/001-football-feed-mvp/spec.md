# Feature Specification: 足球社区 Feed MVP

**Feature Branch**: `001-football-feed-mvp`

**Created**: 2026-07-10

**Status**: Draft

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

**Input**: MVP-1 — 社区首页 + News Agent 新闻摘要 + 用户账户与个性化偏好（US1、US7）

## 澄清记录

当前不存在待澄清问题。全局术语与 Edge Cases 见 [愿景文档](../000-football-community-vision/spec.md)。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 浏览新闻摘要动态 (Priority: P1)

作为足球爱好者，我希望在社区首页看到由 News Agent 自动抓取并总结的最新足球新闻，以便快速了解赛场内外重要事件，而不必逐个打开新闻网站。

**Why this priority**: 新闻是社区最高频、最低门槛的内容入口，能独立形成「打开社区即有内容」的 MVP 闭环。

**Independent Test**: 在无其他 Agent 启用的情况下，用户打开社区首页即可看到按时间排序的新闻摘要列表，每条含标题、摘要、来源与时间，并可展开查看详情。

**Acceptance Scenarios**:

1. **Given** 系统已配置 News Agent 且外部新闻源可用，**When** 用户打开社区首页，**Then** 用户在 5 秒内看到至少 5 条最近 24 小时内的新闻摘要动态
2. **Given** 用户点击某条新闻摘要，**When** 详情页加载完成，**Then** 用户看到完整摘要、原文链接、发布时间与 News Agent 标注的「关键信息点」列表
3. **Given** 某新闻源暂时不可用，**When** 用户刷新首页，**Then** 仍展示来自其他可用源的内容，并在页面顶部提示「部分新闻源暂不可用」

---

### User Story 2 - 管理个人关注与 Agent 偏好 (Priority: P2)

作为注册用户，我希望设置关注的球队、联赛，并选择优先展示的 Agent 内容类型，以便社区动态符合个人兴趣。

**Why this priority**: 个性化是留存关键，实现成本低且增强所有 Agent 输出的相关性，应在核心内容可用后尽早提供。

**Independent Test**: 用户设置关注「英超 / 阿森纳」后，首页动态优先展示相关新闻、报道与可参与的讨论话题。

**Acceptance Scenarios**:

1. **Given** 用户已登录并在偏好页添加关注的球队，**When** 返回首页，**Then** 动态流中来自关注球队的内容占比不低于 60%（在有足够内容的前提下）
2. **Given** 用户关闭某一 Agent 类型的推送，**When** 刷新首页，**Then** 该类型 Agent 产出的新动态不再出现在默认流中
3. **Given** 用户未设置任何关注，**When** 打开首页，**Then** 展示全站热门动态并引导用户完成首次偏好设置

---

### Edge Cases（本 Feature 范围）

- **外部新闻源全部不可用**：首页展示最近一次成功抓取内容的缓存，并显示「内容可能不是最新」及最后更新时间；News Agent 不得伪造实时数据
- **AI 服务超时或不可用**：News 摘要生成失败时保留原文标题，标注「摘要生成失败」；用户请求在约定等待时间内无响应时返回友好错误
- **重复或高度相似新闻**：News Agent 合并同源转载，动态流中同一事件仅保留一条主摘要，其余折叠为「相关报道」
- **未登录用户**：可浏览公开 Feed；设置偏好、注册登录需认证

## Requirements *(mandatory)*

### Functional Requirements

#### 社区与账户

- **FR-001**: 系统 MUST 提供社区首页，以时间线形式聚合各 Agent 产出的公开动态
- **FR-002**: 系统 MUST 支持用户注册、登录与会话保持；未登录用户 MUST 仅能访问公开只读内容
- **FR-003**: 系统 MUST 允许注册用户设置关注的球队、联赛及优先展示的 Agent 内容类型
- **FR-004**: 系统 MUST 在动态与 Agent 回复中明确标注产出 Agent 名称与生成时间

#### News Agent

- **FR-005**: News Agent MUST 定期从配置的足球新闻来源抓取内容并生成中文摘要
- **FR-006**: News Agent MUST 为每条摘要提供标题、摘要正文、原文链接、来源名称与发布时间
- **FR-007**: News Agent MUST 识别并合并描述同一事件的重复报道，避免动态流信息冗余
- **FR-008**: News Agent MUST NOT 改写事实性信息（比分、转会官宣等）；摘要 MUST 与原文事实一致

#### AI 治理（本 Feature）

- **FR-027**: News Agent MUST 在约定时间内完成摘要；超时 MUST 向运营日志记录并降级处理
- **FR-028**: News Agent MUST 在无法完成请求时返回降级说明，MUST NOT 返回空白或误导性成功状态
- **FR-029**: 系统 MUST 记录每次 Agent 交互的发起用户、Agent 类型、完成状态与耗时，供运营与质量追溯

### Key Entities（本 Feature 实现）

- **用户（User）**: 社区成员；属性含账号标识、昵称、登录状态、角色
- **Agent 配置（Agent Profile）**: 各 Agent 的展示名称、职责描述、启用状态与响应超时阈值（MVP-1 只读）
- **社区动态（Feed Item）**: 时间线条目；关联产出 Agent、标题、摘要、发布时间、可见性
- **用户偏好（User Preference）**: 用户关注的球队/联赛列表、启用的 Agent 类型
- **新闻抓取元数据（News Cache Meta）**: 各新闻源最后抓取状态，驱动「部分新闻源暂不可用」提示
- **Agent 交互日志（Agent Interaction Log）**: 运营追溯用

> 比赛、对话、球员等实体在 [002-football-stats-content](../002-football-stats-content/spec.md) 及后续 spec 中定义。

## AI 能力边界与失败处理

### News Agent 职责边界

| 应该做 | 不得做 |
|--------|--------|
| 抓取、去重、摘要、标注来源 | 捏造新闻、篡改事实性数据 |

### 超时、失败与低质量输出

- News 摘要单次 AI 调用等待上限为 **30 秒**；超时 MUST 记录日志并保留未摘要条目或展示降级态
- AI 服务不可用时，MUST 展示「服务暂不可用」；已抓取原文可展示标题与链接
- News Agent 的输出 MUST 基于已抓取的新闻原文

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** [Deferrable: no]: 首次访问用户 MUST 能在 **30 秒内** 在社区首页看到至少 **5 条** News Agent 摘要动态
- **SC-006** [Deferrable: no]: Agent 服务不可用或超时场景下，**100%** MUST 向用户展示明确错误说明或降级态，MUST NOT 展示空白成功态
- **SC-007** [Deferrable: yes]: 设置关注球队的用户，在 7 日留存率上 MUST 比未设置关注的用户高出 **20%**（以注册后第 7 日仍活跃为准）

## 范围边界

### In Scope（MVP-1）

- 前后端脚手架、认证、Feed API、News Agent 定时抓取与摘要
- 用户注册登录、偏好设置、Feed 个性化排序与 Agent 过滤
- AgentProfile 种子数据（6 Agent 只读展示，仅 News 产出内容）

### Out of Scope（留给后续 Spec）

- Stats / Scout / Tactical / Fan / Content Agent 对话与生成 → 002–004
- 比赛数据同步、赛后报道、模拟讨论、内容举报 → 002–004
- football-data.org 集成（MVP-1 quickstart 可预留 env，但不实现）

### 依赖

| Producer Feature | 消费实体/服务 | 用途 | 引用路径 |
|------------------|---------------|------|----------|
| 000-football-community-vision | 术语、全局 Edge Cases | 愿景对齐 | [spec.md](../000-football-community-vision/spec.md) |
| 无其他 spec 阻塞 | — | 本 spec 为首个可执行 feature | — |

**外部服务**: 足球新闻 RSS、OpenAI 兼容 AI 推理服务。
