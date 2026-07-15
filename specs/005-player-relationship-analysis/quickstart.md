# Quickstart: 足球球员关系分析

**Date**: 2026-07-15  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Prerequisites**: [001-football-feed-mvp](../001-football-feed-mvp/spec.md) 可运行（注册/登录）；Python 3.11+ 可用于 `scraper/` career CLI（真实采集验收时）

本地开发环境快速启动指南（Windows + PowerShell）。

## 前置条件

| 工具 | 版本要求 |
|------|----------|
| Node.js | 20 LTS |
| npm | 10+ |
| Python | 3.11+（真实 Transfermarkt 同步时） |
| 测试账号 | 普通注册用户（`user` 角色） |

> 本 MVP **不需要**额外 AI API 密钥（无 LLM 解读）。

## 1. 环境变量（可选）

`server/.env` 可追加：

```env
# 履历缓存 TTL（天，默认 7）
# CAREER_SYNC_TTL_DAYS=7
# 间接路径最大跳数（默认 6）
# RELATIONSHIP_MAX_HOPS=6
# 单次外部同步超时毫秒（默认 20000）
# CAREER_SYNC_TIMEOUT_MS=20000
```

> MVP-1 的 `JWT_SECRET` 等保持不变。

## 2. 数据库迁移

```powershell
cd d:\work\football-ai-community\server; npm run db:migrate
```

预期应用 `014_player_relationship.sql`，新增 `career_players`、`career_clubs`、`club_stints`、`national_team_stints`、`player_pair_analyses`。

## 3. 启动服务

```powershell
cd d:\work\football-ai-community\server; npm run dev
cd d:\work\football-ai-community\web; npm run dev
```

前台监听 `http://0.0.0.0:5173`。

## 4. 验证球员搜索

```powershell
$login = curl.exe -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"your@email.com\",\"password\":\"yourpass\"}" | ConvertFrom-Json
$token = $login.token

curl.exe "http://localhost:3000/api/career-players?q=Messi" -H "Authorization: Bearer $token"
```

期望：返回候选数组；多名时含出生年或俱乐部消歧线索。未登录应 401。

## 5. 验证关系分析（人工主路径）

1. 浏览器登录 `http://localhost:5173/login`
2. 打开 `http://localhost:5173/relationships`
3. 分别搜索并**显式选择**两名球员（如测试 fixture：梅西 / 苏亚雷斯）
4. 提交后进入 `/relationships/{playerIdA}/{playerIdB}`
5. 期望（本地已有完整俱乐部履历时 10 秒内）：
   - 俱乐部队友结论与共同俱乐部（如 FC Barcelona）及共同时段
   - 数据新鲜度摘要可见
   - 时间线 / 关系图与文字结论一致（US3）

强制重算 API：

```powershell
curl.exe -X POST http://localhost:3000/api/player-pair-analyses -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"playerIdA\":\"<uuid-a>\",\"playerIdB\":\"<uuid-b>\"}"
```

可重入：

```powershell
curl.exe "http://localhost:3000/api/player-pair-analyses/<uuid-a>/<uuid-b>" -H "Authorization: Bearer $token"
```

## 6. 外部源失败降级（建议手工）

在无网络或禁用 scraper 时：对已有缓存球员对仍应返回分析，且 `dataFreshness.usedCacheOnly=true`（或等价摘要）；无缓存时友好失败与重试，无虚构共同效力。

## 7. 后台测试

```powershell
cd d:\work\football-ai-community\server; npm test
cd d:\work\football-ai-community\server; npm run test:contract
```

关注：`time-normalize`、`relationship-analysis`、`career-players` / `player-pair-analyses` 契约套件。

## 8. 人工验收检查清单（摘要）

| 项 | 预期 |
|----|------|
| 重名消歧 | 未选手动前不可提交分析 |
| 自关联 | 同一 ID 两次 → 友好错误 |
| 间接路径 | 无直接队友样例返回可验证最短路径或明确无路径 |
| 可视化零矛盾 | 抽检 ≥5 对有关系、≥3 对无关系 |
| 导航 | App 布局出现关系分析入口；URL 含双 ID |

## 边界提醒

- **不要**用 `/api/players`（003 Scout）代替 `/api/career-players`
- 修改 003 Player 契约须先到 003 `tasks.md` 增补任务
- 需要重启后台时，由人工执行，Agent 不自行重启
