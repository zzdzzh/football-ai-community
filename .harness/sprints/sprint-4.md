# Sprint 4: Fan Agent 与社区治理全量交付

**Feature**: [004-football-fan-community](../../specs/004-football-fan-community/spec.md)  
**Branch**: `004-football-fan-community`  
**Sprint 编号**: 4  
**时间**: 2026-07-31（周四）→ 2026-08-06（周三）  
**工作日**: 5 天  
**团队规模**: 1 人 + 自动化辅助  
**总预估工时**: ~27h（约 3.4 人日）  
**对应 Phase**: Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (US1) + Phase 4 (Polish)  
**Spec 颗粒度 pre-check**: ✅ 1 US / 27 tasks（原则 XII 阈值内）

## Sprint 目标

本 Sprint 结束时，**登录用户可从 `/fan` 选择 ≥2 个 Fan Persona 与讨论主题，60 秒内跳转 `/discussions/{discussionId}` 查看 ≥4 条带球队人格标签的交替发言；可插话触发续写；违规内容在写入前被拦截并提示；可通过 ReportDialog 举报不当内容；moderator/admin 在 `/admin/reports` 隐藏被举报讨论后 Feed 不再展示该条目**。

## 在整体规划中的位置

| 维度 | 说明 |
|------|------|
| 前置 | [003-football-scout-tactical](../../specs/003-football-scout-tactical/spec.md) Sprint 3 已完成（或至少 [002-football-stats-content](../../specs/002-football-stats-content/spec.md) Feed/Match/Auth 基础设施就绪） |
| 本 Sprint | MVP-4 全量：US1 Fan Agent 模拟讨论 + 内容举报与管理员审核 |
| 解锁 | 六 Agent 社区全景 MVP 路线图收官；后续可进入运营打磨或新 feature |
| 外部服务 | OpenAI 兼容 AI 推理服务（Fan Agent 多 Persona 生成）；消费 001 Feed/Auth、002 Match（可选议题上下文） |

## 命令约定

| 占位符 | 命令 |
|--------|------|
| `[APP_START_COMMAND]` | `cd server; npm run dev` |
| `[UI_START_COMMAND]` | `cd web; npm run dev` |
| `[TYPECHECK_COMMAND]` | `cd web; npx vue-tsc --noEmit` |
| `[BUILD_COMMAND]` | `cd server; npm test`（契约+单元） |
| `[REAL_SERVICE_CHECK]` | Fan AI 讨论生成至少 1 次 success（≥4 条 Persona 发言）+ 内容过滤拦截至少 1 次验证 |
| `[E2E_TOOL]` | 人工测试（本项目前台不使用 Playwright） |
| `[MOCK_INDICATOR]` | 生产路径无 mock 残留；UI 无「演示数据」占位 |

---

## Day 1 · 批次 4.1：MVP-4 环境配置

**主题**: Fan 超时与内容审核 blocklist 环境变量扩展  
**批次类型**: 服务/核心批次  
**预估工时**: 1h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T001 | Add FAN_CONTINUE_TIMEOUT_MS and CONTENT_MODERATION_BLOCKLIST to server/.env.example | 0.5h | |
| T002 | Extend environment config loader for fan timeout and moderation blocklist settings | 0.5h | [P] |

**依赖**: Sprint 3 完成（MVP-3 脚手架就绪）  
**并行说明**: T002 可与 T001 并行（不同文件）

**批次 4.1 门禁**: `[APP_START_COMMAND]` 启动成功 + 新环境变量加载无报错 + `.env.example` 文档完整

---

## Day 1–2 · 批次 4.2：Foundational — Fan/Community 数据层 + 内容过滤 + Feed 扩展

**主题**: 数据库迁移、Fan/Report Repository、ContentModerationService、feed-service fan_discussion 扩展  
**批次类型**: 服务/核心批次  
**预估工时**: 4h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T003 | Create SQLite migration 007_fan_community.sql with Persona seed data | 0.5h | |
| T004 | [P] Implement fan-persona repository | 0.5h | [P] |
| T005 | [P] Implement fan-discussion, fan-discussion-persona and fan-discussion-turn repositories | 0.5h | [P] |
| T006 | [P] Implement content-report repository | 0.5h | [P] |
| T007 | [P] Implement ContentModerationService with blocklist rules | 0.5h | [P] |
| T008 | Extend feed-service for fan_discussion FeedItem publish, visibility filter and event_key dedup | 1h | |

