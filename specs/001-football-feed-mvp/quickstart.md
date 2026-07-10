# Quickstart: 足球社区 Feed MVP

**Date**: 2026-07-10  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

本地开发环境快速启动指南（Windows + PowerShell）。

## 前置条件

| 工具 | 版本要求 |
|------|----------|
| Node.js | 20 LTS |
| npm | 10+ |

## 1. 环境变量

`server/.env`：

```env
PORT=3000
JWT_SECRET=your-dev-secret-change-in-production
DATABASE_PATH=./data/community.db

AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-your-key
AI_MODEL=gpt-4o-mini
AI_TIMEOUT_MS=28000

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me
```

`web/.env`：

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

> MVP-1 不需要 `FOOTBALL_DATA_API_KEY`（002 引入）。

## 2. 安装依赖

```powershell
cd d:\work\football-ai-community\server; npm install
cd d:\work\football-ai-community\web; npm install
```

## 3. 初始化数据库

```powershell
cd d:\work\football-ai-community\server; npm run db:migrate; npm run db:seed
```

## 4. 启动服务

```powershell
cd d:\work\football-ai-community\server; npm run dev
cd d:\work\football-ai-community\web; npm run dev
```

前台监听 `http://0.0.0.0:5173`。

## 5. 验证安装

| 检查项 | 操作 | 期望 |
|--------|------|------|
| 健康检查 | `curl http://localhost:3000/api/health` | `{"status":"ok"}` |
| Swagger | `http://localhost:3000/api/docs` | 可加载 |
| 首页 | `http://localhost:5173/` | Feed 时间线 |
| 契约测试 | `cd server; npm run test:contract` | PASS |

## 6. 手动触发 News 抓取

```powershell
curl -X POST http://localhost:3000/api/internal/jobs/news-fetch -H "X-Internal-Key: dev-internal-key"
```

## 7. 开发流程

1. 修改 `specs/001-football-feed-mvp/contracts/openapi.yaml`
2. `npm run test:contract` 红灯
3. 实现 `server/src/api/`
4. 契约测试绿灯
5. 前台对接 + 人工截图验收

## 8. MVP-1 范围边界自检

- [ ] 无 billing / 支付相关代码
- [ ] AgentProfile 无创建/修改 API
- [ ] 无 `/matches`、`/conversations`、`/fan-discussions` 路由实现
