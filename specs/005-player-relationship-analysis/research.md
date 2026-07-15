# Research: 足球球员关系分析

**Date**: 2026-07-15  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## R1: CareerPlayer 与 003 Player 分表

**Decision**: 新建 `career_players` / `club_stints` / `national_team_stints` 等表与 `/api/career-players` API；**不消费、不修改** 003 `players` 与 `/api/players`。

**Rationale**:
- Spec External Dependencies 明确本 MVP 与 Scout 球员源（football-data.org）分离；合并 ID 映射留后续
- 003 Player 为阵容级身份；本 feature 需要多段 ClubStint、转会类型/费用、国家队段与 TM 外部 ID
- 多模块规约禁止在本 feature 静默改对端 data-model / contracts

**Alternatives considered**:
- **ALTER players 增加履历 JSON**：违反边界；污染 Scout 同步逻辑
- **仅存 TM ID 映射到 003 Player 再挂履历**：仍需改 003 或共享表归属不清；MVP 不必要

## R2: Transfermarkt 采集方式

**Decision**:
- 扩展 `scraper/`：新增 `transfermarkt_career.py`（或等价模块），CLI 子命令：
  - `search --q <name>` → JSON 候选列表（姓名、出生年、主要俱乐部、tm_id）
  - `profile --tm-id <id>` → JSON 基础信息 + 俱乐部履历段 + 国家队段（可得则含）
- Node `CareerDataAdapter` 通过既有 `scraper-runner.js` spawn CLI，解析 stdout JSON
- 按需触发：搜索未命中本地 / 分析前履历缺失或超过 TTL（默认 7 天）时同步
- 限流：进程内最小间隔 + 超时（搜索 15s / 详情 20s）；人机验证或 HTTP 失败 → 结构化错误上抛

**Rationale**: 仓库已有 Transfermarkt kader 爬取与 scraper-runner；履历页解析属于同源能力扩展，符合 adapter 模式（Constitution：业务不直连外部 HTML）。

**Alternatives considered**:
- **商业转会 API**：超出预算与 Out of Scope「非商业离线库」
- **纯 Node 重写爬虫**：重复维护 HTTP/指纹/限流栈
- **全库夜间预爬**：Spec Out of Scope；合规与规模风险高

## R3: 时间归一与关系判定规则

**Decision**（产品内一致规则，结果可标注精度）:

| 原始时间 | 归一起 | 归一止 | 精度标记 |
|----------|--------|--------|----------|
| 完整日期 YYYY-MM-DD | 当日 | 当日（若仅单日）或给定止日 | `exact` |
| 仅年月 YYYY-MM | 月初 | 月末（离队）或给定 | `month` |
| 仅年 YYYY | 该年-01-01 | 该年-12-31 | `year` |
| 赛季 YYYY/YY 或 YYYY-YY | 起始年-07-01 | 终止年-06-30 | `season` |
| 缺离队日 / 「至今」 | 加入归一起 | **分析当天 UTC 日期** | `open_ended`（展示「至今」） |
| 完全不可解析 | — | — | 该 stint **不参与**「成立」判定；相关关系结论 → `unknown`（无法判定） |

**俱乐部队友 / 国家队队友**：
- 同一 `club_id`（或国家队名规范化键）下，两段区间交集长度 > 0 日 → `established`
- 任一方缺失该类型履历 → `unknown` + reason
- 有完整段但无交集 → `not_established`

**Alternatives considered**:
- **仅按赛季字符串相等**：漏掉跨赛季真实交集
- **缺离队一律判无法判定**：过于保守，伤害「至今仍在队」样例

## R4: 转会关联与间接路径

**Decision**:
- **先后加盟同一球队** (`successiveSameClub`)：共享俱乐部且两段时间**无必须交集**（可首尾相接或先后）→ true + 依据摘要
- **直接转会关联** (`directTransferLink`)：仅当数据源字段可验证（如同俱乐部窗口内一人离队与另一人入队且 `transfer_type`/`notes` 明示关联；或 TM 提供对端球员引用）。**禁止推断式「顶替叙事」**。无可验证字段 → `false` + reason=`insufficient_source_fields`
- **间接路径**：二部图 `player — club — player`；节点边来自全库**已缓存**的 `club_stints`（分析时将两名主角履历纳入图后 BFS）
- BFS 最短路径，边数 = 关系距离；`maxHops` 默认 6（配置项）；超出或不可达 → `no_path`
- 直接队友最短典型路径：`PlayerA → Club → PlayerB`，距离 **2**
- 国家队节点 **MVP 不进入** 最短路径图（可选后续扩展）

