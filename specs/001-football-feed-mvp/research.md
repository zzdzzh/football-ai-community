# Research: 足球社区 Feed MVP

**Date**: 2026-07-10  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## R1: 足球新闻数据源

**Decision**: RSS 聚合（BBC Sport、ESPN FC、Sky Sports Football）+ `rss-parser` + 本地缓存。

**Rationale**: 公开合法、无需 API Key、多源互为备份。

## R2: AI/LLM 推理服务

**Decision**: `AiContentService` + `OpenAiCompatibleAdapter`（`AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL=gpt-4o-mini`）。

**Rationale**: Constitution IV 抽象层要求。

## R3: 认证

**Decision**: JWT Bearer（7 天）+ bcrypt cost 10。

## R4: 新闻去重

**Decision**: URL 精确去重 + 标题 Levenshtein > 0.85 + AI `event_key` 合并。

## R5: 定时任务

**Decision**: `node-cron`，MVP-1 仅 `news-fetch`（`*/15 * * * *`）。

> 比赛同步与赛后报道 cron 留给 [002-football-stats-content](../002-football-stats-content/spec.md)。

## R6: 前台路由（MVP-1）

| 路径 | 用途 |
|------|------|
| `/` | 社区首页 |
| `/feed/:feedId` | 动态详情 |
| `/settings/preferences` | 用户偏好 |
| `/login` `/register` | 认证 |

## R7: 速率限制

**Decision**: `express-rate-limit` — 未登录 60/min/IP；登录注册 10/min/IP。