**依赖**: 批次 4.1 完成  
**执行顺序**: T003 → T004/T005/T006/T007 并行 → T008（依赖 T003）  
**跨模块注意**: 若 001 FeedItem `type` 枚举未含 `fan_discussion`，须先在 `specs/001-football-feed-mvp/tasks.md` 增补契约扩展任务后再继续 T008

**批次 4.2 门禁**: `[APP_START_COMMAND]` 启动成功 + 数据迁移 007 通过 + GET /fan-personas 可调用（种子数据 ≥12 条）+ ContentModerationService 单元冒烟通过

---

## Day 2 · 批次 4.3：US1 契约与单元测试

**主题**: fan-discussions / content-reports / admin-reports 契约测试 + fan-context-builder / fan-agent / content-moderation 单元测试  
**批次类型**: 服务/核心批次  
**预估工时**: 3h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T009 | [P] [US1] Contract tests for GET /fan-personas, POST/GET /fan-discussions and POST /fan-discussions/{id}/turns | 0.5h | [P] |
| T010 | [P] [US1] Contract tests for POST /content-reports | 0.5h | [P] |
| T011 | [P] [US1] Contract tests for GET /admin/content-reports, hide and dismiss actions | 0.5h | [P] |
| T012 | [P] [US1] Unit tests for fan-context-builder with 100% branch coverage | 0.5h | [P] |
| T013 | [P] [US1] Unit tests for fan-agent with 100% branch coverage | 1h | [P] |
| T014 | [P] [US1] Unit tests for content-moderation-service with 100% branch coverage | 0.5h | [P] |

**依赖**: 批次 4.2 完成  
**并行说明**: T009–T014 全部可并行启动（TDD：测试应先 fail 再随实现 PASS）

**批次 4.3 门禁**: `cd server; npm run test:contract` fan-discussions/content-reports/admin-reports 契约全 PASS + fan-agent/context-builder/content-moderation 单元测试 100% 分支覆盖

---

## Day 3 · 批次 4.4：US1 后台 — Fan Agent 讨论闭环 + 举报审核 API

**主题**: AiFanService、fan-context-builder、fan-discussion-service、fan-agent、fan-discussions/content-reports/admin-reports API  
**批次类型**: 服务/核心批次  
**预估工时**: 10.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T015 | [P] [US1] Create fan-discussion prompt and AiFanService | 1h | [P] |
| T016 | [US1] Implement fan-context-builder with optional matchId and feed snippet context | 1.5h | |
| T017 | [US1] Implement fan-discussion-service with turn persistence, persona association and Feed publish transaction | 2h | |
| T018 | [US1] Implement fan-agent orchestration for initial batch and continue modes | 2.5h | |
| T019 | [US1] Implement fan-discussions and fan-personas API and mount routes | 1.5h | |
| T020 | [US1] Implement content-reports API and mount route | 1h | |
| T021 | [US1] Implement admin-reports API and mount route | 1h | |

**依赖**: 批次 4.3 完成（T012/T013 fan-agent 测试驱动）  
**执行顺序**: T015/T016 可并行 → T017 → T018 → T019/T020/T021（T020/T021 可并行于 T019 之后）

**批次 4.4 门禁**: `[APP_START_COMMAND]` + POST /fan-discussions（≥2 Persona）+ GET /fan-discussions/{id} 调用链成功 + 首轮 ≥4 条 Persona 发言 + POST /fan-discussions/{id}/turns 插话续写成功 + 违规文本返回 422 + fan-discussions/content-reports/admin-reports 契约测试 PASS

---

## Day 4 · 批次 4.5：US1 前台 — Fan 讨论 UI（核心路径）

**主题**: FanStartView、PersonaPicker、FanDiscussionView、TurnBubble、ReportDialog、路由注册  
**批次类型**: 集成批次（前后端联调 + 用户可见 UI + 真实 AI 服务）  
**预估工时**: 6h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T022 | [P] [US1] Add web API clients for fan discussions and content reports | 0.5h | [P] |
| T023 | [P] [US1] Implement FanStartView and PersonaPicker component | 2h | [P] |
| T024 | [US1] Implement FanDiscussionView, TurnBubble, ReportDialog and register /fan and /discussions/:discussionId routes | 3.5h | |

