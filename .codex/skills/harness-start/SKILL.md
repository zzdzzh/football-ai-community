---
name: harness-start
description: 启动或恢复 Harness Sprint，报告当前进度和下一个待执行任务。
triggers:
  - harness start
  - resume sprint
  - sprint status
  - 启动 Sprint
  - 恢复 Sprint
  - Sprint 进度
---

# Harness Sprint 开始/恢复

**上下文管理**: 🔄 清空上下文 — 使用子代理（Agent）执行，确保干净的上下文环境

## 指令

启动或恢复一个 Sprint 的执行。本命令会在子代理中运行，获得干净的上下文。

### 输入参数

- Sprint 编号: $ARGUMENTS 或自动检测最新的未完成 Sprint

### 执行步骤

使用 Agent 工具启动子代理，传入以下 prompt：

```
你是 Harness 开发框架的 Sprint 执行器。

1. 读取 `.harness/sprints/sprint-{N}-progress.md` 了解当前进度
2. 找到第一个未完成的任务
3. 读取 `.harness/sprints/sprint-{N}.md` 了解该任务所在的 Day 和 Batch
4. 读取 项目中`constitution.md` 了解项目约束
5. 读取 `.harness/prompts/executor.md` 了解上下文加载协议

报告：
- 当前 Sprint 状态（已完成/总任务数）
- 下一个要执行的任务 ID 和描述
- 该任务需要加载的上下文文件（精确到行号范围）
- 建议的执行命令（提示用户运行 /harness.exec）

不要执行任务本身，只做状态报告和准备。
```

### 输出

Sprint 状态摘要和下一步操作指引。用户看到后运行 `/harness.exec` 开始执行。
