<!--
Sync Impact Report
- Version change: (template placeholders) → 1.0.0
- Bump rationale: 首次从 Harness 增强模板填充为项目专属宪法（初始批准）
- Modified principles:
  - [ARCHITECTURE_PRINCIPLE] → I. 前后端分离架构
  - [CONTRACT_PRINCIPLE] → II. 契约优先
  - [EXTERNAL_SERVICE_PRINCIPLE] → IV. AI/LLM 外部服务治理
  - [SECURITY_PRINCIPLE] → VII. 安全与权限
  - [VISUAL_QUALITY_PRINCIPLE] → IX. 用户界面视觉质量标准
- Added sections: 项目技术约束（完整填充）、多模块协作规约
- Removed sections: 无
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ updated
  - .specify/templates/spec-template.md ✅ updated
  - .specify/templates/tasks-template.md ✅ updated
  - .cursor/rules/constitution.mdc ⚠ pending（已与宪法一致，无需结构性修订）
- Deferred TODOs: 无
-->

# Football AI Community（足球 AI 社区）Constitution

## Core Principles

### I. 前后端分离架构 (Frontend-Backend Separation)

本项目 MUST 采用前后端分离架构，前后端通过 HTTP API 通信，禁止在单一运行时内混合渲染与业务逻辑。

**硬约束**:

- 前台 MUST 使用 Vue 3 + Element Plus + Vite，开发服务器 MUST 监听 `0.0.0.0`（IPv4），以支持局域网调试
- 后台 MUST 使用 Node.js，服务代码 MUST 位于 `server/` 目录
- 数据存储 MUST 使用 SQLite，通过 `better-sqlite3` 访问；安装 `better-sqlite3` MUST 与业务代码变更分离执行
- 后台测试（Jest 等）MUST 在 `server/` 目录下运行
- 开发调试环境为 Windows；脚本 MUST 使用 PowerShell（命令分隔用分号 `;`，禁止使用 `&&`）
- `node_modules` MUST 加入 `.gitignore`，禁止提交到版本库
- 前台页面 URL MUST 携带决定该页面的核心 ID，以支持重入与面包屑导航

**理由**: 前后端分离降低耦合、便于独立部署与测试；目录与工具链约束消除环境差异导致的隐性成本。

### II. 契约优先 (Contract-First)

所有对外 API MUST 先定义 OpenAPI 规范，再实现代码；契约变更顺序 MUST 为「先规范、后实现、再测试」。

**硬约束**:

- 每个 feature 的 API 契约 MUST 存放在 `specs/<feature>/contracts/` 目录
- 每个对外 API MUST 有对应的契约测试（contract test）
- 接口实现 MUST 与契约文件完全一致；契约 drift 视为 L2 FAIL
- 多模块场景下，若 spec 指示参考其他模块的接口或数据模型，MUST 直接引用该模块的 `data-models.md` 与 `contracts/` 内容，禁止在本模块内私自修改对端定义
- 若必须修改对端模块的契约或数据模型，MUST 在对端模块的 `tasks.md` 中增补修改任务，并提示切换到该模块完成，禁止跨模块静默改动

**理由**: 契约优先确保接口变更可追溯、可测试，避免实现与文档漂移；多模块规约防止边界侵蚀。

### III. 测试纪律 (Test Discipline)

所有业务关键路径 MUST 有自动化测试覆盖。

**硬约束**:

- 核心业务逻辑 MUST 有单元测试；接口与模块边界 MUST 有集成测试或契约测试
- 以下高风险关键路径 MUST 达到 **100% 分支覆盖**：
  - 用户认证与授权（登录、会话、权限校验）
  - 用户数据读写与隐私保护
  - AI/LLM 调用与内容生成
  - 社区内容发布、编辑与审核
  - 积分 / 计费逻辑（若存在）
  - SQLite 事务与数据完整性保障
- 测试 MUST 可在 CI 环境中独立运行，不依赖外部服务（通过 Mock / Stub 替代）
- 后台测试命令：`cd server; npm test`（或项目约定的等价命令）