**依赖**: 批次 4.4 完成  
**并行说明**: T022/T023 可并行于 T021 完成后；T024 依赖 T023

**批次 4.5 门禁**: L1 Step4 + 👁 **HV-1** (~5 min, 产品/用户)  
- `[APP_START_COMMAND]` + `[UI_START_COMMAND]` 同时 UP  
- 登录用户打开 `/fan` 输入「曼联 vs 利物浦赛后谁更强」，选择 2 个不同球队 Persona  
- 60 秒内跳转 `/discussions/{discussionId}` 显示 ≥4 条带球队人格标签的气泡  
- 插话后 Persona 回应参考用户观点；违规文本显示拦截提示  
- 截图存证 ≥2 张（`/fan` Persona 多选 + 讨论详情气泡）  
- `[REAL_SERVICE_CHECK]` Fan AI 讨论生成至少 1 次 success  
- `[MOCK_INDICATOR]` 清洁

#### 👁 人工验证节点 HV-1

| 节点 ID | 所在批次 | 触发时机 | 验证动作 | 预期时间 | 验证人 |
|---------|---------|---------|---------|---------|--------|
| HV-1 | 批次 4.5 | US1 MVP 可用 | 浏览器打开 `/fan` 与 `/discussions/:id` · 肉眼验收 Fan 核心 UI · 截图 ≥2 张 | ~5 min | 产品/用户 |

---

## Day 5 · 批次 4.6：US1 前台 — 管理员审核 + Feed 集成

**主题**: AdminReportsView、FeedCard fan_discussion 导航、/fan 入口  
**批次类型**: 用户界面批次（含 moderator 管理 UI）  
**预估工时**: 2.5h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T025 | [US1] Implement AdminReportsView and register /admin/reports route | 1.5h | |
| T026 | [US1] Extend FeedCard for fan_discussion type navigation and add /fan entry | 1h | |

**依赖**: 批次 4.5 HV-1 PASS  
**执行顺序**: T025 → T026（T026 依赖 T025 中 hide 后 Feed 可见性验证）

**批次 4.6 门禁**: `[APP_START_COMMAND]` + `[UI_START_COMMAND]` + `[TYPECHECK_COMMAND]` 通过 + ReportDialog 提交举报成功 + moderator `/admin/reports` hide 后 Feed fan_discussion 卡片不可见 + Feed 卡片点击进入 `/discussions/:discussionId`

---

## Day 5 · 批次 4.7：Polish 收官

**主题**: 002/003 conversations 回归、quickstart 验证、MVP-4 Scope 边界审计  
**批次类型**: 集成批次  
**预估工时**: 1h

| 任务ID | 描述 | 预估工时 | 并行 |
|--------|------|---------|------|
| T027 | Run 002/003 conversations contract regression and MVP-4 scope boundary audit | 1h | |

**依赖**: 批次 4.6 完成

**批次 4.7 门禁**: L1 Step4 + 👁 **HV-2** (~15–20 min, 产品/用户)  
- `cd server; npm test` 全部通过（含 fan-agent/content-moderation 100% 分支）  
- `[REAL_SERVICE_CHECK]` Fan AI 讨论至少 1 次 success + 内容过滤拦截至少 1 次验证  
- 人工走查 US1 全路径各 1 次 · 截图 ≥2 张（举报→管理员 hide→Feed 不可见 + 违规拦截提示）  
- 路径：`/fan` → 讨论 → 插话 → 举报 → `/admin/reports` hide → Feed 验证  
- quickstart.md §5–8 全流程可复现；plan.md Scope 边界验证清单全通过  
- 002/003 conversations 契约回归正常

#### 👁 人工验证节点 HV-2

| 节点 ID | 所在批次 | 触发时机 | 验证动作 | 预期时间 | 验证人 |
|---------|---------|---------|---------|---------|--------|
| HV-2 | 批次 4.7 | Sprint 收官前 | Fan AI 真实服务 + 举报审核全路径 + 002/003 回归肉眼验收 | ~15–20 min | 产品/用户 |

---

## 任务依赖图

