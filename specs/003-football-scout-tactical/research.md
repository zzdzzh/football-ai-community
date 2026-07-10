# Research: Scout Agent 与 Tactical Agent

**Date**: 2026-07-10  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## R1: 球员数据来源（football-data.org v4）

**Decision**: 扩展 `FootballDataAdapter`，新增：
- `GET /teams/{id}` — 获取球队阵容（squad：id、name、position、dateOfBirth、nationality）
- `GET /competitions/{code}/scorers` — 获取联赛射手榜（goals、assists、penalties）

球员基础信息写入 `players` 表；射手榜写入 `player_stats_snapshots`（按 `league_code` + `season` 快照）。

**Rationale**:
- football-data.org 免费层覆盖 spec 要求的 6+1 联赛
- 无独立「全联赛球员统计」端点；squad + scorers 组合可满足 FR-014「至少 3 项可验证数据依据」
- 与 002 共用同一 adapter 与速率限制器，避免重复封装

**Alternatives considered**:
- **API-Football 球员统计**：字段更丰富但引入新依赖且与项目既定数据源不一致
- **纯 LLM 知识库推荐**：无法提供可验证数据依据，违反 FR-014
- **每次对话实时拉 squad**：8 req/min 下无法满足 30s 响应且易限流

## R2: 球员同步策略

**Decision**:
- 新增 `player-sync` Job：
  - 每日 cron `0 4 * * *`（凌晨低峰）全量刷新白名单联赛所有球队 squad
  - `match-sync` 完成后可选触发「当日涉及球队」squad 增量补拉
- 射手榜：每日 1 次 per league（与 squad 同 Job 批次，共享速率窗口）
- `player_sync_meta` 表记录每联赛上次同步时间与错误状态（模式同 `match_sync_meta`）

**Rationale**: 首次 Scout 请求时本地已有候选池；满足 SC 独立测试「30 秒内返回」。

**Alternatives considered**:
- **与 match-sync 完全合并**：比赛同步频率（5–30 min）对 squad 过于频繁，浪费配额
- **懒加载单球员**：无法支撑「推荐至少 3 名球员」的批量筛选

## R3: Scout Agent 对话与推荐模型

**Decision**:
- 复用 `Conversation`：`agent_id=scout`
- `context_type`：`general`（无预设范围）/ `league`（context_id=联赛代码）/ `team`（context_id=team_id）
- 流程：
  1. `ScoutContextBuilder` 从 SQLite 按 context 过滤候选球员（≤50 人）
  2. 解析用户消息中的位置、年龄、风格关键词（规则 + 传给 AI）
  3. `AiScoutService.recommend()` 返回 `{ recommendations[], summary, narrowHint? }`
  4. 候选过多时返回 top 5 + `narrowHint`（对应 acceptance scenario 3）
- 每条推荐含：`playerId, name, teamName, position, matchReason, keyStats[≥3]`
- 超时：30s（AgentProfile `scout.timeout_ms=30000`）

**Rationale**: 与 002 Stats 对话基础设施一致；URL `/conversations/:conversationId` 满足 Constitution I 重入要求。

**Alternatives considered**:
- **无状态 POST `/scout/recommend`**：无法多轮追问缩小范围，不符合社区对话产品形态
- **独立 Scout 会话表**：重复 002 已有 Conversation 能力，违反 YAGNI

## R4: Scout Prompt 与输出 schema

**Decision**:
- Prompt 外置：`server/prompts/scout-recommend.md`
- 输入 JSON：`{ question, filters: { position?, maxAge?, leagueCode?, teamId? }, candidates: [...] }`
- 输出 JSON schema：
  ```json
  {
    "summary": "string",
    "recommendations": [{
      "playerId": "string",
      "matchReason": "string",
      "keyStats": [{ "name": "string", "value": "number|string", "unit": "string?" }]
    }],
    "narrowHint": "string|null",
    "confidence": "high|medium|low"
  }
  ```
- 规则：Prompt 内约束「仅推荐 candidates 列表中的球员」「keyStats 必须来自候选人 stats 字段」

**Rationale**: FR-014 可验证依据 + 契约测试可断言推荐数量与字段完整性。

## R5: Tactical Agent 对话与分析模型

**Decision**:
- 复用 `Conversation`：`agent_id=tactical`
- `context_type`：主要为 `match`（context_id=match_id）；可选 `team` 用于「球队近期战术风格」类问题
- `TacticalContextBuilder` 构建上下文：
  - 比赛 status、阵型（从 stats_json 推断或标注 unknown）
  - 关键统计（控球、压迫相关 proxy：犯规、抢断若可用）
  - 事件摘要（进球/换人时间点，非逐球跑位）
