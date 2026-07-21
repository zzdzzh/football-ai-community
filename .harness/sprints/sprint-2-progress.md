# Sprint 2 进度追踪 — Stats Agent 与 Content Agent



**Feature**: 002-football-stats-content  

**Sprint 计划**: [sprint-2.md](./sprint-2.md)  

**开始**: 2026-07-17



---



## 批次 2.1–2.5 · US1（此前已交付）



- [x] T001–T020 US1 与 Foundational | L1:✅ L2:✅

- [x] 🚧 **批次2.5门禁: L1 Step4 + 👁 HV-1 (~5 min, 产品/用户)** | 结果: L1:✅ · HV-1: ✅ 用户签收（`/stats` 入口）



---



## 批次 2.6 · US2 后台 — Content Agent 战报生成



- [x] T021 [P] [US2] Unit tests for content-agent and stats-context-builder report mode in server/tests/unit/content-agent.test.js | L1:✅ L2:✅(405)

- [x] T022 [US2] Create match-report prompt and implement content-agent in server/prompts/match-report.md and server/src/agents/content-agent.js | L1:✅ L2:✅

- [x] T023 [US2] Implement match-report-generate job with event_key dedup and cron in server/src/jobs/match-report-generate.js | L1:✅ L2:✅

- [x] T024 [US2] Extend GET /matches/:matchId with report + publishMatchReport in feed-service | L1:✅ L2:✅

- [x] 🚧 **批次2.6门禁** | 结果: ✅ createAppOK · content-agent unit PASS · match-report router mounted



---



## 批次 2.7 · US2 前台 — 比赛专题页 + Feed 战报卡片



- [x] T025 [P] [US2] MatchDetailView 战报展示 + Stats/Tactical 入口 | L1:✅ vue-tsc L2:✅

- [x] T026 [US2] FeedCard match_report/brief_report → /matches/:matchId | L1:✅ vue-tsc L2:✅

- [x] 🚧 **批次2.7门禁** | 结果: ✅ vue-tsc · UI 并入 HV-2



---



## 批次 2.8 · Polish 收官



- [x] T027 [P] feed-preference-sort notify_match_report 加权 | L1:✅ L2:✅

- [x] T028 Scope 边界审计：002 migration 仅 ADD 列；Content 不虚构；ALLOWED_LEAGUES 白名单仍在；后续 Sprint 的 Scout/Tactical/Fan 属 003/004 不计入 002 违约 | L1:✅ L2:✅

- [x] 🚧 **批次2.8门禁: L1 Step4 + 👁 HV-2 (~15–20 min, 产品/用户)** | 结果: L1:✅(405) · HV-2: ✅ 用户签收



---



## Sprint 2 收官



**状态**: ✅ 已完成（2026-07-17 · T001–T028 全部完成 · HV-1/HV-2 用户签收）