**理由**: 自动化测试是质量门禁的基础；高风险路径的 100% 分支覆盖防止权限、数据与 AI 调用类缺陷漏检。

### IV. AI/LLM 外部服务治理 (External AI Service Governance)

所有 AI/LLM 及第三方外部依赖 MUST 通过统一抽象层访问，业务代码禁止直接调用外部 SDK。

**硬约束**:

- 业务代码 MUST NOT 直接调用 LLM SDK 或第三方 HTTP 客户端访问 AI 服务
- MUST 定义统一的业务语义接口（如 `AiContentService`、`AiAnalysisService`），由适配层封装具体提供商
- Prompt 模板 MUST 外置管理（独立文件或配置目录），禁止硬编码在业务逻辑中
- 所有外部 AI 调用 MUST 配置超时控制；失败时 MUST 返回降级结果（友好错误提示或缓存内容），禁止向用户暴露内部堆栈
- 每次 AI 调用 MUST 记录：模型名称、token 数、耗时、成功/失败状态

**理由**: 抽象层隔离提供商变更、统一超时与降级策略，避免业务代码与外部服务强耦合。

### V. 可观测性优先 (Observability First)

**硬约束**:

- 每条 API 请求 MUST 记录结构化日志，至少包含：请求 ID、用户 ID、耗时、HTTP 状态码
- MUST 通过项目指标系统暴露以下业务指标：
  - API 响应时间（p50 / p95）
  - API 错误率
  - 外部 AI 服务调用成功率
  - 关键业务事件计数（注册、发帖、AI 生成请求等）
- 错误 MUST 有唯一追踪 ID，支持从用户界面错误追溯到服务日志

**理由**: 结构化日志与指标是生产问题定位与容量规划的基础。

### VI. 简单优先 (Simplicity / YAGNI)

**硬约束**:

- MUST NOT 预防性引入「将来可能用得上」的框架、中间件或运行时组件
- 每次引入新依赖 MUST 在对应 `plan.md` 的 Complexity Tracking 中记录理由
- MUST 优先选择简单、直接的实现，除非测量出性能瓶颈
- 单个方法 MUST NOT 超过 50 行；单个文件 MUST NOT 超过 500 行（横切基础设施文件除外，须在 plan 中说明）

**理由**: YAGNI 防止过度工程；复杂度记录使引入决策可审计。

### VII. 安全与权限 (Security & Access Control)

**硬约束**:

- 认证机制：JWT Bearer Token（`Authorization: Bearer <token>`）
- 授权模型：RBAC，角色清单 MUST 包含：
  - `guest`（游客）：只读公开内容
  - `user`（注册用户）：发帖、评论、使用 AI 功能
  - `moderator`（版主）：内容审核、封禁用户
  - `admin`（管理员）：系统配置、用户管理
- 所有受保护 API MUST 进行身份验证 + 权限检查；未授权请求 MUST 返回 401/403，禁止静默降级为匿名访问
- MUST NOT 存储明文密码；密码 MUST 使用 bcrypt 或等价强哈希
- MUST NOT 向客户端暴露内部异常堆栈或数据库错误详情
- 生产环境全链路 MUST 使用 HTTPS
- 用户级数据隔离：每个用户 MUST 只能访问自己有权限的数据记录（按 user_id 过滤）
- 所有安全相关事件（登录失败、权限拒绝、敏感操作）MUST 记录审计日志

**理由**: 社区平台涉及用户生成内容与 AI 能力，认证授权与数据隔离是底线要求。

---

**以下 5 条为 Harness 框架增强原则，强烈建议保留。**

### VIII. 用户界面可视化验证 (User Interface Visual Verification)

用户界面任务的验证 MUST NOT 仅依赖静态检查或编译结果（编译通过 ≠ 功能可用）。本项目前台 E2E 验证 MUST 使用**人工测试**（不使用 Playwright 自动化），并留存截图与交互记录供视觉审查。

