# Implementation Plan: 足球社区 Feed MVP

**Branch**: `001-football-feed-mvp` | **Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-football-feed-mvp/spec.md`

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

## Summary

构建足球 AI 社区首期可交付能力：前后端分离脚手架、JWT 认证、News Agent RSS 抓取与 AI 摘要、社区 Feed 时间线、用户偏好个性化。数据持久化 SQLite。本 spec 仅含 US1（新闻 Feed）与 US2（偏好，原愿景 US7），共 2 个 User Story，符合 Constitution 原则 XII。

## Technical Context

**Language/Version**: Node.js 20 LTS（后台）；Vue 3.4+ / TypeScript 5.x（前台）

**Primary Dependencies**:
- 后台：Express 4.x、better-sqlite3、jsonwebtoken、bcryptjs、node-cron、rss-parser、zod、swagger-ui-express
- 前台：Vite 5.x、Element Plus、Vue Router、Pinia、axios
- AI：统一 `AiContentService` + OpenAI 兼容适配器

**Storage**: SQLite（`server/data/community.db`）

**Testing**: Jest（`server/` contract + unit）；前台人工测试

**Performance Goals**:
- 首页 Feed API p95 < 500ms（缓存命中）
- News 定时抓取周期 15 分钟

**Constraints**:
- 前台 Vite dev server 监听 `0.0.0.0`
- AgentProfile 只读，无用户自定义 Agent
- 脚本使用 PowerShell

## Constitution Check

| 原则 | 判定 | 理由 |
|------|------|------|
| I. 前后端分离 | ✅ PASS | `web/` + `server/` + SQLite |
| II. 契约优先 | ✅ PASS | `contracts/openapi.yaml` MVP-1 子集 |
| III. 测试纪律 | ✅ PASS | 认证 100% 分支、Feed/Preferences 契约测试 |
| IV. AI 治理 | ✅ PASS | `server/src/ai/` 抽象层 + 外置 Prompt |
| VIII. UI 验证 | ✅ PASS | 人工截图验收 |
| XII. Spec 颗粒度 | ✅ PASS | 2 个 US、30 个 task |

**Gate Result**: PASS — 可进入 tasks 与 harness.plan

## Project Structure

```text
server/
├── src/api/          # auth.js, feed.js, preferences.js
├── src/agents/       # news-agent.js
├── src/adapters/     # news-rss-adapter.js
├── src/jobs/         # news-fetch.js
└── tests/contract/   # auth, feed, preferences

web/
├── src/views/        # HomeView, FeedDetailView, Login, Register, PreferencesView
└── src/components/feed/
```

## MVP 分期与后续 Spec

| 阶段 | Spec | User Stories |
|------|------|--------------|
| **当前** | 001-football-feed-mvp | US1 新闻、US2 偏好 |
| MVP-2 | 002-football-stats-content | Stats + Content |
| MVP-3 | 003-football-scout-tactical | Scout + Tactical |
| MVP-4 | 004-football-fan-community | Fan + 举报 |

## Complexity Tracking

| Violation | Why Needed | Alternative Rejected |
|-----------|------------|---------------------|
| node-cron | News 15min 定时抓取 | 纯手动触发无法满足 SC-001 时效性 |
| OpenAI 兼容适配器 | Constitution IV | 直接 SDK 违反宪法 |

## Scope 边界验证清单

| 边界承诺 | 验证方式 |
|----------|----------|
| 零计费 | 无 billing 表/API |
| AgentProfile 只读 | 无创建 Agent API |
| 无 football-data 实现 | 无 match-sync 路由（留给 002） |
