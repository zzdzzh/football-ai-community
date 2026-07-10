# Research: Fan Agent 与社区治理

**Date**: 2026-07-10  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## R1: Fan 讨论数据模型（Conversation 复用 vs 独立表）

**Decision**: 新增 `fan_discussions` + `fan_discussion_turns` 独立表，不复用 002 `Conversation`/`Message`。

**Rationale**:
- Spec 明确列出 FanDiscussion、FanDiscussionTurn 为新增实体
- Fan 会话特征：≥2 Persona 交替发言、首轮批量生成 ≥4 条、每条 MUST 标明 persona_id（FR-020）
- 002 Conversation 模型为「单用户 ↔ 单 Agent（agent_id）」多轮问答，语义不匹配
- 前台 URL 为 `/discussions/:discussionId`，与 `/conversations/:conversationId` 分离，避免路由与渲染混淆

**Alternatives considered**:
- **Conversation + agent_id=fan + messages 扩展 persona 字段**：单 agent_id 无法表达多 Persona；Message role 仅有 user/assistant，需 hack 多个 assistant 子类型
- **无状态 POST 一次性生成**：无法满足 FR-021 用户插话后续写
- **WebSocket 实时聊天室**：违反 spec Out of Scope

## R2: Fan Persona 设计与种子数据

**Decision**:
- `fan_personas` 表：每支球队 1 条默认 Persona（12–18 条，覆盖 6 联赛代表球队）
- 字段：`team_id` FK → Team、`display_name`、`style_traits_json`（如「乐观/毒舌/数据派」）、`accent_phrases_json`（口癖示例）、`enabled`
- 种子 migration `007_fan_community.sql` 写入；只读，无 CRUD API（MVP-4）
- API：`GET /fan-personas?league=PL&teamId=` 供前台 PersonaPicker 使用

**Rationale**: FR-019 要求用户选择 ≥2 Persona；FR-020 要求风格差异可验证；种子数据使契约测试可断言 persona 标签。

**Alternatives considered**:
- **用户自定义 Persona**：超出 spec In Scope
- **纯 LLM 即时生成 Persona 名**：风格不可复现，无法 UI 展示球队关联

## R3: Fan Agent 生成流程与 AiFanService

**Decision**:
- 新建 `AiFanService.simulateTurns()`，底层共用 OpenAI 兼容适配器
- Prompt 外置：`server/prompts/fan-discussion.md`
- 输入 JSON：
  ```json
  {
    "topic": "string",
    "personas": [{ "id", "displayName", "teamName", "styleTraits", "accentPhrases" }],
    "context": { "matchSummary?", "feedSnippet?" },
    "history": [{ "role": "persona|user", "personaId?", "content" }],
    "mode": "initial|continue",
    "targetTurnCount": 4
  }
  ```
- 输出 JSON：
  ```json
  {
    "turns": [{ "personaId": "string", "content": "string" }],
    "disclaimer": "模拟内容仅供娱乐，不代表真实球迷或俱乐部立场"
  }
  ```
- `fan-agent.js` 编排：
  1. **创建**：校验 ≥2 persona → `FanContextBuilder` 组装上下文 → `AiFanService` 生成 initial 4+ turns →  moderation → 批量写入 → 发布 FeedItem
  2. **插话**：用户 turn 写入 → moderation → `AiFanService` continue 模式生成 1–2 条 Persona 回应 → moderation → 写入
- 超时：首轮 60s（AgentProfile）；续写 30s

**Rationale**: 对齐 SC-005「60 秒内 ≥4 轮」与 FR-021 插话续写；Constitution IV Prompt 外置 + 语义接口分离。

**Alternatives considered**:
- **每条 turn 单独 AI 调用（4 次）**：延迟叠加易超 60s
- **AiContentService 直接调用**：无法约束多 Persona JSON schema

## R4: 内容安全（生成前过滤 + 举报）

**Decision**: 双层机制

**Layer 1 — 生成前/写入前（FR-022）**:
- `ContentModerationService.check(text)`：
  - 规则层：关键词/正则 blocklist（人身攻击、歧视 slur、虚假「官方宣布」模式）
  - 长度与空内容校验
  - 不通过 → HTTP 422 `content_policy_violation`，**不写入** turn
- 应用于：AI 输出每条 turn、用户插话内容

**Layer 2 — 事后举报（FR-030）**:
- `content_reports` 表：`target_type` ∈ `fan_discussion` | `fan_discussion_turn`
- `POST /content-reports`：登录用户提交，status=`pending`
- `POST /admin/content-reports/{reportId}/hide`：moderator/admin 将目标设为 hidden
  - discussion 级：`fan_discussions.status=hidden` + 关联 FeedItem `visibility=hidden`
  - turn 级：`fan_discussion_turns.is_hidden=1`（讨论仍可见但该条显示「已被隐藏」）
