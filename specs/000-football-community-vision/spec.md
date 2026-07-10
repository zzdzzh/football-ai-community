# 产品愿景：足球 Multi-Agent 社区

**文档类型**: 总览 / 愿景（非可执行 feature spec）  
**Created**: 2026-07-10  
**Status**: Active

**Input**: 我要做一个足球 Multi-Agent 社区，包含 News / Stats / Scout / Tactical / Fan / Content 六类 Agent。

## 子 Feature 索引

本愿景已按 Constitution 原则 XII 拆分为可独立交付的子 spec：

| Spec ID | 名称 | User Stories | 状态 |
|---------|------|--------------|------|
| [001-football-feed-mvp](../001-football-feed-mvp/spec.md) | 社区首页 + News Agent + 账户与偏好 | US1, US7 | 可执行 |
| [002-football-stats-content](../002-football-stats-content/spec.md) | Stats Agent 对话 + Content Agent 赛后报道 | US2, US3 | 待 plan/tasks |
| [003-football-scout-tactical](../003-football-scout-tactical/spec.md) | Scout + Tactical Agent | US4, US5 | 待 plan/tasks |
| [004-football-fan-community](../004-football-fan-community/spec.md) | Fan Agent 模拟讨论 + 内容举报 | US6 | 待 plan/tasks |

> **执行入口**：Harness / Speckit 默认指向 `001-football-feed-mvp`。完成 MVP-1 后依次对 002→004 跑 specify → plan → tasks → harness.plan。

## 术语定义

| 术语 | 定义 |
|------|------|
| **Agent（智能体）** | 社区内具备单一专业职责的 AI 助手，对用户呈现固定角色与能力边界 |
| **社区动态（Feed Item）** | 由某一 Agent 产出、可在社区时间线中浏览的结构化内容条目 |
| **对话会话（Conversation）** | 用户与单个或多个 Agent 的多轮问答记录 |
| **置信度（Confidence）** | Agent 对其输出可靠程度的分级标注：`高` / `中` / `低` |
| **关注主题（Followed Topic）** | 用户订阅的球队、联赛或球员，用于个性化推送 |
| **模拟球迷人格（Fan Persona）** | Fan Agent 所扮演的特定球队支持者角色及其语言风格 |

## 全局 Edge Cases

- **外部数据源全部不可用**：首页展示最近一次成功抓取内容的缓存，并显示「内容可能不是最新」及最后更新时间；News / Stats / Content Agent 不得伪造实时数据
- **AI 服务超时或不可用**：用户请求在约定等待时间内无响应时，返回友好错误与「稍后重试」入口；已排队任务可异步完成并通知用户
- **重复或高度相似新闻**：News Agent 合并同源转载，动态流中同一事件仅保留一条主摘要，其余折叠为「相关报道」
- **比赛数据延迟**：Stats / Content / Tactical Agent 在数据未就绪时不得猜测比分或事件；显示「数据同步中」状态
- **用户短时间内高频提问**：对同一 Agent 实施合理频率限制，超出后提示稍后再试，避免资源滥用
- **Fan Agent 输出不当言论**：除生成时过滤外，用户可举报；管理员可隐藏相关讨论串
- **历史会话与动态持久化失败**：明确提示保存失败，已展示内容允许用户手动复制，后台记录错误供运维排查
- **未登录用户**：可浏览公开动态与只读内容；与 Agent 多轮对话、设置偏好、参与讨论需登录

## 全局范围边界

### 初始版本包含（In Scope）

- 六类 Agent 的核心能力及社区时间线聚合展示
- 用户注册登录、关注偏好、与 Agent 的单 Agent 对话
- Content Agent 与 Stats Agent 的数据引用协作（赛后报道）
- Fan Agent 双 Persona 模拟讨论及用户插话
- 内容举报与管理员隐藏能力
- 覆盖联赛：**英超、西甲、德甲、意甲、法甲** 及 **欧冠** 当前赛季

### 初始版本不包含（Out of Scope）

- 用户之间的私信或实时聊天室（非 Fan Agent 模拟）
- 付费订阅、虚拟币或 Agent 调用计费
- 用户自行创建或训练自定义 Agent
- 视频集锦播放、直播或赔率/博彩相关功能
- 移动端原生 App（仅保证桌面与移动浏览器可访问）
- 非足球运动项目

### MVP 分期路线图

| 阶段 | 交付能力 | 对应 Spec | User Stories |
|------|----------|-----------|--------------|
| MVP-1 | 社区首页 + News Agent + 账户与偏好 | 001-football-feed-mvp | US1, US7 |
| MVP-2 | Stats Agent 对话 + Content Agent 赛后报道 | 002-football-stats-content | US2, US3 |
| MVP-3 | Scout + Tactical Agent | 003-football-scout-tactical | US4, US5 |
| MVP-4 | Fan Agent 模拟讨论 + 举报/审核 | 004-football-fan-community | US6 |

## 外部依赖（业务层）

| 外部对象 | 业务目的 | 失败影响 |
|----------|----------|----------|
| 足球新闻来源 | News Agent 抓取与摘要 | 新闻动态减少；展示缓存并提示 |
| 比赛与球员统计数据来源 | Stats / Scout / Tactical / Content Agent | 相关 Agent 降级或暂缓响应 |
| AI 推理服务 | 各 Agent 内容生成 | 全部 Agent 对话与生成暂停；展示不可用提示 |

## Assumptions

- 目标用户为中文环境下的足球爱好者，界面与 Agent 默认输出为简体中文
- 新闻与统计数据来自可合法使用的公开来源
- 初始版本支持桌面与移动浏览器；不要求原生 App
- 用户规模预期为中小型社区（日活 1,000 以内）
- 管理员账号由系统初始化配置，不提供公开自助申请管理员
- Fan Agent 模拟内容仅供娱乐讨论，不代表真实球迷或俱乐部立场
- 比赛「结束」判定以统计数据源标记为准，而非用户主观时间

## 拆分说明（2026-07-10）

原 `001-football-multi-agent-community` 含 7 个 User Story、31 个 task，违反 Constitution 原则 XII（US ≤ 3、task ≤ 30）。已按 US 边界拆为 4 个可执行子 spec + 本愿景文档。原目录已废弃，详见 [001-football-multi-agent-community/README.md](../001-football-multi-agent-community/README.md)。