```text
Phase 1 (T001–T002)
    ↓
Phase 2 Foundational (T003–T008)
    ↓
Phase 3 Tests (T009–T014)
    ↓
Phase 3 Backend (T015–T021)
    ↓
Phase 3 UI Core (T022–T024) ← HV-1
    ↓
Phase 3 UI Admin+Feed (T025–T026)
    ↓
Phase 4 (T027) ← HV-2
```

## 验证检查点

- [ ] `[APP_START_COMMAND]` — 后台无异常退出，Swagger UI 可访问
- [ ] `[UI_START_COMMAND]` — 前台监听 0.0.0.0，页面入口可访问
- [ ] `[TYPECHECK_COMMAND]` — 前台类型检查通过
- [ ] `cd server; npm run db:migrate` — 007_fan_community.sql 迁移成功
- [ ] `cd server; npm run test:contract` — fan-discussions/content-reports/admin-reports 契约全 PASS
- [ ] `cd server; npm test` — fan-agent/context-builder/content-moderation 单元测试全 PASS（AI 路径 100% 分支）
- [ ] Fan Persona 种子 — GET /fan-personas 返回 ≥12 条（6 联赛代表球队）
- [ ] 👁 HV-1 PASS — US1 Fan 讨论核心路径肉眼验收
- [ ] 👁 HV-2 PASS — US1 全路径 + 真实 AI 服务 + 举报审核验收

## Sprint 完成标准

1. 登录用户从 `/fan` 选择 ≥2 Fan Persona 与主题，60 秒内获得 ≥4 条交替 Persona 发言，每条标明球队人格（FR-019–020）
2. 用户插话后 Fan Agent 在下一轮参考用户观点并保持 Persona 风格差异（FR-021）
3. 人身攻击/歧视/违法内容在持久化前拦截并提示社区规范（FR-022）
4. 用户可通过 ReportDialog 举报不当内容；moderator/admin 在 `/admin/reports` hide 后 Feed 不可见（FR-030）
5. Feed 含 `fan_discussion` 类型卡片，点击可重入 `/discussions/:discussionId`
6. quickstart.md §5–8 全流程可复现；MVP-4 scope 边界审计通过；002/003 conversations 回归正常
7. SC-005（95% 合规率）标注 Deferrable: yes；Sprint 内验证 ≥4 turns 结构与 moderation 分支，不要求合规率仪表盘
8. **所有批次门禁 + HV-1 + HV-2 全部 PASS**

## 风险项与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 001 FeedItem `type` 枚举未含 `fan_discussion` | T008 Feed 集成阻塞 | tasks.md 已标注跨模块依赖；优先检查 001 OpenAPI 并增补契约任务 |
| OpenAI API Key 缺失或限流 | Fan Agent 无法生成讨论 | `.env` 提前配置；AiFanService 超时降级；单元测试 Mock 100% 分支保底 |
| Fan AI 60s 首轮超时 | FR-019/SC-005 不达标 | AgentProfile `fan.timeout_ms=60000`；fan-context-builder 预裁剪上下文；续写轮 30s 独立超时 |
| 多 Persona 交替生成质量不稳定 | 风格差异不足或轮次不足 | 外置 `prompts/fan-discussion.md` 约束交替顺序；T013 验证 ≥4 turns 结构 |
| ContentModeration blocklist 误杀/漏杀 | 用户体验或合规风险 | T014 100% 分支覆盖；blocklist 可配置；违规返回 422 明确提示 |
| T024 FanDiscussionView 富交互复杂度 | Day 4 延期 | 先 MVP 气泡列表 + 插话输入框；球队色标签沿用 `#1B5E20` 品牌色 |
| moderator RBAC 权限遗漏 | 非管理员可 hide 内容 | T011 admin-reports 契约测试 + T021 API 限 moderator/admin |
| 跨模块 Conversation 回归冲突 | 002/003 Stats/Scout/Tactical 对话失败 | T027 显式回归 conversations 契约测试 |

---

## Sprint 总览

| Sprint | 目标 | 任务数 | 总工时 | HV 节点数 | 关键交付物 |
|--------|------|--------|--------|----------|-----------|
| 4 | Fan Agent 社区讨论 + 内容治理（US1） | 27 | ~27h | 2 | `/fan` 入口、讨论详情页、举报审核页、fan_discussion Feed、ContentModerationService |
