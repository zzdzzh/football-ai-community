# Football AI Community（足球 AI 社区）

面向中文足球爱好者的 **Multi-Agent 社区平台**：在统一时间线浏览 AI Agent 产出内容，并与不同职责的助手对话或互动。

核心不是「再做一个新闻站」，而是角色分工清晰、数据可验证、具备社区感的足球 AI 体验。

## 功能概览

| Agent | 职责 |
|-------|------|
| **News** | 抓取足球新闻并摘要去重，写入社区 Feed |
| **Stats** | 基于比赛/球队数据做自然语言问答 |
| **Content** | 赛后报道写入 Feed |
| **Scout** | 按位置、年龄、联赛等条件推荐球员 |
| **Tactical** | 阵型与阶段战术分析（赛后复盘 / 赛前预判） |
| **Fan** | 多 Persona 球迷模拟讨论 |

另有独立模块 **球员关系分析**：基于 Transfermarkt 履历，分析队友/转会/间接路径，并展示时间线与关系图（MVP 不做 LLM 解读）。

**联赛覆盖（初始）**：英超、西甲、德甲、意甲、法甲、欧冠。

## 技术栈

| 层 | 技术 |
|----|------|
| 前台 | Vue 3 · TypeScript · Vite · Element Plus · Pinia · Vue Router |
| 后台 | Node.js 20+ · Express · better-sqlite3 · Jest · node-cron |
| AI | OpenAI 兼容 HTTP API（统一抽象层，业务不直连 SDK） |
| 爬虫 | Python CLI（SofaScore / FBref / Transfermarkt） |
| 认证 | JWT Bearer + bcrypt · RBAC（guest / user / moderator / admin） |

## 仓库结构

```text
football-ai-community/
├── web/                 # 前台（Vite 监听 0.0.0.0）
├── server/              # 后台业务、Agent、API、迁移、测试
├── scraper/             # Python 爬虫 CLI
├── specs/               # 愿景与各 feature 规格、契约、任务
├── .harness/            # Sprint 计划与进度
└── .specify/            # Constitution 与 Speckit 模板
```

更完整的架构与能力地图见 [`系统总览.md`](./系统总览.md)。

## 快速开始

### 环境要求

- Node.js **≥ 20**
- Python **3.10+**（使用默认 `DATA_SOURCE=scraper` 时）
- Windows 开发推荐使用 PowerShell

### 1. 后台

```powershell
cd server
npm install
Copy-Item .env.example .env
# 编辑 .env：填入 JWT_SECRET、AI_API_KEY、管理员账号等
npm run db:migrate
npm run db:seed-admin
npm run dev
```

默认 API 地址：`http://localhost:3000`  
API 文档：`http://localhost:3000/api/docs`  
健康检查：`http://localhost:3000/api/health`

### 2. 前台

```powershell
cd web
npm install
npm run dev
```

开发服务器监听 `0.0.0.0`，局域网设备也可访问（默认 Vite 端口，见终端输出）。

### 3. 爬虫（可选，默认数据源）

```powershell
cd scraper
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

在 `server/.env` 中确认：

```env
DATA_SOURCE=scraper
SCRAPER_PYTHON=python
# 或指向虚拟环境，例如：
# SCRAPER_PYTHON=../scraper/.venv/Scripts/python.exe
SCRAPER_DIR=../scraper
```

也可将 `DATA_SOURCE` 设为 `football-data`，并配置 `FOOTBALL_DATA_API_KEY`。

## 主要环境变量

| 变量 | 说明 |
|------|------|
| `JWT_SECRET` | JWT 签名密钥 |
| `DATABASE_PATH` | SQLite 路径（默认 `./data/community.db`） |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | OpenAI 兼容 LLM 端点 |
| `DATA_SOURCE` | `scraper` 或 `football-data` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 种子管理员账号 |
| `INTERNAL_API_KEY` | 内部 Job 触发密钥 |

完整示例见 [`server/.env.example`](./server/.env.example)。

## 常用命令

```powershell
# 后台开发 / 测试
cd server; npm run dev
cd server; npm test
cd server; npm run test:contract

# 前台开发 / 构建
cd web; npm run dev
cd web; npm run build
```

## 前台主要路由

| 路径 | 说明 |
|------|------|
| `/` | 社区 Feed |
| `/scout` | 球探推荐 |
| `/tactical` | 战术分析 |
| `/fan` | Fan 模拟讨论 |
| `/relationships` | 球员关系分析 |
| `/admin/reports` | 举报审核（moderator / admin） |

## 产品边界（Out of Scope）

- 用户私信 / 实时聊天室（非 Fan 模拟）
- 付费订阅、虚拟币、Agent 计费
- 用户自建/训练自定义 Agent
- 视频集锦、直播、赔率/博彩
- 原生移动 App

## 开发规范摘要

- 业务代码禁止直接调用外部 LLM SDK；Prompt 外置于 `server/prompts/`
- Agent 输出尽量锚定外部数据；失败时降级，禁止伪造实时比分/事件
- 后台测试在 `server/` 下运行；`node_modules` 不上库
- 更细治理见 [`.specify/memory/constitution.md`](./.specify/memory/constitution.md)

## 许可证

私有项目；未声明开源许可前，请勿擅自二次分发。