**交互断言层**:

- 含用户界面交互的任务，L1 验证 MUST 包含人工测试截图 + 交互断言记录
- 每个用户界面批次完成后的门禁 MUST 包含人工可视化回归检查
- 同一可交互元素 MUST 测试**所有可点击区域**（图标 / 文字 label / 空白区域）
- 前台 bug 修正后 MUST 停止自动化验证，等待人工确认后再标记完成

**截图视觉审查层**:

- 人工测试 MUST 在关键节点截图（初始态、操作后、弹窗、结果页）
- 截图 MUST 经视觉审查确认（人工审查为主）；**断言通过但截图异常视为 FAIL**
- 审查 MUST 覆盖页面四角和边缘控件（关闭按钮、滚动条、角标）

**深度点击子页层**:

- 「顶层 URL 巡检 PASS」≠ 「用户真实路径 PASS」
- 每个 User Story 的人工测试 MUST 有至少一条路径是「从父页用户动作进子页」，**禁止**直接打开子页绕过真实路径
- 到达子页后 MUST 验证：(a) 主体内容区渲染 (b) 所有接口调用状态 (c) 至少点 1 个子交互

**涉真实外部服务（AI/LLM / 第三方服务）时的实物验收**:

- L4 Checkpoint 审查员 MUST 启动完整栈至少 1 次 · 不能纯看 progress.md 数字
- 至少 1 次真实外部调用端到端走查 SUCCEEDED（本地凭证可完成的场景不可 DEFERRED）
- 浏览器肉眼打开用户界面页面 · 截图存证 ≥ 2 张
- Mock / fixture 模式人工测试通过 ≠ 真实用户界面验收 PASS

**理由**: 社区产品体验依赖真实交互路径；人工 E2E 在当前阶段比自动化更能捕捉视觉与流程问题。

### IX. 用户界面视觉质量标准 (UI Visual Quality Standards)

用户界面页面 MUST 不仅功能正确，还须满足专业级视觉质量。

**硬约束**:

- **布局**: 内容区最大宽度约束（建议 `max-width: 1200px`）+ 8px 基线网格；响应式 MUST 支持桌面（≥1200px）与移动（<768px）双断点
- **视觉层次**: 清晰的焦点和阅读动线（标题 → 核心内容 → 操作区）
- **品牌色**: `#1B5E20`（主色 / 足球绿）/ `#FFFFFF`（辅色）/ `#FFD700`（强调色）/ `#4CAF50`（成功色）区分语义
- **状态设计**: 空状态、加载态、错误态 MUST 有专门的视觉设计，禁止留白
- **交互反馈**: hover / active MUST 有视觉反馈（颜色、阴影、位移）；表单错误态、弹窗居中 MUST 有明确视觉表现
- 多行配置界面（可增删改的配置行）MUST 使用 label 置于输入框上方的方式，以节约列宽
- 组件布局 MUST 验算宽度，避免宽度不足导致布局错乱
- 自动化生成的页面 MUST 经过设计审查，不能只是「能用」

**理由**: 社区产品的留存依赖良好的视觉体验；布局与状态规范防止「能用但难看」的交付。

### X. Corrector 修正回归纪律 (Corrector Regression Discipline)

每轮 Corrector 修正 MUST NOT 只验证「原 bug 是否修好」，必须同时验证「修正是否引入新问题」。

**硬约束**:

- 每轮修正后，MUST 对修改涉及的组件做**完整交互路径回归**
- 修改第三方用户界面组件行为前，MUST 先理解该组件的 DOM 结构和事件传播机制；禁止盲目套用 `.stop` / `preventDefault`
- 修正引入的新问题视为同一轮次的 FAIL，MUST 在当前轮次内一并解决，不消耗额外修正轮次
- 最多 3 轮修正，超过则人工介入
- 所有 BUG 修复 MUST 追溯到 `tasks.md` 中的任务 ID；修复前 MUST 将相关任务标记为未完成，修复后重新标记完成；提交信息 MUST 包含任务 ID