- `analysisType` 派生规则：
  - `FINISHED` → `post_match`（赛后复盘）
  - `SCHEDULED` / `LIVE` → `pre_match_prediction`（赛前预判，Prompt 强制标注）
- 输出：`{ analysisType, formation, phases[], keyPlayers[], confidence, dataLimitations[] }`
- `data_completeness=partial|pending` 且无 events_json → confidence 最高 `medium`，禁止输出具体传球线路

**Rationale**: 直接对应 FR-016–018；与 Stats 共用 Match 实体避免重复拉取。

**Alternatives considered**:
- **要求用户上传战术图**：超出 spec 范围且无可行数据源
- **视频事件级数据**：vision spec Out of Scope，且 football-data 免费层不提供

## R6: Tactical Prompt 与阶段划分

**Decision**:
- Prompt 外置：`server/prompts/tactical-analysis.md`
- 固定阶段枚举：`build_up`（出球）、`pressing`（压迫）、`transition`（转换）、`set_piece`（定位球，若有数据）
- 每阶段 1–2 句说明 + 可选 `keyPlayerNames[]`（须为 events/stats 中出现过的人名）
- 输出 JSON schema 含 `analysisType` 字段，assistant 消息正文首行重复人类可读标签：「【赛后复盘】」或「【赛前战术预判】」

**Rationale**: 满足 acceptance scenario 阵型+阶段划分；FR-017 显式标注分析类型。

## R7: Conversation API 扩展方式

**Decision**:
- 003 契约文件定义 MVP-3 增量：
  - `GET/POST /conversations` 的 `agentId` 枚举扩展为 `[stats, scout, tactical]`
  - Scout `contextType`: `[general, league, team]`
  - Tactical `contextType`: `[match, team]`
  - `Message` schema 扩展：`recommendations[]`、`tacticalAnalysis` 可选字段
  - 新增 `POST /conversations/{id}/messages/{messageId}/feedback`（SC-004）
  - 新增 `GET /players`（按联赛/球队/位置筛选，辅助前台）
  - 新增 `POST /internal/jobs/player-sync`
- 实现层修改 `server/src/api/conversations.js` 与 `conversation-service.js`，按 agentId 委派

**Rationale**: Constitution II 契约优先；003 自有契约描述增量，不回头修改 002 openapi 文件（多模块规约）。

**Alternatives considered**:
- **在 002 contracts 直接改 enum**：违反「禁止跨模块静默改动对端契约」
- **独立 `/scout/conversations` 路径**：增加路由与测试重复，002 已承诺无此路由是针对 002 范围而非 003

## R8: 前台路由与导航

| 路径 | 用途 | 核心 ID |
|------|------|---------|
| `/scout` | 设置联赛/球队范围，创建 Scout 对话 | — |
| `/tactical` | 选择比赛，创建 Tactical 对话 | — |
| `/conversations/:conversationId` | Scout/Tactical 多轮对话（复用，按 agentId 渲染） | conversationId |

**导航路径（人工 E2E）**:
- Scout：首页 → `/scout` → 输入条件 → `/conversations/:id` → 查看推荐卡片 → 追问缩小范围
- Tactical：比赛详情 `/matches/:matchId` → 「战术分析」→ `/conversations/:id` → 查看阶段面板

## R9: SC-004 反馈采集

**Decision**:
- `message_feedback` 表：`user_id` + `message_id` 唯一，字段 `helpful`（boolean）
- API：`POST /conversations/{conversationId}/messages/{messageId}/feedback`
- 仅 `role=assistant` 且 `agent_id in (scout, tactical)` 的消息可反馈
- 后台指标：`scout_recommendation_helpful_rate`（不要求 Sprint 内实现仪表盘，须记录日志事件）

**Rationale**: SC-004 标注 Deferrable: yes，但数据模型与 API 须在 MVP-3 预埋，避免后补迁移。

## R10: 环境变量

```env
# 在 MVP-2 基础上新增（可选覆盖）
PLAYER_SYNC_CRON=0 4 * * *
```

## R11: 测试策略

**Decision**:
- `ScoutContextBuilder` / `TacticalContextBuilder`：单元测试覆盖过滤、缺数据、联赛范围
- Scout/Tactical Agent：100% 分支（正常、超时、无候选、宽泛条件 top5、赛前/赛后）
- 契约测试：supertest + 测试库，Mock AI 与 football-data
- 人工 E2E：真实 API Key + AI 凭证至少各 1 次端到端（L4 Checkpoint）

**Alternatives considered**:
- **Playwright 前台自动化**：Constitution VIII 明确禁止
