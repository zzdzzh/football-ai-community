# Generator Prompt 模板 — 任务执行

## 使用方式

根据当前任务类型，选择对应的模板发送给执行代理。每个模板都会自动注入约束层和信息层上下文。

**核心原则：测试驱动开发（TDD）**

所有含业务逻辑的任务（服务端/核心逻辑和用户界面）必须遵循 TDD 流程：
1. **Red** — 先写测试，定义预期行为，运行确认测试失败
2. **Green** — 写最小实现代码使测试通过
3. **Refactor** — 重构代码，保持测试通过

不含业务逻辑的任务（数据迁移、配置文件、数据模型、传输对象）不要求 TDD，但仍需通过构建或静态检查。

---

## 通用前缀（每次执行任务前都要注入）

```
## 开发约束（Harness 约束层）

你正在执行 [PROJECT_NAME] 的开发任务。必须遵守以下约束：

1. 读取并遵守 `.specify/memory/constitution.md` 中的所有原则
2. 服务端/核心运行时: [BACKEND_RUNTIME]，代码组织遵循项目现有模块边界
3. 用户界面运行时: [FRONTEND_RUNTIME]，交互与视觉遵循项目现有设计系统
4. 数据存储或迁移系统: [DATA_STORE]
5. 所有接口必须与 [API_CONTRACT_ROOT] 中对应的接口契约一致
6. 所有数据模型字段必须与 [DATA_MODEL_DOC] 一致
7. 不引入 tasks.md 和 plan.md 中未列出的依赖
8. 注释、命名、格式化和错误处理遵循项目现有约定

## 当前任务
```

---

## 模板1: 数据迁移

```
{通用前缀}

### 任务: {任务ID} - 创建数据迁移脚本

**文件路径**: `[SOURCE_ROOT]/[MODULE]/migrations/[MIGRATION_FILE]`

**要求**:
1. 读取 [DATA_MODEL_DOC]，找到以下业务对象或数据结构的定义：{对象列表}
2. 为每个对象创建 [DATA_STORE] 可执行的迁移定义
3. 字段类型、默认值、约束和索引按 [DATA_STORE] 与项目数据模型约定映射
4. 创建必要的索引（关联字段、唯一约束字段、常用查询字段）
5. 不要插入测试数据（seed / fixture data 是单独任务）
```

## 模板2: 数据模型

```
{通用前缀}

### 任务: {任务ID} - 创建数据模型

**文件路径**: `[SOURCE_ROOT]/[MODULE]/model/[DATA_MODEL_FILE]`

**要求**:
1. 读取 [DATA_MODEL_DOC]，找到 {模型名} 的定义
2. 使用项目现有数据建模方式创建数据模型（字段、约束、关系、校验规则）
3. 主键、枚举、结构化字段和时间字段按 [DATA_MODEL_DOC] 与项目约定实现
4. 如果项目需要持久化适配器或数据访问接口，同步创建最小接口
5. 关联关系必须显式表达，并与对应迁移/结构定义一致
```

## 模板3: 业务逻辑单元（TDD）

```
{通用前缀}

### 任务: {任务ID} - 实现业务逻辑单元

**文件路径**: `[SOURCE_ROOT]/[MODULE]/[UNIT_FILE]`
**依赖数据模型**: {数据模型列表}
**对应接口契约**: `[API_CONTRACT_ROOT]/[CONTRACT_FILE]`
**对应用户故事**: {US编号} - {故事标题}

**TDD 流程**:

**第1步 — Red（先写测试）**:
1. 创建测试文件: `[TEST_ROOT]/unit/[MODULE]/[UNIT_NAME][TEST_FILE_SUFFIX]`
2. 使用项目现有单元测试框架和 mock/stub 方式
3. 根据接口契约和验收场景，为每个业务方法编写测试用例：
   - 正常路径测试
   - 异常/边界分支测试（无效输入、资源不存在、权限不足等）
4. 测试名称清晰描述业务意图
5. 运行 [TEST_COMMAND]，确认相关测试 FAIL（编译失败也算 Red）

**第2步 — Green（写实现）**:
1. 读取对应的接口契约文件，理解每个接口需要的业务逻辑
2. 读取 spec.md 中验收场景，确保逻辑覆盖
3. 使用项目现有依赖注入、事务和错误处理约定
4. 业务异常通过项目统一错误模型处理
5. 涉及认证、权限、高风险业务规则或权益变更的逻辑必须记录审计日志
6. 外部服务相关功能通过项目外部服务适配层调用，不直接绑定具体提供方 SDK 或接口
7. 运行 [TEST_COMMAND]，确认相关测试 PASS

**第3步 — Refactor（重构）**:
1. 消除重复代码，提取公共方法
2. 确保命名清晰、职责单一
3. 运行 [TEST_COMMAND]，确认仍然全部 PASS

**交付物**:
- 测试文件: `[TEST_ROOT]/unit/[MODULE]/[UNIT_NAME][TEST_FILE_SUFFIX]`
- 实现文件: `[SOURCE_ROOT]/[MODULE]/[UNIT_FILE]`
- 相关输入/输出对象文件（如需要）
```