**理由**: 局部修复常引入回归；完整路径回归与轮次纪律防止修一个坏三个。

### XI. 模块边界纪律 (Module Boundary Discipline)

「焦点 / 出范围」MUST 是结构化数据驱动的硬约束，不是 prose 文档。Spec 之间的实体消费 MUST 显式申报，反向依赖 MUST 自动验证。

**结构化 scope（强制）**:

- 每个 Sprint MUST 有一份 `.harness/scope/sprint-<N>.yaml`，按 `.harness/scope/_template.yaml` 的 schema 声明 `in_scope` / `out_of_scope` / `dependency_rules`
- `.cursor/rules/constitution.mdc` 里的「焦点 / 出范围」叙述 MUST 与该 yaml 一致 · 叙述不是约束源 · yaml 才是
- yaml 修订 MUST PR + 评审，与 Constitution 修订同等级别

**反向依赖禁令**:

- in_scope 模块**不得依赖 / 引用** out_of_scope 模块（默认 severity=error）
- out_of_scope 模块本 Sprint 内**不得新增**对 in_scope 的依赖 / 引用（severity=warning · 检测到说明出范围模块在被悄悄改）
- 历史遗留违规登记到 yaml 的 `known_violations` · 列出后允许冻结，但**禁止扩大**：同一 (from, to) 的文件清单只能减少不能增加
- 横切关注点（`*ExceptionHandler` / `*Aspect` / `*EventListener` / `*Configuration` 等）天然跨模块引用是合理设计 · scope.yaml `cross_cutting_exempt` 列出豁免规则。豁免不是「忽略」 —— sensor 仍报 INFO 让其可见，不阻断 L2 但记入 Checkpoint 长期趋势

**跨 spec 实体消费的显式申报**:

- spec 模板的 "External Dependencies" 段 MUST 列出本 feature 消费的其他 spec 的实体 / 服务 / 事件（producer-consumer 关系）
- data-model.md 的每个数据模型对象 MUST 填 "Consumed By" · 如果 consumer ≠ owning feature · 模块归属在 plan 阶段就要重新讨论 · 不是事后审计

**自动化 sensor**:

- L2 验证（evaluator.md §2.4）MUST 运行 boundary-reviewer · 对照 scope.yaml 输出违规清单
- 任一 error 级违规 → L2 FAIL → 触发 Corrector 或升级 scope
- warning 级违规 → 不阻断但记入 Checkpoint · 连续 2 个 Sprint 出现同一 warning MUST 升级处理

**与既有 plan-template "Scope 边界验证清单" 的关系**:

- 那张表是 **contract-level** 边界（「零 X 改动」承诺 vs 下游 schema drift）· 由人工填写
- 本原则是 **module-level** 边界（模块依赖图 vs scope.yaml 申报）· 由 sensor 自动验证
- 两层互补不替代：contract-level 防「我说零用户界面改动结果改了 schema」，module-level 防「我说出范围结果还在新增依赖」

### XII. Spec 颗粒度纪律 (Spec Sizing Discipline)

一个 spec 太大会沿流程链放大：spec 大 → plan 重 → tasks 膨胀 → 单 sprint 装不下 → 质量妥协。Sprint 颗粒度问题的根因在 spec 阶段，MUST 在最上游卡住。

**硬阈值（默认）**:

- 一个 spec 包含 **≤ 3 个 user story**（紧密耦合的小 story 可视为 1 个）
- 由 spec 派生的 sprint **≤ 30 个 task**
- 超阈值 MUST **在 specify 阶段拆分**，不允许「先这样写完再说」

**强制点**:

- `/harness.plan` Step 0：读 spec.md 数 user story；读 tasks.md（如存在）数 task。任一超阈值 → **阻断 sprint plan 生成** · 提示走拆分流程
- `/harness.spec-check <spec-id>`：独立审计命令，可以在 spec 完成后任意时刻跑

