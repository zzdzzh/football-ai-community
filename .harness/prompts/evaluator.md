# Evaluator Prompt 模板 — 质量验证

## 使用方式

每个任务完成后，用对应的验证模板检查质量。不通过的项进入 Corrector 流程。

---

## 四级验证体系

### Level 1: CI 验证（自动化流水线，必须全部通过）

模拟 CI/CD 流水线的自动化检查。L1 不通过则阻断，不得进入 L2。

```
## CI 自动化验证

对刚才生成的代码执行以下 CI 流水线检查，按顺序执行，任一步失败则整体 FAIL：

### Step 1: 单元测试（门禁）

这是 CI 的第一道关卡。测试不通过，后续步骤不执行。

- [ ] [TEST_COMMAND] — 所有相关自动化测试 PASS
- [ ] 本次任务涉及的业务逻辑必须有对应测试文件（TDD 产出）
- [ ] 测试失败数 = 0

**阻断规则**: 任务含业务逻辑但无测试文件 → 直接 FAIL，不是"遗漏"而是"未完成"。

### Step 2: 构建 / 类型检查

- [ ] [BUILD_COMMAND] — 构建或编译通过
- [ ] [TYPECHECK_COMMAND] — 类型或接口静态检查通过（如适用）

### Step 3: Lint / 代码规范

- [ ] [LINT_COMMAND] — 无 ERROR（WARNING 可按项目约定记录）

### Step 4: 应用启动 + 集成验证

构建通过 ≠ 能启动，启动成功 ≠ 功能可用。此步验证应用在真实运行环境中能启动，
并且跨运行时的真实接口调用链能跑通。

#### 4.0 Pre-flight: 运行态新鲜度校对（强制，任一失败阻断后续 4a-4f）

验证"正在运行的服务"与"最新代码"一致，防止误把旧运行实例当成代码已生效。

**执行方式**:
- 执行项目约定的运行态新鲜度检查脚本，或等价校对流程。
- 如果项目没有脚本，至少校对运行实例启动时间、最近代码变更时间和构建产物时间。

**阻断规则**:
- 运行实例早于相关代码或构建产物 → STALE，必须重启后再进入 4a。
- 检查输出 STALE 且继续验证 → 视为 L1 Step 4 FAIL（流程违规）。
- 如果没有正在运行的服务，4.0 自动 PASS（4a 会拉起全新实例）。

#### 4a. 依赖服务启动

- [ ] 启动项目依赖服务（如适用）— [DATA_STORE] 和其他依赖服务健康
- [ ] 依赖连接验证通过（通过项目健康检查、日志或探测命令确认）

#### 4b. 应用或服务启动

- [ ] [APP_START_COMMAND] — 无异常退出
- [ ] 数据迁移或初始化成功（如适用）
- [ ] 应用健康检查为 UP 或项目定义的健康状态
- [ ] 接口契约或开发文档入口可访问（如适用）

#### 4c. 用户界面启动

- [ ] [UI_START_COMMAND] — 用户界面运行时启动成功
- [ ] 页面入口可访问

#### 4d. 接口集成验证

应用与用户界面都启动后，用真实请求验证已实现的接口调用链。

**验证范围**: 读取 [API_CONTRACT_ROOT] 中已实现的契约文件，
对每个端点或 operation 构造真实请求并验证响应。

**执行规则**:
1. 读取当前 Sprint 已实现的接口契约，提取所有端点或 operation
2. 对每个端点按契约定义构造请求（路径、方法、请求体、认证头）
3. 验证响应状态码和关键字段与契约一致
4. 必须包含正常路径和异常路径（如无认证、无权限、无效参数）
5. 需要认证的接口，使用项目真实认证流程、测试账号或 fixture 获取调用凭据

**验证结果记录到 Sprint 进度文件**，格式：
```
集成验证: {通过接口数}/{总接口数} PASS, 失败: {失败接口列表}
```

#### 4e. Spec 故事深度点击走查（Deep-walk，用户界面批次强制）

前面 4a-4d 是"横向"巡检，4e 做"纵向"深度点击——按 spec 用户故事从入口页面一路点到
子页 / 子组件 / 子交互，补齐路由巡检漏掉的盲区。

**动机**：顶层 URL 巡检只能验证路由挂载；用户真实路径是"进入入口页 → 点卡片/列表项 →
进入子页 → 触发聚合接口"。每次点击都可能触达一个没被 4d 契约扫描覆盖的端点。

**执行规则**：
1. 打开本 Sprint 对应 feature 的 spec.md，列出 User Stories
2. 每个 US 至少选一条 Acceptance Scenario 作为深度点击路径
3. 用 [E2E_TOOL]（或手动）按路径**真实点击**，不是 goto 到末端 URL
4. 每到达一个子页面验证 3 件事：
   - DOM 主体内容是否渲染（不止布局外壳）
   - Network 面板里该页触发的**所有**接口状态（不止主接口）
   - 至少点一个可交互元素，确认不是死链/空对话框

**阻断规则**：
- 任何子页进入后主体空白 → FAIL，定位是用户界面异常吞掉还是服务端响应异常
- 任何子页触发的接口出现 4xx/5xx → FAIL（哪怕用户界面兜底显示"加载失败"也要记录）
- Network 404/500 必须读取服务日志和 traceId（如有）定位根因，不允许"看起来还在"就放过

**记录方式**：在 Sprint 进度文件 / 报告里补"深度点击清单"，格式：
```
深度点击: {US1 路径} → {US2 路径} → ... | 子页接口状态: {列表}
```

#### 4f. 真实外部服务 + 用户界面实物验收（涉真实外部服务或用户 UI 的 feature 强制）

前面 4a-4e 只能证明"启动起来"和"路径可达"，
**不能证明真实外部服务下用户看到的界面真的有内容**。4f 是防"假收官"的硬阻断。

**触发条件**（任一成立即 4f 硬约束）:
- Feature 涉及 [EXTERNAL_SERVICE_NAME] 真实服务场景
- Feature 有最终用户可见 UI 页面
- Spec 里含以"用户端到端看到 X"形式表述的 Acceptance Scenario

**执行规则**（4f.1 - 4f.5 顺序，一条失败即 FAIL）:

1. **4f.1 完整运行环境启动**：[APP_START_COMMAND] + [UI_START_COMMAND] + 必要依赖服务同时 UP
2. **4f.2 外部服务切真实模式**（若适用）：按项目现有开关或环境约定启用真实服务调用，并用诊断方式确认
3. **4f.3 至少 1 次真实外部服务端到端走查成功**：用户或执行代理实际触发一次真实调用，
   拿到 runId / traceId / response 片段等可审查证据
   - 禁止 DEFERRED：如果本地凭证可加载，就必须跑
   - 允许 DEFERRED 的唯一情形：本地凭证真的不存在（需显式验证）· 此时 Constitution VIII 自动扣 1 CONDITIONAL
4. **4f.4 浏览器肉眼验收**：打开 feature 关联 UI 页面 · 肉眼确认：
   - 关键字段有内容（不空白）
   - 数据和接口 response 一致（用真实请求对照 DOM）
   - 保存截图 ≥ 2 张到项目约定的 E2E 截图目录，供证据链审查
5. **4f.5 反向契约验证**（如涉 mock/fixture 模式）：grep feature 指定的 mock/fixture 标识 ·
   期望真实服务走查后返回 0 命中 · 命中即代表走了 mock/fixture · FAIL

**阻断规则**:
- 4f.3 任一失败 → L1 Step 4 FAIL · 不允许进 Level 2
- 4f.4 UI 空白或字段缺失 → FAIL · 追查是接口没返字段还是用户界面没渲染
- 本地凭证可用却未跑 4f.3 直接宣告收官 → 视为流程违规

#### 触发时机

不是每个任务都跑，在以下时机执行：
- 每个批次（Batch）完成后 — **通过 progress.md 中的 🚧 批次门禁行强制触发**
- Sprint Checkpoint 时
- 涉及配置、迁移、认证、权限或安全的任务完成后

**强制执行机制**: progress.md 中每个批次末尾有 `🚧 批次门禁` 行。
harness.exec 定位下一个 `[ ]` 时，如果遇到门禁行，必须先完成 Step 4 验证并标记通过，
才能继续后续任务。门禁行不可跳过。

#### 阻断规则

- 4.0 Pre-flight STALE → FAIL，必须先重启服务再继续
- 4a/4b/4c 任一失败 → FAIL，进入 Corrector
- 4d 集成验证失败 → FAIL，需要定位是用户界面、服务/核心、契约还是配置问题后修复
- 4e 深度点击任何子页主体空白 / 子接口 4xx/5xx → FAIL
- 4f 真实服务未跑（凭证可用却 DEFER）/ 用户界面空白 → FAIL
- 启动和集成问题是单元测试和构建无法发现的，必须通过真实调用验证

### CI 结果

| 步骤 | 结果 | 详情 |
|------|------|------|
| 单元测试 | ✅/❌ | {通过数}/{总数}，失败: {列表} |
| 构建/类型检查 | ✅/❌ | [BUILD_COMMAND] / [TYPECHECK_COMMAND] |
| Lint | ✅/❌ | ERROR: {n}, WARNING: {n} |
| Pre-flight (4.0) | ✅/❌/N/A | 运行态 FRESH/STALE |
| 应用启动 (4a-4c) | ✅/❌/N/A | health: {UP/DOWN}，migration: {N/A or V{N}} |
| 接口集成 (4d) | ✅/❌/N/A | 通过接口 {n}/{n} |
| 深度点击 (4e) | ✅/❌/N/A | US 路径 {n}/{n}，子页接口全部 2xx |
| **真实服务 + UI 实物 (4f)** | ✅/❌/N/A | **runId {xxx} success · UI 截图 {n} 张 · mock/fixture 标识命中 0** |

**整体判定**: 全部 ✅ → 进入 Level 2 / 任一 ❌ → 进入 Corrector
```