## 模板4: 接口入口（TDD）

```
{通用前缀}

### 任务: {任务ID} - 实现接口入口

**文件路径**: `[SOURCE_ROOT]/[MODULE]/interface/[INTERFACE_FILE]`
**接口契约**: `[API_CONTRACT_ROOT]/[CONTRACT_FILE]`
**依赖业务逻辑单元**: {业务逻辑单元列表}

**TDD 流程**:

**第1步 — Red（先写测试）**:
1. 创建契约测试: `[TEST_ROOT]/contract/[MODULE]/[INTERFACE_NAME][TEST_FILE_SUFFIX]`
2. 使用项目现有契约测试框架，替换或隔离依赖的业务逻辑单元
3. 对照接口契约为每个端点或操作编写测试：
   - 请求路径、方法、参数和请求体结构
   - 正常响应的状态码和字段
   - 错误响应的状态码和错误码
4. 运行 [TEST_COMMAND]，确认相关测试 FAIL

**第2步 — Green（写实现）**:
1. 读取接口契约文件，每个 path + method 或 operation 对应一个接口入口实现
2. 使用项目现有接口框架和路由/处理器约定
3. 请求/响应对象必须与契约定义一致（字段名、类型、可选性）
4. 使用项目现有请求校验方式验证输入
5. 需要认证或权限的接口通过项目统一安全上下文获取当前用户或主体
6. 返回契约约定的成功和错误状态
7. 运行 [TEST_COMMAND]，确认相关测试 PASS

**第3步 — Refactor**:
1. 确保接口入口只做参数提取、校验、响应映射和业务逻辑调用，不含核心业务规则
2. 运行 [TEST_COMMAND]，确认仍然全部 PASS

**交付物**:
- 测试文件: `[TEST_ROOT]/contract/[MODULE]/[INTERFACE_NAME][TEST_FILE_SUFFIX]`
- 实现文件: `[SOURCE_ROOT]/[MODULE]/interface/[INTERFACE_FILE]`
```

## 模板5: 用户界面接口适配

```
{通用前缀}

### 任务: {任务ID} - 创建用户界面接口适配

**文件路径**: `[SOURCE_ROOT]/[MODULE]/ui/[ADAPTER_FILE]`
**接口契约**: `[API_CONTRACT_ROOT]/[CONTRACT_FILE]`

**要求**:
1. 读取接口契约文件，为每个端点或 operation 创建对应的调用函数
2. 使用项目现有请求客户端或传输抽象
3. 为请求参数和响应定义类型或结构说明（放在项目约定位置）
4. 函数命名与契约 operationId 或项目接口命名约定一致
5. 返回值和错误处理遵循项目现有用户界面运行时约定

**不要求 TDD**（用户界面接口适配是契约到代码的直接映射，无业务逻辑，不需要测试驱动）
```

## 模板6: 用户界面页面/组件（TDD）

```
{通用前缀}

### 任务: {任务ID} - 实现用户界面页面/组件

**文件路径**: `[SOURCE_ROOT]/[MODULE]/ui/[COMPONENT_FILE]`
**对应用户故事**: {US编号} - {故事标题}
**依赖接口适配**: `[SOURCE_ROOT]/[MODULE]/ui/[ADAPTER_FILE]`

**TDD 流程**:

**第1步 — Red（先写测试）**:
1. 创建测试文件: `[TEST_ROOT]/unit/[MODULE]/[COMPONENT_NAME][TEST_FILE_SUFFIX]`
2. 使用项目现有用户界面测试框架
3. 根据验收场景为页面/组件编写测试：
   - 渲染测试：关键元素正确渲染
   - 交互测试：用户操作触发预期行为
   - 状态测试：loading / empty / error 状态正确显示
4. 使用项目约定的 mock/stub 方式替换接口调用
5. 运行 [TEST_COMMAND]，确认相关测试 FAIL

**第2步 — Green（写实现）**:
1. 读取 spec.md 中验收场景
2. 使用 [FRONTEND_RUNTIME] 的项目既有组件、状态管理和路由约定
3. 视觉样式遵循项目设计系统、可访问性和响应式规则
4. 运行 [TEST_COMMAND]，确认相关测试 PASS

**第3步 — Refactor**:
1. 提取可复用的组合逻辑或子组件
2. 运行 [TEST_COMMAND]，确认仍然全部 PASS

**第4步 — 子页深度验证（批次完成时，非单任务）**:

用户界面任务完成后的批次门禁必须包含"深度点击子页"——不止验证当前组件渲染，还要验证
从父页进入本页再到子交互的完整链路。参见 `evaluator.md` L1 Step 4e。

最小清单（L2 验证表追加）:
- [ ] 从父页按 spec 故事"真实点击"进入本组件（不是 `goto` 到末端 URL）
- [ ] Network 面板: 本组件触发的**所有**接口状态码，非 2xx 必须记录并定位
- [ ] 至少点 1 个子交互（按钮 / 链接 / 对话框），确认不是死链
- [ ] 截图确认主体内容区渲染，空白 = FAIL

**交付物**:
- 测试文件: `[TEST_ROOT]/unit/[MODULE]/[COMPONENT_NAME][TEST_FILE_SUFFIX]`
- 实现文件: `[SOURCE_ROOT]/[MODULE]/ui/[COMPONENT_FILE]`
- （批次完成时）深度点击记录: Sprint 进度文件 `深度点击: {路径} | 接口状态: {列表}`
```

