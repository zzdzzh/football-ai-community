# Quickstart: Stats Agent 与 Content Agent

**Date**: 2026-07-10  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Prerequisites**: [001-football-feed-mvp/quickstart.md](../001-football-feed-mvp/quickstart.md) 已完成（MVP-1 可运行）

本地开发环境快速启动指南（Windows + PowerShell）。

## 前置条件

| 工具 | 版本要求 |
|------|----------|
| Node.js | 20 LTS |
| npm | 10+ |
| football-data.org | 免费 API Token（[注册](https://www.football-data.org/client/register)） |

## 1. 环境变量（在 MVP-1 基础上新增）

`server/.env` 追加：

```env
FOOTBALL_DATA_API_KEY=your-football-data-token
FOOTBALL_DATA_BASE_URL=https://api.football-data.org/v4

# 可选：覆盖默认 cron（生产建议保持默认）
# MATCH_SYNC_CRON=*/30 * * * *
# MATCH_REPORT_CRON=*/5 * * * *
```

> MVP-1 的 `AI_*`、`JWT_SECRET`、`INTERNAL_API_KEY` 等保持不变。

## 2. 数据库迁移

```powershell
cd d:\work\football-ai-community\server; npm run db:migrate
```

预期应用 `003_stats_content.sql`，新增 teams/matches/conversations/messages 等表。

## 3. 启动服务

```powershell
cd d:\work\football-ai-community\server; npm run dev
cd d:\work\football-ai-community\web; npm run dev
```

前台监听 `http://0.0.0.0:5173`。

## 4. 首次同步比赛数据

```powershell
curl -X POST "http://localhost:3000/api/internal/jobs/match-sync" -H "X-Internal-Key: dev-internal-key"
```

等待约 30–60 秒（6 联赛受 8 req/min 限制）。检查：

```powershell
curl "http://localhost:3000/api/matches?league=PL&status=FINISHED&pageSize=5"
```

## 5. 验证 Stats Agent 对话

1. 浏览器登录 `http://localhost:5173/login`
2. 打开 `http://localhost:5173/stats`，选择一场已结束比赛
3. 输入：「这场比赛控球与射门表现如何？」
4. 期望：30 秒内返回 ≥3 项指标 + 自然语言解读 + 置信度标签

或使用 API：

```powershell
# 1. 登录获取 token
$login = curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"your@email.com\",\"password\":\"yourpass\"}" | ConvertFrom-Json
$token = $login.token

# 2. 创建对话（替换 MATCH_ID）
curl -X POST http://localhost:3000/api/conversations -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"agentId\":\"stats\",\"contextType\":\"match\",\"contextId\":\"MATCH_ID\",\"initialMessage\":\"控球和射门怎么样？\"}"
```

## 6. 验证 Content Agent 战报

对已 FINISHED 且数据完整的比赛：

```powershell
curl -X POST "http://localhost:3000/api/internal/jobs/match-report-generate" -H "X-Internal-Key: dev-internal-key"
```

浏览器打开 `http://localhost:5173/matches/{matchId}`，期望看到：
- 比分与关键事件时间线
- Content Agent 战报（或数据不足时的 brief_report + 缺失项标注）
- 首页 Feed 出现 `match_report` 类型卡片

## 7. 契约测试

```powershell
cd d:\work\football-ai-community\server; npm run test:contract
```

MVP-2 新增：`matches.test.js`、`conversations.test.js`、`match-sync.test.js`（tasks 阶段实现）。

## 8. Swagger 文档

合并后的 API 文档：`http://localhost:3000/api/docs`（实现阶段挂载 002 契约）。

## 9. 开发流程

1. 修改 `specs/002-football-stats-content/contracts/openapi.yaml`
2. `npm run test:contract` 红灯
3. 实现 `server/src/api/`、`agents/`、`jobs/`
4. 契约测试绿灯
5. 前台对接 + **人工截图验收**（从 Feed → 比赛页 → Stats 对话完整路径）

## 10. MVP-2 范围边界自检

- [ ] 无 Scout/Tactical/Fan 路由与页面
- [ ] 无 ContentReport / 审核 API
- [ ] football-data 仅 6 联赛白名单
- [ ] Stats 缺数据时不返回虚构比分
- [ ] Content 数据不足时发布 `brief_report` 而非虚构细节
- [ ] Conversation 无法跨用户访问（403）

## 11. 人工 E2E 截图清单（L4）

| 节点 | 截图内容 |
|------|----------|
| 初始态 | 比赛列表 / Stats 入口页 |
| 操作后 | Stats 对话含指标与置信度 |
| 结果页 | 比赛专题页战报 + 时间线 |
| 边缘态 | 「数据同步中」或 brief_report 缺失标注 |