### Level 2: 契约与规格验证

L1 通过后，验证实现的正确性和完整性。

```
## 契约与规格验证

请检查刚才完成的任务 {任务ID} 生成的代码：

### 2.1 接口契约一致性
读取 [API_CONTRACT_ROOT]/[CONTRACT_FILE]，逐项检查：

| 检查项 | 契约定义 | 实际实现 | 一致? |
|--------|---------|---------|------|
| 端点路径 | | | |
| 方法 | | | |
| 请求参数 | | | |
| 响应字段 | | | |
| 错误码 | | | |

### 2.2 数据模型一致性
读取 [DATA_MODEL_DOC]，检查数据模型字段：

| 字段名 | 数据模型定义 | 实际实现 | 一致? |
|--------|--------------|----------|------|

### 2.3 用户故事覆盖
读取 `specs/[FEATURE_ID]/spec.md` 中 {US编号} 的验收场景，检查：

| 验收场景 | 是否有对应代码逻辑? | 位置 |
|---------|------------------|------|
| Given... When... Then... | | |

### 2.4 模块边界一致性

**触发条件**：本 Sprint 存在 `.harness/scope/sprint-<N>.yaml`。

**执行**：调用 boundary-reviewer sub-agent（`harness/prompts/boundary-reviewer.md`）。
Sub-agent 会：
1. 读 `.harness/scope/sprint-<N>.yaml`
2. 用 [DEPENDENCY_GRAPH_TOOL] 或项目等价工具构建依赖图
3. 对照 dependency_rules 与 known_violations 分级报告违规
4. 写入报告到 scope.yaml.metadata.report_path
5. 输出结构化 `BOUNDARY_REVIEWER_RESULT` JSON 块

**消费 boundary-reviewer 输出**：

```
BOUNDARY_REVIEWER_RESULT:
{
  "sprint": <N>,
  "score": <0-10>,
  "verdict": "PASS" | "FAIL" | "WARN",
  "errors": <count>,
  "warnings": <count>,
  "expansions": <count>,
  "report_path": "<路径>"
}
```

**判定**：
- verdict=FAIL（含任一 error 级违规 / 已知违规扩大）→ L2 FAIL · 进入 Corrector
- verdict=WARN（score < 7 但无 error）→ L2 PASS · 但记入 Checkpoint 扣分
- verdict=PASS → L2 PASS · score 进入 2.5 评分

**Corrector 处置规则**：收到 boundary FAIL 时必须 3 选 1，不允许绕过：
1. **解耦** · 拔掉 in-scope 对 out-of-scope 的引用（推荐）
2. **升级 scope** · 把 out-of-scope 模块改回 in-scope · 同步更新 spec / plan / scope.yaml
3. **登记 freeze** · 仅当成本太高、决定推迟到下个 Sprint · 在 scope.yaml 的 known_violations 显式登记 + Sprint Checkpoint 显式扣分

### 2.5 代码品味 + 心智模型 Peer Review

**触发条件**：本 task 有代码改动（diff 非空）。

**执行**：调用 peer-reviewer sub-agent（`harness/prompts/peer-reviewer.md`）。
Sub-agent 会：
1. 读 git diff + CLAUDE.md + spec.md
2. 输出"给人看"段（4 段：意图 / 关键决策 / 关键文件 / 排查指引）+ "给系统看"段（must-fix / should-fix / suggestion）
3. 写盘 `.harness/reviews/<task-id>.md`（持久化心智模型，工程师以后能查）
4. 输出 `PEER_REVIEWER_RESULT` JSON

**消费 peer-reviewer 输出**：

```
PEER_REVIEWER_RESULT:
{
  "task_id": "<ID>",
  "score": <0-10>,
  "verdict": "PASS" | "FAIL" | "WARN",
  "must_fix": <count>,
  "should_fix": <count>,
  "suggestion": <count>,
  "sensor_gap": <count>,
  "report_path": ".harness/reviews/<task-id>.md"
}
```

**判定**：
- `verdict=FAIL`（含任一 must-fix）→ L2 FAIL · 进入 Corrector
- `verdict=WARN`（"排查指引"段空洞 或 should-fix > 3）→ L2 PASS · 但记入 Checkpoint 当代码品味扣分
- `verdict=PASS` → L2 PASS · score 进入 2.6 评分

**Sensor Gap 处理**：peer-reviewer 报告里若有 "Sensor Gap" 段，列入本 sprint Checkpoint 的 toolkit 改进信号 · 不计入本 task 评分。

**双观众输出的存档价值**：每个 task 一份 `.harness/reviews/<task-id>.md`。"排查指引"那段是工程师未来排查问题的入口——AI 写完代码 N 个月后 bug 出现时，工程师不用重新读代码，先读这份 review。

### 2.6 评分标准
对以下维度打分（0-10）：

| 维度 | 分数 | 说明 |
|------|------|------|
| 契约一致性 | /10 | 接口实现与契约定义的匹配度 |
| 模型一致性 | /10 | 数据模型实现与 [DATA_MODEL_DOC] 的匹配度 |
| 场景覆盖度 | /10 | 验收场景的覆盖完整程度 |
| 模块边界一致性 | /10 | boundary-reviewer 输出的 score（关联原则 XI） |
| 代码品味 | /10 | peer-reviewer 输出的 score（含心智模型质量） |
| 代码质量 | /10 | 可读性、命名、结构（lint / 编译相关） |

**通过门槛**: 每项 ≥ 7 分，总分 ≥ 48 分；且 boundary-reviewer 与 peer-reviewer 的 verdict 都 ≠ FAIL（任一 error 级违规 / must-fix 直接 L2 FAIL，无视总分）。
```