## 模板7: 独立测试任务

```
{通用前缀}

### 任务: {任务ID} - 编写测试

**文件路径**: `[TEST_ROOT]/[TEST_TYPE]/[MODULE]/[TEST_NAME][TEST_FILE_SUFFIX]`
**测试目标**: {被测试的业务对象、接口或组件}
**测试类型**: {契约测试 / 集成测试}

**要求**:

#### 契约测试
1. 使用项目现有契约测试框架
2. 验证请求/响应结构与 [API_CONTRACT_ROOT] 中对应契约一致
3. 验证成功和错误状态
4. 验证字段类型和可选性

#### 集成测试
1. 使用项目现有集成测试环境，按需启动 [DATA_STORE] 或其他依赖服务
2. 测试完整的业务流程
3. 验证数据状态变更
4. 验证跨业务逻辑单元交互
```

## 模板8: `[E2E_TOOL]` E2E 测试

```
{通用前缀}

### 任务: 编写 {US编号} 的 `[E2E_TOOL]` E2E 测试

**文件路径**: `[TEST_ROOT]/e2e/{story-name}[TEST_FILE_SUFFIX]`
**对应用户故事**: {US编号} - {故事标题}

**要求**:
1. 读取 `specs/[FEATURE_ID]/spec.md` 中 {US编号} 的所有验收场景
2. 每个 Given/When/Then 对应一个 test case
3. 使用页面对象或项目既有交互抽象: `[TEST_ROOT]/e2e/pages/[PAGE_OBJECT_FILE]`
4. 前置: 使用项目认证 fixture 或测试账号完成登录/授权
5. 断言只验证用户可见的结果（页面文字、元素可见性、URL 变化）
6. 等待策略: 等待选择器、响应或可观察状态，不用固定 sleep
7. 关键步骤截图保存到项目约定的 E2E 截图目录
8. 配置 `[E2E_TOOL]` 使用项目测试环境 base URL

**验收场景**:
{从 spec.md 粘贴对应用户故事的全部验收场景}
```

## 模板9: Seed Data（种子数据）

```
{通用前缀}

### 任务: {任务ID} - 创建种子数据

**文件路径**: `[SOURCE_ROOT]/[MODULE]/data/[SEED_DATA_FILE]`

**要求**:
1. 读取 `specs/[FEATURE_ID]/spec.md` 中对应用户故事的描述，了解需要什么样的示例数据
2. 读取 [DATA_MODEL_DOC] 中相关对象的字段定义，确保数据字段匹配
3. 读取磁盘上对应的数据迁移或结构定义，确认约束
4. 生成足够支撑 DEMO 和测试的数据量（通常 3-5 条主对象记录，关联对象按需）
5. 标识符、时间戳和默认值使用项目数据存储约定
6. 数据内容贴近真实业务场景，但不绑定特定项目语境
7. 注意关联约束顺序：先插入或创建被引用对象的数据

**不要求 TDD**（纯数据，无业务逻辑）

**验证标准**:
- [ ] 数据脚本或 fixture 语法正确，可通过项目数据加载流程执行
- [ ] 字段与结构定义一致（类型、非空约束）
- [ ] 关联引用的数据已先行创建
- [ ] 数据内容合理，可用于 DEMO 演示
```

---

## 模板10: 真实外部服务接入（Prompt / Parser / Wiring）

### 任务: {任务ID} - 接入 [EXTERNAL_SERVICE_NAME] 场景 / 改造 prompt / 编写响应 parser