**超阈值的 3 选 1 处理**（不允许「再加几个 task 就好」绕过）:

1. **拆 spec**（推荐）· 按 user story 边界切成 N 个独立 spec，依次走 specify → plan → tasks
2. **合并 user story**（仅当几个 story 真正紧密耦合，独立交付不构成完整价值）
3. **升级 justification**（仅当确实有不可拆分的根本理由 · 必须在 spec 末尾显式声明，并对应增大 sprint 容量预估）

**与 SDD 上游 speckit 的关系**:

- 不修改 speckit 上游命令（specify / plan / tasks）—— 保留上游同步能力
- 强制点全部加在 harness 命名空间（`/harness.plan` / `/harness.spec-check`）

---

## 项目技术约束

- **服务 / 核心运行时**: Node.js（`server/` 目录）
- **用户界面运行时**: Vue 3 + Element Plus + Vite（开发监听 `0.0.0.0:5173` 或项目约定端口）
- **数据存储**: SQLite + better-sqlite3
- **测试命令**: `cd server; npm test`（Jest）；前台 E2E 为人工测试，不使用 Playwright
- **构建命令**: `cd server; npm run build`（后台）；`npm run build`（前台，于前台根目录）
- **交互验证工具**: 人工测试（截图留存 + 交互断言记录）
- **脚本环境**: Windows + PowerShell
- **文件编码**: 所有生成文件 MUST 使用 UTF-8，禁止使用 GBK / GB2312
- **文档语言**: 项目文档与 Agent 回答 MUST 使用中文

## 开发工作流

### 代码规范

- 所有源文件 MUST 使用 UTF-8 编码
- 后台 MUST 配置 ESLint；前台 MUST 配置 ESLint + Vue 推荐规则
- 遵循现有代码风格；新增命名约定 MUST 写入 Constitution 或 `plan.md`
- 任务完成后 MUST 用 checkbox 语法标记：`- [ ]` → `- [x]`
- 任务文件为各 feature 目录下的 `tasks.md`；`plan.md` 是方案文件；`data-models.md` 是数据模型；`contracts/` 是契约目录
- 需要重启后台时，Agent MUST NOT 自行重启，须通知用户手动重启
- 重复遇到同一错误两次时，MUST 调研 3–5 种修复方案后选择最高效方案实施

### 分支策略

- 主分支保护，通过 PR 合并；CI MUST 运行编译、lint 与测试
- 功能分支命名遵循 speckit 格式：`NNN-feature-short-name`（由 `/speckit.specify` 自动创建）

### 代码评审

- 所有变更 MUST 经过至少一人评审
- 涉及 AI 调用 / 认证 / 权限 / 数据一致性 / scope.yaml 的变更 MUST 两人评审
- 评审重点：是否违反 Constitution 原则、是否有安全隐患、是否有充分测试

## Governance

本 Constitution 是项目的最高级技术治理文件，所有实现决策 MUST 与其保持一致。

- 所有 PR 评审 MUST 检查是否符合 Constitution 原则
- 引入新的复杂度（新依赖、新架构模式、新运行时组件）MUST 在 `plan.md` 中记录理由
- 修订 Constitution MUST 提交 PR 并经过团队评审，附带修订说明和影响分析
- 版本管理采用语义化版本：
  - **MAJOR**: 原则删除或重定义（向后不兼容的治理变更）
  - **MINOR**: 新增原则或章节、实质性扩展指导
  - **PATCH**: 措辞澄清、错别字修正、非语义性精炼
- 每次修订 MUST 在文件顶部 HTML 注释块内提供 Sync Impact Report（版本变化、原则改动、下游模板影响、TODO）
- 每个迭代周期结束时 MUST 进行一次 Constitution 合规回顾（Harness Checkpoint）
- 若发现 Constitution 与当前实现存在 gap，MUST 在 PR 中说明并提议修订，禁止临时破例

**Version**: 1.0.0 | **Ratified**: 2026-07-10 | **Last Amended**: 2026-07-10
