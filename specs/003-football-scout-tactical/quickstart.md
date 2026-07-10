# Quickstart: Scout Agent 与 Tactical Agent

**Date**: 2026-07-10  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Prerequisites**: [002-football-stats-content/quickstart.md](../002-football-stats-content/quickstart.md) 已完成（MVP-2 可运行）

本地开发环境快速启动指南（Windows + PowerShell）。

## 前置条件

| 工具 | 版本要求 |
|------|----------|
| Node.js | 20 LTS |
| npm | 10+ |
| football-data.org | 有效 API Token（与 MVP-2 相同） |
| AI 服务 | OpenAI 兼容 API 凭证（与 MVP-1/2 相同） |

## 1. 环境变量（在 MVP-2 基础上可选新增）

`server/.env` 可追加：

```env
# 可选：覆盖球员同步 cron（默认每日 04:00）
# PLAYER_SYNC_CRON=0 4 * * *
```

> MVP-2 的 `FOOTBALL_DATA_API_KEY`、`AI_*`、`JWT_SECRET` 等保持不变。

## 2. 数据库迁移

```powershell
cd d:\work\football-ai-community\server; npm run db:migrate
```

预期应用 `006_scout_tactical.sql`，新增 players/player_stats_snapshots/message_feedback 等表，扩展 messages 列。

## 3. 启动服务

```powershell
cd d:\work\football-ai-community\server; npm run dev
cd d:\work\football-ai-community\web; npm run dev
```

前台监听 `http://0.0.0.0:5173`。

## 4. 首次同步球员数据

确保 MVP-2 球队数据已同步后，触发球员同步：

```powershell
curl -X POST "http://localhost:3000/api/internal/jobs/player-sync" -H "X-Internal-Key: dev-internal-key"
```

等待约 2–5 分钟（受 8 req/min 限制，需遍历所有球队 squad）。检查：

```powershell
curl "http://localhost:3000/api/players?league=PL&pageSize=5"
```

## 5. 验证 Scout Agent 推荐

1. 浏览器登录 `http://localhost:5173/login`
2. 打开 `http://localhost:5173/scout`，选择联赛「英超」
3. 输入：「需要一名擅长压迫的中场，25 岁以下」
4. 期望：30 秒内返回 ≥3 名球员推荐，每名含姓名、球队、推荐理由、≥3 项关键数据

或使用 API：

```powershell
# 1. 登录获取 token
$login = curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"your@email.com\",\"password\":\"yourpass\"}" | ConvertFrom-Json
$token = $login.token

# 2. 创建 Scout 对话
curl -X POST http://localhost:3000/api/conversations -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"agentId\":\"scout\",\"contextType\":\"league\",\"contextId\":\"PL\",\"initialMessage\":\"需要一名擅长压迫的中场，25岁以下\"}"
```

## 6. 验证 Tactical Agent 分析

1. 打开一场已结束比赛 `http://localhost:5173/matches/{matchId}`
2. 点击「战术分析」，进入 `/conversations/{conversationId}`
3. 输入：「主队是如何组织高位压迫的？」
4. 期望：回复含阵型、战术阶段（出球/压迫/转换）、各阶段说明；数据不足时置信度为「中」或「低」并说明限制

未开赛比赛测试（赛前预判）：

```powershell
# 创建 Tactical 对话（替换 SCHEDULED_MATCH_ID）
curl -X POST http://localhost:3000/api/conversations -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"agentId\":\"tactical\",\"contextType\":\"match\",\"contextId\":\"SCHEDULED_MATCH_ID\",\"initialMessage\":\"客队可能采用什么压迫战术？\"}"
```

期望：回复标注「【赛前战术预判】」，不得表述为已发生事实。

## 7. 验证消息反馈（SC-004 预埋）

```powershell
curl -X POST "http://localhost:3000/api/conversations/{conversationId}/messages/{messageId}/feedback" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"helpful\":true}"
```

## 8. 契约测试

```powershell
cd d:\work\football-ai-community\server; npm run test:contract
```

MVP-3 新增：`players.test.js`、`scout-conversations.test.js`、`tactical-conversations.test.js`、`player-sync.test.js`（tasks 阶段实现）。

## 9. Swagger 文档

合并后的 API 文档：`http://localhost:3000/api/docs`（实现阶段挂载 003 契约增量）。

## 10. 开发流程

1. 修改 `specs/003-football-scout-tactical/contracts/openapi.yaml`
2. `npm run test:contract` 红灯
3. 实现 `server/src/agents/`、`services/`、`api/`、`jobs/`
4. 契约测试绿灯
5. 前台对接 + **人工截图验收**（Scout 入口 → 对话 → 推荐卡片；比赛页 → 战术分析 → 阶段面板）

## 11. MVP-3 范围边界自检

- [x] 无 Fan Agent 路由与页面
- [x] 无 ContentReport / 审核 API
- [x] Scout 联赛过滤后结果不含其他联赛球员（单元测试覆盖）
- [x] Tactical 缺事件数据时不返回具体传球线路（单元测试覆盖）
- [x] 赛前比赛标注「赛前战术预判」（契约测试覆盖）
- [x] Conversation 无法跨用户访问（403）（契约测试覆盖）
- [x] 002 Stats 对话功能回归仍正常（conversations.test.js 7/7 PASS）

## 12. 人工 E2E 截图清单（L4）

| 节点 | 截图内容 |
|------|----------|
| Scout 初始态 | `/scout` 筛选表单（联赛/球队） |
| Scout 结果 | 对话页推荐卡片 ≥3 人 + keyStats |
| Scout 边缘态 | 条件宽泛时 top5 + 缩小范围提示 |
| Tactical 初始态 | 比赛页「战术分析」入口 |
| Tactical 结果 | 战术阶段面板 + 阵型标签 |
| Tactical 边缘态 | 数据不足时低置信度 + 限制说明 |
| 赛前预判 | 未开赛比赛标注「赛前战术预判」 |