**适用**：
- 新增 [EXTERNAL_SERVICE_NAME] 场景或能力，并加入项目场景注册表
- 改造既有场景的 prompt 模板（`[SOURCE_ROOT]/[MODULE]/prompts/*.md`）
- 编写或修改外部服务响应 parser
- 为场景写 mock/fixture 响应或 wiring 测试

**触发前置**（必读）：
- 读取项目 memory 中关于外部服务输出格式、真实服务验收和 checkpoint 纪律的反馈记录
- 读取当前 feature 的 spec、plan 和 contracts，确认外部服务输出是业务必需而不是实现偏好

### 外部服务三层防御 checklist（接入新场景强制走完）

#### 层 1 · 调用层（请求格式 + 模型/提供方配置）

- [ ] 判断场景是否需要严格结构化输出：默认首选简单、可解析的文本或扁平结构；仅在业务必须多字段嵌套时使用复杂结构
- [ ] 若用结构化输出：场景加入项目结构化输出白名单，并在外部服务适配层中集中配置
- [ ] 新场景的超时、重试、降级和 mock/real 切换遵循项目现有约定
- [ ] 新场景加入项目场景注册表，默认走 mock/fixture 或安全降级模式
- [ ] 相关 wiring 测试同步期望场景数量或注册清单

#### 层 2 · Prompt 层（结构化输出约束）

- [ ] **业务上下文优先**：若 prompt 输入含业务摘要、结构化字段或人工备注，必须明示哪个输入是权威语义信号
- [ ] **输出硬约束**：
  - 纯文本场景：明确输出格式正则或固定枚举 + "只输出最终结果 · 禁推理文字 · 禁 Markdown 包装"
  - 结构化场景：明确字段白名单 + "只输出目标结构 · root 含键 {x} · 禁推理文字"
- [ ] **禁推理文字**：prompt 里明示 "若推理请在内心完成 · 最终只输出 {格式}"
- [ ] Prompt 外置到 `[SOURCE_ROOT]/[MODULE]/prompts/[PROMPT_FILE]` · 禁硬编码

#### 层 3 · Parser 层（parser 鲁棒性 + 兜底）

- [ ] Parser 严格匹配正则或结构定义为主，尾部兜底为辅
- [ ] 纯文本场景：若严格正则失败，从原文尾部提取最后一个合法模式
- [ ] 结构化场景：字段别名和轻微格式漂移通过 normalizer 或等价机制容错
- [ ] Parser 空 / null / 退化输入不崩溃：单测覆盖 null / 空串 / 超长文本 / 非法字符 / 错误枚举等 ≥ 5 条退化用例
- [ ] 服务层 fallback：parser 无法产出完整结果时走 partial fields、默认兜底或人工可见错误，不直接造成不可诊断失败

### TDD 顺序

```
Step 1 · Red: 先写 Parser 单测（覆盖严格路径 + 鲁棒性路径 + 退化路径）· 确认 FAIL
Step 2 · Green: 写 Parser 实现（严格匹配 + 兜底提取）· 单测 PASS
Step 3 · Mock: 写 mock/fixture 响应 · 保留 mock/fixture 标识供反向契约验证
Step 4 · Wiring: 场景注册 · timeout 配置 · 既有 wiring 测试同步
Step 5 · 真实服务（批次 Polish 4f）: [REAL_SERVICE_CHECK] 至少 1 次成功 · 用户界面肉眼验收 · recovery 分支日志证据
```

### 验证标准（L1 + L2）

- [ ] Parser 单测 ≥ 5 条（严格 ≥ 3 + 鲁棒 ≥ 1 + 退化 ≥ 1）· 100% PASS
- [ ] 场景加入项目场景注册表 · 相关 wiring 测试断言对齐
- [ ] Prompt 模板 `[SOURCE_ROOT]/[MODULE]/prompts/[PROMPT_FILE]` 入库 · grep 无硬编码
- [ ] mock/fixture 对应场景响应示例 · 含 mock/fixture 标识（反向契约）
- [ ] 涉真实外部服务批次门禁 4f：[REAL_SERVICE_CHECK] 至少 1 次成功 + 用户界面截图 ≥ 2 张
- [ ] 日志或配置扫描确认无真实密钥泄漏

### 关键参考

- 项目现有 parser、外部服务适配器、prompt 模板和契约文件
- 当前 feature 的 spec、plan、contracts 和 memory 反馈记录

---

## 执行流程

对每个任务：

1. **选择模板**: 根据任务类型选择对应 Generator 模板
2. **注入上下文**: 填入任务ID、文件路径、依赖信息
3. **TDD 执行**: 先写测试 → 再写实现 → 重构
4. **提交验证**: 用 Evaluator 检查（见 evaluator.md）
5. **记录度量**: 记录约束遵守情况和验证结果（见 metrics.md）