### Level 3: [E2E_TOOL] E2E 用户流程验证

```
## [E2E_TOOL] E2E 验证

对本次完成的用户故事，执行 [E2E_TOOL] 端到端测试，验证真实用户流程。

### 前置条件（强制，必须验证通过才能执行 E2E）

以下每项必须确认通过，否则 L3 直接判定 BLOCKED（不是 PASS 也不是 FAIL）：

- [ ] 项目依赖服务正常运行（如适用）
- [ ] [APP_START_COMMAND] — 应用或服务启动成功，健康检查通过
- [ ] [UI_START_COMMAND] — 用户界面启动，页面入口可访问
- [ ] 数据迁移或初始化已执行（如适用）

**阻断规则**: 前置条件不满足 → L3 状态为 BLOCKED，不得标记为 PASS 或 N/A。
E2E 只 mock 接口而跳过真实启动验证 → 不算完成 L3。

### 测试文件位置
`[TEST_ROOT]/e2e/{story-name}[TEST_FILE_SUFFIX]`

### 测试编写规则
1. 每个验收场景（Given/When/Then）对应一个 test case
2. 使用 Page Object 模式或项目既有交互抽象组织页面交互
3. 断言必须验证**用户可见的结果**（文字、状态、跳转），不是内部状态
4. 包含等待策略（等待选择器、响应或可观察状态），不使用固定 sleep
5. 截图：关键步骤自动截图保存到项目约定的 E2E 截图目录

### 当前用户故事验收场景

{从 spec.md 中粘贴对应用户故事的验收场景}

### 各 Sprint 的 E2E 测试范围

为每个 Sprint 按实际 [FEATURE_ID] 和用户故事列出：
- [ ] 用户入口路径
- [ ] 核心操作路径
- [ ] 异常/权限/空状态路径
- [ ] 关键反馈或结果展示路径
- [ ] 涉 [EXTERNAL_SERVICE_NAME] 时的真实服务证据路径

### 执行命令
```bash
使用项目约定的 [E2E_TOOL] 执行命令运行当前用户故事测试
```

### 评分标准

| 维度 | 分数 | 说明 |
|------|------|------|
| 场景覆盖度 | /10 | 验收场景被 E2E 测试覆盖的比例 |
| 断言质量 | /10 | 断言是否验证了用户可见的结果 |
| 稳定性 | /10 | 测试是否有 flaky 问题（重跑3次均通过） |

**通过门槛**: 所有 test case PASS，每项 ≥ 7 分

### L3.5: 视觉走查（用户界面页面/组件任务必须执行）

E2E 只验证功能（元素存在、可点击），不验证视觉效果。
视觉走查补充检查 UI 渲染质量，通过截图审查执行。

**执行方式**:
1. 用 [E2E_TOOL] 对每个关键页面状态截图（全屏 + 关键区域）
2. 对截图逐项检查以下清单
3. 也可由用户在浏览器中手动走查并反馈

**视觉检查清单**:

| 类别 | 检查项 |
|------|--------|
| 布局 | 无意外滚动条（横向/纵向溢出） |
| 布局 | 元素对齐正确，无重叠 |
| 布局 | 响应式布局在目标断点下正常 |
| 颜色 | 符合项目设计系统或 Constitution |
| 颜色 | 文字对比度足够 |
| 文字 | 无文字截断/溢出 |
| 文字 | 多语言或混排文本间距合理 |
| 交互 | hover/active 状态有视觉反馈 |
| 交互 | loading 和 empty 状态有占位展示 |
| 一致性 | 同类组件样式统一 |
| 一致性 | 间距和圆角遵循设计规范 |

**阻断规则**:
- 布局类问题（滚动条溢出、元素重叠）→ 必须修复，FAIL
- 颜色/文字/交互类问题 → 记录为 WARNING，不阻断但需在下个批次修复
```

