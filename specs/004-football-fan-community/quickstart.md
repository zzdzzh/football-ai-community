# Quickstart: Fan Agent 与社区治理

**Date**: 2026-07-10  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Prerequisites**: [003-football-scout-tactical/quickstart.md](../003-football-scout-tactical/quickstart.md) 或 [002-football-stats-content/quickstart.md](../002-football-stats-content/quickstart.md) 已完成（MVP-2/3 可运行）

本地开发环境快速启动指南（Windows + PowerShell）。

## 前置条件

| 工具 | 版本要求 |
|------|----------|
| Node.js | 20 LTS |
| npm | 10+ |
| AI 服务 | OpenAI 兼容 API 凭证（与 MVP-1/2/3 相同） |
| 测试账号 | 普通 user + moderator/admin 各一（admin 由种子或手动 UPDATE role） |

## 1. 环境变量（可选新增）

`server/.env` 可追加：

```env
# 可选：Fan 续写轮次超时（毫秒，默认 30000）
# FAN_CONTINUE_TIMEOUT_MS=30000
```

> MVP-1/2/3 的 `AI_*`、`JWT_SECRET` 等保持不变。

## 2. 数据库迁移

```powershell
cd d:\work\football-ai-community\server; npm run db:migrate
```

预期应用 `007_fan_community.sql`，新增 fan_personas/fan_discussions/fan_discussion_turns/content_reports 等表及 Persona 种子。

## 3. 启动服务

```powershell
cd d:\work\football-ai-community\server; npm run dev
cd d:\work\football-ai-community\web; npm run dev
```

前台监听 `http://0.0.0.0:5173`。

## 4. 验证 Fan Persona 列表

```powershell
# 登录获取 token
$login = curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"your@email.com\",\"password\":\"yourpass\"}" | ConvertFrom-Json
$token = $login.token

curl "http://localhost:3000/api/fan-personas?league=PL" -H "Authorization: Bearer $token"
```

期望：返回 ≥2 条英超球队 Persona，含 displayName、teamName、styleTraits。

## 5. 验证 Fan Agent 模拟讨论

1. 浏览器登录 `http://localhost:5173/login`
2. 打开 `http://localhost:5173/fan`
3. 输入主题「曼联 vs 利物浦赛后谁更强」，选择 2 个不同球队 Persona
4. 点击「开始讨论」
5. 期望：60 秒内跳转 `/discussions/{discussionId}`，显示 ≥4 条交替 Persona 发言，每条带球队人格标签

或使用 API：

```powershell
curl -X POST http://localhost:3000/api/fan-discussions -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"topic\":\"曼联 vs 利物浦赛后\",\"personaIds\":[\"persona-man-united\",\"persona-liverpool\"]}"
```

## 6. 验证用户插话

在讨论详情页输入评论，或使用 API：

```powershell
curl -X POST "http://localhost:3000/api/fan-discussions/{discussionId}/turns" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"content\":\"我觉得利物浦中场控制更好\"}"
```

期望：用户评论出现在时间线；随后 1–2 条 Persona 回应参考用户观点且保持风格差异。

## 7. 验证内容过滤（FR-022）

```powershell
curl -X POST "http://localhost:3000/api/fan-discussions/{discussionId}/turns" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"content\":\"[测试人身攻击样例]\"}"
```

期望：HTTP 422，`code=content_policy_violation`，无新 turn 写入。

## 8. 验证举报与管理员隐藏（FR-030）

```powershell
# 用户举报某条 turn
curl -X POST http://localhost:3000/api/content-reports -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"targetType\":\"fan_discussion_turn\",\"targetId\":\"TURN_ID\",\"reason\":\"不当言论\"}"

# moderator 登录后 hide
$mod = curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"mod@example.com\",\"password\":\"modpass\"}" | ConvertFrom-Json
curl -X POST "http://localhost:3000/api/admin/content-reports/{reportId}/hide" -H "Authorization: Bearer $($mod.token)"
```

期望：被隐藏内容不再对公众展示；若隐藏整讨论，首页 Feed 不再出现该 fan_discussion 卡片。

## 9. 契约测试

```powershell
cd d:\work\football-ai-community\server; npm run test:contract
```

MVP-4 新增：`fan-discussions.test.js`、`content-reports.test.js`、`admin-reports.test.js`（tasks 阶段实现）。

## 10. Swagger 文档

合并后的 API 文档：`http://localhost:3000/api/docs`（实现阶段挂载 004 契约增量）。

## 11. 开发流程

1. 修改 `specs/004-football-fan-community/contracts/openapi.yaml`
2. `npm run test:contract` 红灯
3. 实现 `server/src/agents/fan-agent.js`、`services/`、`api/`
4. 契约测试绿灯
5. 前台对接 + **人工截图验收**（Fan 入口 → 讨论 → 插话 → 举报 → 管理员隐藏）

## 12. MVP-4 范围边界自检

- [x] 无用户私信/实时聊天 API
- [x] 无 Conversation agentId=fan 路径
- [x] 违规内容写入前拦截（单元测试覆盖）
- [x] 管理员 hide 后 Feed 过滤（契约测试覆盖）
- [x] 002 Stats / 003 Scout 功能回归仍正常

## 13. 人工 E2E 截图清单（L4）

| 节点 | 截图内容 |
|------|----------|
| Fan 初始态 | `/fan` Persona 多选 + 主题输入 |
| 讨论结果 | `/discussions/:id` ≥4 条 Persona 气泡 + 球队标签 |
| 插话交互 | 用户评论 + Persona 回应参考用户观点 |
| 违规拦截 | 提交违规文本后的提示弹窗 |
| 举报流程 | ReportDialog 提交成功 |
| 管理员审核 | `/admin/reports` 列表 + hide 操作 |
| Feed 联动 | 首页 fan_discussion 卡片 → 点击进入详情 |
