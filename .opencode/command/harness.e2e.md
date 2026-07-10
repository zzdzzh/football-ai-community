---
name: harness-e2e
description: 为当前用户故事或 Sprint 编写并运行 `[E2E_TOOL]` E2E 测试。
triggers:
  - harness e2e
  - e2e visual
  - end to end test
  - E2E 测试
  - 交互验证
  - 用户故事验收
---

# Harness `[E2E_TOOL]` E2E 测试

**上下文管理**: 🔄 清空上下文 — 使用子代理执行，确保干净环境

## 指令

为当前完成的用户故事编写并运行 `[E2E_TOOL]` E2E 测试。

### 输入参数

$ARGUMENTS — 用户故事编号（如 "US1"）或 "sprint" 表示当前 Sprint 的所有 E2E

### 执行步骤

使用 Agent 工具启动子代理，传入以下任务：

```
你是 Harness E2E 测试执行器。

1. 读取 `specs/[FEATURE_ID]/spec.md`，找到 {US编号} 的全部验收场景
2. 读取 `.harness/prompts/evaluator.md` 的 Level 3 模板，了解 E2E 编写规则
3. 读取 `.harness/prompts/generator.md` 的 E2E 模板，了解 `[E2E_TOOL]` 测试生成规范

执行：
a. 为每个验收场景的 Given/When/Then 编写一个 test case
b. 使用 Page Object 模式组织页面交互
c. 写入 `[TEST_ROOT]/e2e/{story-name}[TEST_FILE_SUFFIX]`
d. 运行 `[E2E_COMMAND]`
e. 如有失败，修正测试代码后重跑
f. 确认通过后重跑3次验证稳定性
g. 关键步骤截图保存到 `[E2E_SCREENSHOT_DIR]`

报告：
- 测试用例总数、通过数、失败数
- 失败用例的详情和截图路径
- 稳定性结果（3次重跑是否全部通过）
- 更新 sprint-*-progress.md 中的 E2E 验证状态
```

### 注意
- E2E 测试需要相关应用、用户界面和依赖服务都在运行
- 如果应用或用户界面未启动，先提示用户执行 `[APP_START_COMMAND]` / `[UI_START_COMMAND]`
- 首次运行可能需要安装或初始化 `[E2E_TOOL]` 的运行时资源