---

### Level 4: Constitution 合规验证

#### L4 审查员实物验收前置条件

L4 Constitution Checkpoint **不能只看 progress.md 数字** · 必须执行实物验收：

1. **启动完整运行环境至少 1 次**：[APP_START_COMMAND] + [UI_START_COMMAND] + 必要依赖服务
2. **若 feature 涉 [EXTERNAL_SERVICE_NAME]**：
   - 本地凭证可加载 → 必须跑至少 1 次 [REAL_SERVICE_CHECK]，并拿到 success 证据
   - 本地凭证不可加载 → 显式声明 + 原则 VIII 自动扣 1 CONDITIONAL（不默认 PASS）
3. **若 feature 涉用户可见 UI**：浏览器打开关联页面 + 截图存证 ≥ 2 张
4. **若审查员（子代理 / 独立上下文）无法做以上**：必须显式声明"未执行实物验收"并对原则 VIII/X 扣分，不允许默认 PASS

违反以上任一 → L4 审查结果无效 · 需主审介入重跑。

#### 合规审查矩阵（按原则打分 · 诚实扣分）

```
## Constitution 合规验证

读取 `.specify/memory/constitution.md`，逐条检查本次代码变更是否合规：

| 原则 | 检查项 | 合规? | 备注 |
|------|--------|------|------|
| I. 架构边界 | 服务/核心、用户界面和其他运行时边界清晰 | | |
| I. 架构边界 | 跨边界通信仅通过项目定义接口 | | |
| II. 契约驱动 | 实现与接口契约一致 | | |
| II. 契约驱动 | 无契约中未定义的接口 | | |
| III. 测试纪律 | 高风险业务逻辑有要求的分支覆盖测试 | | |
| III. 测试纪律 | 新增接口有契约测试 | | |
| IV. 外部服务抽象层 | [EXTERNAL_SERVICE_NAME] 调用通过项目外部服务适配层 | | |
| IV. 外部服务抽象层 | Prompt/配置外置，不硬编码 | | |
| IV. 外部服务抽象层 | 有超时和降级处理 | | |
| V. 可观测性 | 接口请求有结构化日志 | | |
| V. 可观测性 | 外部服务调用有指标记录 | | |
| VI. 简单优先 | 无不必要的抽象/中间层 | | |
| VI. 简单优先 | 新依赖已在 Complexity Tracking 中记录 | | |
| VII. 安全合规 | 接口有认证和权限检查 | | |
| VII. 安全合规 | 敏感操作有审计日志 | | |
| VIII. 用户界面与真实服务验收 | 涉真实外部服务场景已跑至少 1 次 [REAL_SERVICE_CHECK] success（4f.3） | | 凭证可用却 DEFER 自动扣 1 |
| VIII. 用户界面与真实服务验收 | 涉用户 UI 已浏览器肉眼验收 + 截图 ≥ 2 张（4f.4） | | |
| VIII. 用户界面与真实服务验收 | Sprint 规划阶段 identify 的人工验证节点已全部签收 | | planner.md 强制 |
| VIII. 用户界面与真实服务验收 | Spec 边界声明未被打破（或已诚实扣分） | | |
| IX. 用户界面视觉 | 布局/间距/色板合规 | | |
| X. Corrector 纪律 | 本 Sprint Corrector 轮次计数完整 | | 非零 ≠ FAIL · 失控才 FAIL |
| X. Corrector 纪律 | 每轮 Corrector 严格走 /harness.fix（先审 spec + TDD + 实物验收） | | |

**合规结果**:
- 硬约束违反数: {n}（必须为0才能 PASS）
- 软约束违反数: {n}（记录理由即可）
- **总分计算**：全部核心原则 × 10 为满分 · 每原则按扣分项扣（诚实）· 得分率 ≥ 99% PASS · ≥ 95% CONDITIONAL · < 95% FAIL
```

