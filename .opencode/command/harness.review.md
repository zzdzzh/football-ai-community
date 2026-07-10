---
name: harness-review
description: 关联 peer-reviewer sub-agent 独立跑 peer review，产出 review 报告，不进 evaluator 流程。
triggers:
  - harness review
  - peer review
  - peer reviewer
  - 同行评审
  - 代码评审
  - review 报告
---

# Harness Peer Review

**关联 peer-reviewer sub-agent · 双观众设计（工程师建心智模型 + 系统改 bug）。**

**上下文管理**: 保持当前上下文（需要读 diff + CLAUDE.md + spec）

## 指令

独立 ad-hoc 跑 peer review，不进 evaluator 流程。`/harness.exec` 默认在 L2.5 内置同样的 review，本命令是手工触发版（如：补 review 旧 task / review 别人写的代码 / review 跨多 task 的整段改动）。

读取以下文件：
1. `.harness/prompts/peer-reviewer.md` — sub-agent prompt
2. 项目根 `CLAUDE.md` — 项目味道
3. `specs/<feature>/spec.md` — 当前 feature spec（自动从 task ID 推断或用户传参）
4. git diff（默认 `HEAD~1..HEAD`，可参数指定 base）

### 输入参数

- Task ID：`$ARGUMENTS`（必传 · 例如 `T042` 或 `chapter-quiz-gen`）
- Base commit（可选）：`--base <SHA>`，默认 `HEAD~1`

### 执行步骤

#### Step 1 · 解析参数

- 从 task ID 反查 spec：扫 `specs/*/tasks.md`，找到包含该 task ID 的 spec
- 找不到 spec → 警告但不阻断（review 仍可跑，只是少了 spec 上下文）
- 解析 base：默认 `git rev-parse HEAD~1`，可被 `--base` 覆盖

#### Step 2 · 收集 diff

```bash
git diff <base>..HEAD --name-only
git diff <base>..HEAD
```

如果 diff 为空 → 报错并退出（没改动没 review 必要）。

#### Step 3 · 调用 peer-reviewer sub-agent

用 Task 工具 spawn sub-agent：
- system prompt：`.harness/prompts/peer-reviewer.md` 全文
- 参数：`task_id` + `base_commit` + diff 内容

Sub-agent 按其 Step 0-5 走完，写盘 `.harness/reviews/<task-id>.md`，输出 `PEER_REVIEWER_RESULT`。

#### Step 4 · 把报告路径反馈用户

输出格式：

```
✅ Peer Review 完成 · Task <ID>

报告: .harness/reviews/<task-id>.md
verdict: PASS | WARN | FAIL
score: X/10
must-fix: N · should-fix: M · suggestion: K · sensor-gap: G

要点（"给人看"段摘要）:
- 改了什么：[Step 1.1 摘要]
- 排查指引：[Step 1.4 头 2 条]

完整报告打开 .harness/reviews/<task-id>.md
```

### 注意

- **只读命令**：不修改任何代码、不修改 spec、不修改 task 状态。仅产出 review 报告。
- **报告存档**：`.harness/reviews/<task-id>.md` 持久化保存。这一文件是工程师未来排查问题的入口——尤其那段"排查指引"是 AI 写完代码 N 个月后的导航地图。
- 与 `/harness.exec` 内置 review 的区别：
  - `/harness.exec` 在 L2.5 自动跑 · 标准流程 · evaluator 消费 verdict
  - `/harness.review` 手工触发 · ad-hoc · 不影响 evaluator
  - 两者都调同一个 peer-reviewer.md，输出格式一致
- 关联文档：
  - peer-reviewer：`.harness/prompts/peer-reviewer.md`
  - L2.5 集成：`.harness/prompts/evaluator.md` § 2.5
