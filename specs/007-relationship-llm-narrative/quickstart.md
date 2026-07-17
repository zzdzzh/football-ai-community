# Quickstart: 关系分析 LLM 叙事解读

**Date**: 2026-07-17  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Prerequisites**: [001](../001-football-feed-mvp/spec.md) 可登录；[005](../005-player-relationship-analysis/spec.md) 关系分析可到达 `ready`；已配置 OpenAI 兼容模型（与既有 Stats/Content 相同通道）

本地开发环境快速启动指南（Windows + PowerShell）。

## 前置条件

| 工具 | 版本要求 |
|------|----------|
| Node.js | 20 LTS |
| npm | 10+ |
| 测试账号 | 普通注册用户（`user` 角色） |
| AI 配置 | `server/.env` 中既有 OpenAI 兼容密钥与 Base URL |
| 样例数据 | 至少 1 对分析已 `ready` 的履历球员 UUID |

> 本 feature **需要**可用的 AI API（与平台既有配置一致）。无密钥时仅能测鉴权/未就绪/Mock 单测，不能做真实叙事验收。

## 1. 数据库迁移

```powershell
cd d:\work\football-ai-community\server; npm run db:migrate
```

预期应用 `016_relationship_narratives.sql`，新增 `relationship_narratives`（及可选 `agent_profiles` 的 `relationship` 种子）。

## 2. 启动服务

```powershell
cd d:\work\football-ai-community\server; npm run dev
cd d:\work\football-ai-community\web; npm run dev
```

前台监听 `http://0.0.0.0:5173`。若改过后台代码，请**自行重启**后台（Agent 不代为重启）。

## 3. 登录并确认分析就绪

```powershell
$login = curl.exe -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"your@email.com\",\"password\":\"yourpass\"}" | ConvertFrom-Json
$token = $login.token

curl.exe "http://localhost:3000/api/player-pair-analyses/<idA>/<idB>" -H "Authorization: Bearer $token"
```

期望：`status` 为 `ready`，且含 `analysisId`、`computedAt`、`result`。

## 4. 生成关系叙事

```powershell
curl.exe -X POST "http://localhost:3000/api/player-pair-analyses/<idA>/<idB>/narrative" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{}"
```

期望：200，含 `narrativeText`、`aiGenerated=true`、`reused=false`（首次）、`analysisComputedAt` 与分析一致。  
未登录 → 401；分析未就绪 → 409；限流 → 429。

再次 POST（不带 force）期望 `reused=true` 且快速返回。

强制重生成：

```powershell
curl.exe -X POST "http://localhost:3000/api/player-pair-analyses/<idA>/<idB>/narrative" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"force\":true}"
```

## 5. 读取复用（GET）

```powershell
curl.exe "http://localhost:3000/api/player-pair-analyses/<idA>/<idB>/narrative" -H "Authorization: Bearer $token"
```

期望：与当前结论版本匹配的正文；无叙事 404。

## 6. 关系页人工主路径

1. 浏览器登录 `http://localhost:5173/login`
2. 打开已就绪分析页：`/relationships/{careerIdA}/{careerIdB}`
3. 在叙事区点击「生成关系解读」
4. 期望 60 秒内看到中文介绍，并有「由 AI 基于本页结构化结论生成」标识
5. 模拟失败（断网/错误密钥/Mock）：结构化结论仍完整，失败提示可见，可重试

## 7. 事实抽检（SC-001）

对 ≥5 对有明确关系、≥3 对无关联样例：核对叙事中的俱乐部/路径/队友主张均能在本页结构化结论中找到依据；不得出现结论中不存在的共同效力或荣誉断言。

## 8. 自动化测试

```powershell
cd d:\work\football-ai-community\server; npm test
cd d:\work\football-ai-community\server; npm run test:contract
```

期望：叙事相关 unit/contract PASS；AI 路径使用 Mock 适配器，不依赖真实外网。

---

## 验收记录（T020 · 2026-07-17）

| 步骤 | 结果 | 备注 |
|------|------|------|
| 1 迁移 016 | ✅ | `npm run db:migrate` 已应用；`agent_profiles.relationship` timeout=45000 |
| 2 启后台/前台 | ✅ | 后台 health:UP；前台人工 HV-1 已验收 |
| 3 分析就绪 | ✅ | 样例对 Messi↔Pedri 侧 `status=ready` |
| 4 POST 生成 | ✅ | 真实 `glm-4.7-flash` 成功（约 78s）；二次 POST `reused=true`（9ms / 8ms） |
| 4b 未登录 | ✅ | 401 |
| 5 GET 复用 | ✅ | 200，`reused=true`，正文长度 189 |
| 6 关系页主路径 | ✅ | HV-1 PASS（含 AI 标识；T014 成功/失败态互斥已修） |
| 7 SC-001 抽检 | ✅ | 见 `checklists/requirements.md` 验收附注 |
| 8 自动化测试 | ✅ | narrative unit+contract PASS（全量 491+） |