#### Checkpoint 演进轨迹记录（必须）

若 Sprint 内 Checkpoint 经历过撤回 / 重跑，在 checkpoint.md 必须记录演进轨迹：
- 原判决（日期 + 得分 + 方法）
- 撤回原因（具体 SEV + 违反的原则）
- 重跑判决（基于实测证据 · 对比原判差异）
- 纪律沉淀（教训 → memory 或模板）

---

## 综合评审报告模板

```
## 任务评审报告: {任务ID}

### 概要
- **任务描述**: {描述}
- **执行时间**: {耗时}
- **文件变更**: {新增/修改的文件列表}

### 验证结果

| 验证层级 | 结果 | 详情 |
|---------|------|------|
| Level 1 CI 验证 | ✅/❌ | 测试 {n}/{n}, 构建 {通过/失败}, Lint {n} errors, 启动 {UP/DOWN} |
| Level 2 契约规格 | ✅/❌ | 总分 {n}/50 |
| Level 3 E2E + 视觉 | ✅/❌/N/A | [E2E_TOOL] {n}/{n} PASS, 视觉走查 {n} issues |
| Level 4 Constitution | ✅/❌ | 硬约束违反 {n}，软约束违反 {n} |

### 总体判定
- **PASS**: 所有层级通过 → 进入下一个任务
- **FAIL**: 任何层级未通过 → 进入 Corrector 流程，附带具体失败项

### 失败项清单（如有）
1. {具体问题描述 + 预期 vs 实际}
2. ...
```

---

## 验证频率

| 何时验证 | 验证级别 | 说明 |
|---------|---------|------|
| 每个任务完成后 | Level 1 + Level 2 | CI 通过 + 契约一致 |
| 每个用户故事完成后 | Level 1 + 2 + **3 ([E2E_TOOL] + 视觉走查)** | 端到端用户流程 + UI 视觉验证 |
| 每个 Sprint Checkpoint | Level 1 + 2 + 3 + **4** | 全面合规检查 |
| 涉及认证/权限/安全的任务 | Level 1 + 2 + 4 | 高风险任务必须 Constitution 检查 |
| 代码合并前 | Level 3 + 4 | E2E 回归 + Constitution 兜底 |
