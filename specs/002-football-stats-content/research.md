# Research: Stats Agent 与 Content Agent

**Date**: 2026-07-10  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## R1: football-data.org v4 集成

**Decision**: 自研 `FootballDataAdapter`（原生 `fetch`），Base URL `https://api.football-data.org/v4`，Header `X-Auth-Token: FOOTBALL_DATA_API_KEY`。

**Rationale**:
- 官方 REST API 覆盖 spec 要求的 6 联赛（PL/PD/BL1/SA/FL1/CL）
- 免费层 10 req/min 足够配合本地 SQLite 缓存
- 无成熟轻量 SDK 值得引入额外依赖（YAGNI）

**主要端点**:
| 用途 | 端点 | 频率 |
|------|------|------|
| 联赛赛程 | `GET /competitions/{code}/matches?status=SCHEDULED,LIVE,FINISHED` | 每 5–30 min |
| 比赛详情+统计 | `GET /matches/{id}` | 按需 / FINISHED 后补拉 |
| 球队搜索 | `GET /competitions/{code}/teams` | 每日 1 次 / 联赛切换时 |

**Alternatives considered**:
- **API-Football (RapidAPI)**：免费层更紧，且与 spec 指定 football-data.org 不一致
- **每次对话实时拉取**：10 req/min 下 3 个并发用户即可限流

## R2: 速率限制与缓存策略

**Decision**:
- 内存令牌桶：8 token/min（留 20% 余量）
- SQLite 为唯一缓存层；`match_sync_meta` 记录每联赛上次同步时间与窗口请求计数
- 同步策略：
  - 有 LIVE 比赛时：cron `*/5 * * * *`
  - 无 LIVE 时：cron `*/30 * * * *`
  - FINISHED 且缺 `stats_json`：排队补拉（同一 match 最多重试 3 次，指数退避）

**Rationale**: 满足 spec 边缘场景「限流降级」与 SC-003「15 分钟内报道」的平衡。

**Alternatives considered**:
- **Redis 缓存**：Constitution VI YAGNI，SQLite 足够当前规模
- **全量每日同步**：无法支持 LIVE 状态与 SC-003 时效

## R3: Stats Agent 对话模型

**Decision**:
- 实体：`Conversation`（`agent_id=stats`，`context_type` + `context_id`）+ `Message`（user/assistant）
- 创建对话：`POST /conversations` 携带 `{ agentId: "stats", contextType, contextId }`
- 发消息：`POST /conversations/{id}/messages` → Stats Agent 读取 SQLite 比赛/球队数据 → `AiAnalysisService.analyze()` → 返回解读 + `metrics[]` + `confidence`
- 超时：30s（AgentProfile `stats.timeout_ms=30000`）

**Rationale**: 可复用到 003 Scout/Tactical；URL 带 `conversationId` 满足 Constitution I 重入要求。

**Alternatives considered**:
- **无状态单轮 POST `/stats/ask`**：无法支持多轮追问，且不符合 spec FR-026「对话」语义

## R4: Stats 解读 Prompt 与置信度

**Decision**:
- Prompt 外置：`server/prompts/stats-interpret.md`
- 输入：结构化 JSON（仅 SQLite 已有字段，缺字段显式列 `missingFields`）
- 输出 JSON schema：`{ interpretation, metrics: [{name, value, unit}], confidence: "high"|"medium"|"low", missingFields: [] }`
- 规则：Prompt 内硬约束「missingFields 非空时 confidence 不得为 high」

**Rationale**: FR-011 置信度 + FR-012 禁止编造；结构化输出便于契约测试断言。

## R5: Content Agent 赛后报道流水线

**Decision**:
1. `match-sync` 检测 `status` 变为 `FINISHED`
2. `match-report-generate` cron（`*/5 * * * *`）扫描：`FINISHED` + 无对应 `feed_items.event_key=match_report:{matchId}` + 数据就绪
3. `StatsContextBuilder` 生成数据摘要 → `ContentAgent` 调用 `AiContentService` + `prompts/match-report.md`
4. 数据完整度 < 阈值：发布 `brief_report`；否则 `match_report`
5. `FeedItem.event_key = match_report:{matchId}` 去重

**Rationale**: Multi-Agent 协作 FR-026；与 News Agent 相同的 Feed 发布路径，复用 001 Feed UI。

**Alternatives considered**:
- **同步阻塞生成**：单场比赛 AI 60s 会阻塞 sync job
- **独立 Content 表**：重复 Feed 能力，违反 YAGNI

## R6: 前台路由（MVP-2 新增）

| 路径 | 用途 | 核心 ID |
|------|------|---------|
| `/stats` | 选择比赛/球队，创建 Stats 对话 | — |
| `/conversations/:conversationId` | Stats 多轮对话 | conversationId |
| `/matches/:matchId` | 比赛专题 + 赛后报道 | matchId |

**导航路径（人工 E2E）**: 首页 Feed 战报卡片 → `/matches/:matchId` → 「向 Stats 提问」→ `/conversations/:id`

## R7: 环境变量

**Decision**: 新增 `FOOTBALL_DATA_API_KEY`（必填于生产）；`FOOTBALL_DATA_BASE_URL` 可选默认 v4。

```env
FOOTBALL_DATA_API_KEY=your-token
FOOTBALL_DATA_BASE_URL=https://api.football-data.org/v4
MATCH_SYNC_CRON=*/30 * * * *
MATCH_REPORT_CRON=*/5 * * * *
```

## R8: 测试策略

**Decision**:
- `FootballDataAdapter`：单元测试 Mock `fetch` 响应 fixture
- Stats/Content Agent：100% 分支（缺数据、超时、限流、正常）
- 契约测试：supertest + 测试库，不调用真实 football-data / AI
- 人工 E2E：真实 API Key 至少 1 次端到端（L4 Checkpoint）

**Alternatives considered**:
- **Playwright 前台自动化**：Constitution VIII 明确禁止，使用人工测试