- `POST /admin/content-reports/{reportId}/dismiss`：驳回举报

**Rationale**: Constitution III 标记「社区内容发布、编辑与审核」为高风险 100% 分支路径；spec 要求生成时拒绝 + 用户可举报。

**Alternatives considered**:
- **仅依赖 LLM 自我审查**：不可靠，无法契约测试
- **仅举报无生成前过滤**：违规内容已曝光，违反 FR-022 精神

## R5: Feed 集成与讨论可见性

**Decision**:
- 讨论创建成功后写入 FeedItem：
  - `type=fan_discussion`
  - `agent_id=fan`
  - `event_key=fan_discussion:{discussionId}`（去重）
  - `title` = 讨论主题；`summary` = 前 2 条 turn 摘要
  - `body_json` = `{ discussionId, personaIds[], turnCount }`
- Feed 列表过滤：`visibility='public'` AND `fan_discussions.status='active'`
- 管理员 hide → 同事务更新 FeedItem.visibility=`hidden`

**Rationale**: Spec In Scope 含 FeedItem 扩展；001 Feed 已支持 agent_id=fan 与 visibility 字段。

**Alternatives considered**:
- **讨论不上 Feed**：降低社区互动曝光，不符合愿景「社区活跃度增强层」

## R6: 可选 Match 议题上下文

**Decision**:
- 创建讨论可选 `matchId`；若提供则从 002 `matches` + `teams` 读取比分、球队名、战报 Feed 摘要
- `FanContextBuilder` 注入 `matchSummary` 至 Prompt；无 matchId 时仅使用用户 `topic` 自由文本
- 不修改 002 Match 表或 API

**Rationale**: Spec External Dependencies 引用 002 Match 作为可选议题；Independent Test 示例为「曼联 vs 利物浦赛后」。

## R7: API 端点汇总

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/fan-personas` | user | 列出可选 Persona |
| POST | `/fan-discussions` | user | 创建讨论 + 首轮生成 |
| GET | `/fan-discussions/{id}` | owner 或 public* | 讨论详情含 turns |
| POST | `/fan-discussions/{id}/turns` | owner | 用户插话 + 触发续写 |
| POST | `/content-reports` | user | 提交举报 |
| GET | `/admin/content-reports` | moderator+ | 待审列表 |
| POST | `/admin/content-reports/{id}/hide` | moderator+ | 隐藏内容 |
| POST | `/admin/content-reports/{id}/dismiss` | moderator+ | 驳回举报 |

\*公开可读：status=active 且非 hidden 的讨论允许任意登录用户查看（社区围观）；owner 可查看自己的 hidden 讨论。

## R8: 前台路由与导航

| 路径 | 用途 | 核心 ID |
|------|------|---------|
| `/fan` | 选择主题、≥2 Persona，发起讨论 | — |
| `/discussions/:discussionId` | 讨论详情、插话、举报 | discussionId |
| `/admin/reports` | 管理员审核队列 | reportId（操作上下文） |

**人工 E2E 路径（禁止直达子页绕过）**:
- 首页 Feed → fan_discussion 卡片 → `/discussions/:id` → 插话 → 举报
- 首页 → `/fan` → 创建讨论 → 详情页
- 管理员：登录 moderator → `/admin/relevant` → hide → 验证 Feed 不可见

## R9: SC-005 可延期验证策略

**Decision**: SC-005 标注 `[Deferrable: yes]`（spec 已标注）；Sprint 内 MUST 完成：
- 契约/单元测试 Mock 路径验证 ≥4 turns 结构与 moderation 分支
- 日志记录 `fan_discussion_turn_count` 供后验 95% 合规率统计
- L4 Checkpoint：至少 1 次真实 AI 端到端走查

**Rationale**: 95% 无违规率需生产样本量，不适合作为 Sprint 硬门禁。

## R10: 环境变量

```env
# 可选：Fan 续写轮次超时（毫秒，默认 30000）
# FAN_CONTINUE_TIMEOUT_MS=30000

# 可选：内容过滤 blocklist 文件路径
# CONTENT_MODERATION_BLOCKLIST=./config/content-blocklist.txt
```

## R11: 测试策略

**Decision**:
- `ContentModerationService`：100% 分支（通过、人身攻击、歧视、空内容、官方声明模式）
- `FanAgent`：100% 分支（正常首轮、插话续写、超时、moderation 拒绝、<2 persona）
- `FanContextBuilder`：有/无 matchId、球队名注入
- 契约测试：supertest + 测试库，Mock AI
- 权限：非 owner 不可插话；非 moderator 不可 hide
- 人工 E2E：真实 API Key 至少 1 次（L4）；截图 ≥2 张

**Alternatives considered**:
- **Playwright 前台自动化**：Constitution VIII 明确禁止