**Rationale**: 对齐 Spec Assumptions（俱乐部连通为主、上限 6）；直接转会宁缺勿滥，避免荣誉/叙事类幻觉。

**Alternatives considered**:
- **Neo4j / SQLite 递归 CTE 存图**：对按需百级缓存过重；内存 BFS 足够
- **路径含国家队节点**：扩大图噪声；非 MVP 必需

## R5: 分析 API 与缓存快照

**Decision**:
- 规范球员 ID 序：`playerIdA < playerIdB`（字典序）写入缓存键，保证同一对重入一致
- `GET /player-pair-analyses/{playerIdA}/{playerIdB}`：若有未过期快照且两边履历 `synced_at` 未新于快照 → 直接返回；否则触发同步（若需要）+ 重算 + upsert 快照
- `POST /player-pair-analyses` body `{ playerIdA, playerIdB }`：强制刷新计算（仍写缓存）；用于「重试」
- 同一用户短时重复：返回同一 `analysisId` / 相同 `computedAt` 窗口内结论
- URL 前台使用用户选定顺序的 ID；服务端排序仅用于缓存键

**Rationale**: FR-002 可重入、Edge Case 重复提交减外压。

**Alternatives considered**:
- **仅 POST 无 GET**：刷新重入须再提交，体验差
- **无持久化快照**：限流下难保证 SC-001 10s

## R6: 前台可视化技术选型

**Decision**: Vue 3 组件 + **原生 SVG/CSS**：
- `RelationshipTimeline.vue`：双轨年份轴，共同区间高亮
- `RelationGraph.vue`：根据 `relationPath.nodes/edges` 做分层直角布局（球员层/俱乐部层），不做力导向物理引擎
- 加载/空/错误：`el-skeleton` / `el-empty` / `el-alert` + FreshnessBanner

**Rationale**: Constitution VI；当前仓库无 echarts/d3；US3 数据规模小（单路径 + 双人履历）。

**Alternatives considered**:
- **ECharts / Cytoscape**：交互强但新增依赖需 complexity 与体积成本；MVP 可后置
- **纯表格无图**：不满足 US3

## R7: 认证、指标与 AI 边界

**Decision**:
- 搜索与分析 API：`security: bearerAuth` + `requireAuth`；未登录 401，前台引导 `/login` 并回跳带 `playerIdA/B` 的目标 URL
- 指标：`career_sync_success` / `career_sync_failure`、`pair_analysis_latency_ms`、`pair_analysis_cache_hit`
- **不做** LLM 解读；后续若做：新建 `AiRelationshipService` + 外置 Prompt，输入仅限已入库结论，超时降级为结构化面板（FR-019）

**Alternatives considered**:
- **游客可完整分析**：与 Spec Edge Cases / Agent 类能力登录策略不一致

## R8: API 端点汇总

| Method | Path | 用途 |
|--------|------|------|
| GET | `/career-players?q=` | 本地+按需远端搜索，返回候选消歧字段 |
| GET | `/career-players/{playerId}` | 球员基础信息与履历摘要 |
| POST | `/career-players/{playerId}/sync` | 强制同步该球员履历（登录用户） |
| GET | `/player-pair-analyses/{playerIdA}/{playerIdB}` | 获取/计算关系分析（可重入） |
| POST | `/player-pair-analyses` | 强制重算并返回分析 |

## R9: 已解决的原「NEEDS CLARIFICATION」项

| 原未知项 | 决议 |
|----------|------|
| 采集方式 | R2：scraper CLI + CareerDataAdapter |
| 图库 / 路径引擎 | R4：内存二部图 BFS，无图数据库 |
| 可视化库 | R6：SVG/CSS 自研组件 |
| 与 003 Player 关系 | R1：分表，零契约改动 |
| 时间缺失规则 | R3：归一表 + unknown |
| AI | R7：MVP 不做 |
