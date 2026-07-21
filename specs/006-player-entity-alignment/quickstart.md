# Quickstart: 球员实体对齐

**Date**: 2026-07-17  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Prerequisites**: [001](../001-football-feed-mvp/spec.md) 可登录；[003](../003-football-scout-tactical/spec.md) 球员数据可查；[005](../005-player-relationship-analysis/spec.md) 关系页可打开；样例两侧具备相同 Transfermarkt ID

本地开发环境快速启动指南（Windows + PowerShell）。

## 前置条件

| 工具 | 版本要求 |
|------|----------|
| Node.js | 20 LTS |
| npm | 10+ |
| 测试账号 | 普通注册用户（`user` 角色） |
| 样例数据 | 至少 1 对：`players.transfermarkt_id` = `career_players.external_id`（且 source=transfermarkt） |

> 本 feature **不需要** AI API 密钥。

## 1. 数据库迁移

```powershell
cd d:\work\football-ai-community\server; npm run db:migrate
```

预期应用 `015_player_identity_links.sql`，新增 `player_identity_links`、`player_identity_conflicts`、`player_identity_align_runs`。

## 2. 启动服务

```powershell
cd d:\work\football-ai-community\server; npm run dev
cd d:\work\football-ai-community\web; npm run dev
```

前台监听 `http://0.0.0.0:5173`。若改过后台代码，请**自行重启**后台（Agent 不代为重启）。

## 3. 触发对齐（按需）

```powershell
$login = curl.exe -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"your@email.com\",\"password\":\"yourpass\"}" | ConvertFrom-Json
$token = $login.token

curl.exe -X POST http://localhost:3000/api/player-identity-links/align -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{}"
```

期望：JSON 含 `created` / `conflict` / `skipped` 计数；未登录 401。

内部批处理（若启用 Internal 密钥，按项目既有 internal 模式）：

```powershell
curl.exe -X POST http://localhost:3000/api/internal/player-identity-align -H "Content-Type: application/json" -d "{}"
```

## 4. 双向解析

```powershell
# 统计 → 履历
curl.exe "http://localhost:3000/api/player-identity-links/resolve?statsPlayerId=<stats-id>" -H "Authorization: Bearer $token"

# 履历 → 统计
curl.exe "http://localhost:3000/api/player-identity-links/resolve?careerPlayerId=<career-uuid>" -H "Authorization: Bearer $token"
```

期望：有映射时返回对端 ID、`matchBasis`、`confidence`、`status`；无映射 404；禁止编造。

## 5. 关系页跨域跳转（人工主路径）

1. 浏览器登录 `http://localhost:5173/login`
2. 打开已对齐双球员关系页：`/relationships/{careerIdA}/{careerIdB}`
3. 期望 30 秒内：
   - 已对齐者显示「统计域已关联」并可进入 `/players/{statsPlayerId}`
   - 未对齐者显示「暂未关联统计库」且**无**失效链接
4. 在统计入口页可见基础球员信息，并可进入 Scout 等统计域能力

## 6. 冲突样例（可选）

构造两名 `players` 行写入同一 `transfermarkt_id` 后再次 align：期望 `conflict ≥ 1`、无新 active 映射到该键，且 `player_identity_conflicts` 可查。

## 7. 自动化测试

```powershell
cd d:\work\football-ai-community\server; npm test -- --testPathPattern=player-identity
cd d:\work\football-ai-community\server; npm run test:contract -- --testPathPattern=player-identity
```

## 跨模块提示

若客户端需要在 003 Player JSON 中看到 `transfermarktId`，请切换到 **003** 完成 [tasks.md](../003-football-scout-tactical/tasks.md) 中 006 增补任务后再联调，勿在 006 内直接改 003 OpenAPI。
