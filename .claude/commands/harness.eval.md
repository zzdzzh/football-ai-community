---
name: harness-eval
description: 执行 Harness 四级任务验证，覆盖编译、契约、E2E 与 Constitution 审查。
triggers:
  - harness eval
  - task verification
  - evaluator
  - 任务验证
  - 四级验证
  - 验证门禁
---

# Harness 任务验证（Evaluator）

**上下文管理**: ✅ 保持当前上下文（紧跟 /harness.exec 之后执行）

## 指令

对已完成的任务执行质量验证。验证必须参照 `.harness/prompts/evaluator.md` 中的模板严格执行。

### 输入参数

$ARGUMENTS — 验证级别和范围，格式: `{level} {任务ID或范围}`
- `/harness.eval L2 T014` — 对任务 T014 执行 Level 2 契约验证
- `/harness.eval L4` — 执行 Constitution 全面合规审查
- `/harness.eval all` — 执行全部四级验证（Sprint Checkpoint 时使用）
- 不带参数 — 默认对最近完成的批次执行 **L1 + L2**（高风险任务自动加 L4）

### 验证级别

验证是分层递进的。每一层解决不同的问题：

#### Level 1 — CI 门禁（技术正确性）

回答问题：**代码能不能跑？**

```
Step 1: 单元测试 — [TEST_COMMAND]（门禁，不通过则阻断）
Step 2: 构建/编译 — [BUILD_COMMAND]
Step 3: Lint — [LINT_COMMAND] 无 ERROR
Step 4: 应用启动+集成验证（批次完成时） — [APP_START_COMMAND] + [UI_START_COMMAND] + 真实接口调用链验证
```

⛔ L1 不通过 → 后续层级不执行，进入 Corrector。
⚠️ Step 4 在每个批次完成后和 Sprint Checkpoint 时执行，不是每个任务都跑。

#### Level 2 — 契约与规格对照（功能正确性）

回答问题：**代码做的对不对？**

读取 `.harness/prompts/evaluator.md` Level 2 模板，对每个接口入口/数据模型任务执行：
1. 读取 `[API_CONTRACT_ROOT]` → 逐项对照实际代码（路径、方法、字段、状态码）
2. 读取 `[DATA_MODEL_DOC]` → 逐字段对照数据模型
3. 读取 `spec.md` 验收场景 → 检查业务逻辑覆盖度
4. 输出四维评分表（契约一致/模型一致/场景覆盖/代码质量，各10分，门槛32/40）

#### Level 3 — `[E2E_TOOL]` E2E（用户体验正确性）

回答问题：**用户能不能用？**

在用户故事完成后执行：
1. 根据 spec.md 验收场景编写/运行 `[E2E_TOOL]` 测试
2. 测试文件: `[TEST_ROOT]/e2e/{story-name}[TEST_FILE_SUFFIX]`
3. 执行: `[E2E_COMMAND]`
4. 重跑3次验证稳定性

#### Level 4 — Constitution 合规（架构正确性）

回答问题：**有没有违反项目宪法？**

读取 `.harness/prompts/evaluator.md` Level 4 模板，逐条检查：

| 原则 | 检查重点 |
|------|---------|
| I. 架构边界 | 服务端、用户界面和其他运行时边界符合 Constitution |
| II. 契约驱动 | 实现与项目接口契约一致，无未定义接口 |
| III. 测试纪律 | 高风险业务逻辑具备要求的分支覆盖 |
| IV. 外部服务抽象层 | `[EXTERNAL_SERVICE_NAME]` 调用通过项目定义接口，Prompt/配置外置，有超时降级 |
| V. 可观测性 | 结构化日志，外部服务调用有指标 |
| VI. 简单优先 | 无不必要的抽象 |
| VII. 安全合规 | 接口认证+权限控制，敏感操作审计日志 |

硬约束违反数必须为 0。

### 默认行为（不带参数）

不指定参数时，执行 **L1 + L2**，对高风险任务自动追加 **L4**：
1. L1 CI 门禁 → 全部测试/编译/Lint
2. L2 契约对照 → 对所有含接口入口/数据模型的任务逐项检查
3. L4 Constitution → **仅对高风险任务**自动触发（认证、权限、高风险业务规则、外部服务、安全相关）

高风险判定规则：任务描述包含 `认证、auth、安全、RBAC、权限、评分、scoring、等级变更、外部服务、[EXTERNAL_SERVICE_NAME]、接口入口` 之一。
非高风险任务的 L4 审查延迟到 Sprint Checkpoint（`/harness.checkpoint`）批量执行。

### 验证结果处理

- **PASS**: 更新进度文件，报告通过
- **FAIL**: 输出失败项清单 + 具体位置，提示用户运行 `/harness.fix`
