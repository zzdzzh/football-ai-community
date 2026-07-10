---
name: harness-fix
description: 按 Corrector 流程对验证失败的问题进行定向修正并执行回归验证。
triggers:
  - harness fix
  - corrector
  - fix verification failure
  - 定向修正
  - 修复验证失败
  - 回归验证
---

# Harness 定向修正（Corrector）

**上下文管理**: ✅ 保持当前上下文（紧跟 /harness.eval 的 FAIL 结果执行）

## 指令

对 Evaluator 验证失败的项目进行最小化定向修正。

### 输入参数

$ARGUMENTS — 可选，指定修正轮次或失败项。不指定则自动从上一次 Evaluator 结果获取。

### 执行步骤

1. **获取失败项**:
   - 如果当前上下文中有 Evaluator 的 FAIL 输出，直接使用
   - 否则读取进度文件中最新的失败记录

2. **加载修正模板**: 读取 `.harness/prompts/corrector.md`

3. **执行修正**（按 corrector.md 的修正模式）:
   - 分析每个失败项的根因
   - 确定最小修复范围（哪些文件的哪些行）
   - 执行修改
   - **不重写无关代码**

4. **重新验证**:
   - 重新执行导致 FAIL 的验证级别
   - PASS → 更新进度文件，报告修正完成
   - FAIL → 检查轮次
     - 轮次 < 3 → 继续修正
     - 轮次 = 3 → 生成人工介入报告，标记任务为 ⚠️ BLOCKED

5. **更新进度文件**:
   - 记录修正详情到修正记录表
   - 更新任务验证状态

### 修正约束
- 每次修正只改必须改的代码
- 修正不能引入新的编译错误或测试失败
- 修正后必须重新跑 Level 1 验证
- 最多3轮，超过自动升级到人工介入
