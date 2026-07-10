---
name: harness-scope
description: 为当前 Sprint 生成模块边界声明，明确 in-scope、out-of-scope 与依赖约束。
triggers:
  - harness scope
  - module boundary
  - boundary scope
  - 模块边界
  - Scope 声明
  - 边界约束
---

# Harness Scope 声明生成

**关联 Constitution 原则 XI · 模块边界纪律。**

**上下文管理**: 保持当前上下文（需要 CLAUDE.md / spec / plan 多处对照）

## 指令

为当前 Sprint 生成 `.harness/scope/sprint-<N>.yaml`，作为 boundary-reviewer 的输入和 evaluator L2.4 的对照标的。

读取以下文件：
1. `.harness/scope/_template.yaml` — scope schema 模板
2. `CLAUDE.md`（项目根）— 已有的"焦点 / 出范围"叙述（如存在）
3. `.harness/sprints/sprint-<N>.md` — 当前 Sprint 计划
4. `specs/[FEATURE_ID]/plan.md` — 本 feature 的 Project Structure 段（如存在）
5. `.harness/prompts/boundary-reviewer.md` — 用于 discovery 模式调用

### 输入参数（用户可选提供）

- Sprint 编号: `$ARGUMENTS` 或从 `.harness/sprints/` 推断当前最新 Sprint
- 模式: `--interactive` 强制走交互问答；不传时按"自动推断 → 用户确认"流程

### 执行步骤

#### Step 1 · 推断 Sprint 编号 + 当前 Feature

- Sprint N: 用户参数 → 否则从 `.harness/sprints/sprint-*.md` 取最大值
- Feature ID: 从 sprint-N.md 的目标段或当前分支名解析
- 若文件缺失或冲突 → 报错并要求用户传 Sprint 编号

#### Step 2 · 自动收集机械字段

按项目现有结构探测模块命名空间或源码根：

1. 优先读取 `specs/[FEATURE_ID]/plan.md` 的 Project Structure / Source Code 段
2. 其次读取项目现有构建、包管理或模块声明文件
3. 再从 `[SOURCE_ROOT]` 下的顶级目录、路径别名或命名空间声明推断最长公共前缀
4. 探测失败 → 交互问用户："本项目用于边界扫描的模块路径前缀是什么？"

`dependency_rules` 和 `metadata` 直接从 `_template.yaml` 复制默认值，不修改。

#### Step 3 · 推断 in_scope / out_of_scope（按优先级三选一）

**优先级 A · CLAUDE.md 已有的"焦点/出范围"表（最优）**

如果 CLAUDE.md 包含形如下表的段落（"焦点" / "Sprint 焦点" / "in-scope" 等关键词触发）：

```markdown
| 模块 | 文件数 | 出范围理由 |
|---|---|---|
| `[MODULE_A]` | 126 | 本 Sprint 不投入 |
| `[MODULE_B]` | 17 | 非当前 [FEATURE_ID] 范围 |
```

→ 直接 lift 到 yaml：
- 列在表中的模块 → `out_of_scope`，`reason` 取自该列
- CLAUDE.md 文中提到"焦点 N 模块"且明确列出的 → `in_scope`
- 其余在源码树中存在但 CLAUDE.md 未提及的模块 → 列入 `unclassified`，第 4 步交互确认

**优先级 B · spec + plan 推断（次优）**

如果 CLAUDE.md 没有这张表：
- 读 `specs/[FEATURE_ID]/plan.md` 的 Project Structure / Source Code 段，列出本 feature 涉及的模块 → `in_scope`
- 扫 `[SOURCE_ROOT]` 下的所有顶级模块，未列入 in_scope 的默认入 `out_of_scope`，`reason: "本 feature plan 未涉及"`
- 这种情况准确度中等，必须 100% 走 Step 4 用户确认

**优先级 C · 交互问答兜底**

如果 A 和 B 都不可用：
1. 列出 `[SOURCE_ROOT]` 下所有顶级模块及文件数
2. 问："本 Sprint 主要在哪几个模块写代码？（输入逗号分隔模块 id 或路径）" → in_scope
3. 问："剩余 N 个模块默认归 out_of_scope（保留不投入），有要例外的吗？" → 调整
4. 对每个 out_of_scope 模块问一句 reason（可批量复用："非当前 [FEATURE_ID] 范围" 等）

#### Step 4 · 草案展示 + 用户确认

把 Step 2 + 3 的产物拼成 yaml 草案，**展示给用户但不写盘**：

```yaml
sprint: <N>
feature: [FEATURE_ID]
ratified: <today>
package_prefix: <推断出的模块路径前缀>

modules:
  in_scope: [...]       # 来自 Step 3
  out_of_scope: [...]   # 来自 Step 3

dependency_rules: [默认 4 条]
known_violations: []    # Step 5 填充
```

请用户确认或调整 in/out 划分 · 在确认前**禁止**进入 Step 5。

#### Step 5 · Discovery 模式跑 boundary-reviewer

**目的**：把当前代码库已存在的所有跨界引用，自动登记为 `known_violations`，作为本 Sprint 的"防扩大"基线。这一步**只在 sprint-N.yaml 首次创建时跑**（重跑时跳过，除非用户传 `--rediscover`）。

##### Step 5.1 · 准备临时 yaml

把 Step 4 用户确认后的 yaml 草案写到**临时位置** `.harness/scope/sprint-<N>.draft.yaml`（不是最终路径），并加 discovery flag：

```yaml
metadata:
  discovery_mode: true
  report_path: .harness/scope/sprint-<N>.discovery-report.md
known_violations: []
```

##### Step 5.2 · 调用 boundary-reviewer sub-agent

调用方式：用 Task 工具 spawn 一个 sub-agent（**不是 inline 跑**，避免污染主对话上下文）：

- system prompt：`.harness/prompts/boundary-reviewer.md` 全文
- 参数：`scope_yaml_path = .harness/scope/sprint-<N>.draft.yaml`

sub-agent 检测 `metadata.discovery_mode=true` 后行为：

- 跑 Step 1 三轮扫描（[DEPENDENCY_GRAPH_TOOL] + source-reference scan + static-reference scan）
- Step 2 对照 `dependency_rules` 找出所有违规边
- 跳过 Step 3 写正式 report（discovery 不是正式评分）
- **不返回 FAIL verdict**（即使有大量 violation）
- 把所有 NEW_VIOLATION 以 yaml 片段形式输出到 stdout

##### Step 5.3 · 把 discovery 输出 merge 进草稿

把 sub-agent 输出的每条 NEW_VIOLATION 转成 `known_violations` 条目：

```yaml
- from: <from_module>
  to: <to_module>
  files:
    - path: <relative-path>
      via: <dependency-graph | source-reference | static-reference>
  reason: "auto-discovered on <date>"
  decision: freeze
  discovered_via: <project-adapter-name>
```

写回 `.harness/scope/sprint-<N>.draft.yaml`。

##### Step 5.4 · 翻 discovery_mode flag

把 `metadata.discovery_mode: true` → `false`。Sprint 之后任何 `/harness.exec` 触发的 boundary-reviewer 调用都进入 enforce 分支（NEW_VIOLATION 阻断）。

> `discovery_mode` 一生翻一次：`true`（首次生成时）→ `false`（discovery 完毕）。重跑 `/harness.scope` **不会再翻 true**，除非用户传 `--rediscover` 显式要求重做 discovery（典型场景：sprint 中途 in/out scope 大调整）。

#### Step 6 · 逐条 known_violations 处置（人类决策点）

把 Step 5 产生的 known_violations 列表给用户，**逐条**问处置：

```
违规 1/12:
  [MODULE_A] → [MODULE_B]
  涉及文件:
    - [SOURCE_ROOT]/[MODULE_A]/[FILE_1]
    - [SOURCE_ROOT]/[MODULE_A]/[FILE_2]

  本 Sprint 决定:
  [F] freeze（保留 · 不在本 sprint 清理）
  [R] resolve-this-sprint（升级到本 sprint 工作清单 · 我会建议加 task）
  [U] upgrade-scope（把 to 模块改回 in_scope · 因为本 sprint 实际要动它）
  [S] skip（暂不决定 · 留待手工编辑 yaml）

  你的选择:
```

支持批量操作（`F all` / `F 1,3,5`）避免逐条疲劳。

resolve-this-sprint 选项需要：
- 把这条违规从 known_violations 移除（让 sensor 之后视为 NEW_VIOLATION 阻断）
- 提示用户在 sprint-N.md / tasks.md 加一条解耦 task

upgrade-scope 选项需要：
- 把 to 模块从 out_of_scope 移到 in_scope
- 同步提示用户：CLAUDE.md / spec / plan 可能需要回填修订

#### Step 7 · 写盘 + 摘要

写入 `.harness/scope/sprint-<N>.yaml`。

输出摘要给用户：

```
✅ .harness/scope/sprint-<N>.yaml 已生成

  in_scope: <count> 个模块
  out_of_scope: <count> 个模块
  known_violations:
    freeze: <count>
    resolve-this-sprint: <count>（已加 task 建议）
    upgrade-scope: <count>（已调整 in_scope · 请检查 spec/plan）

下一步:
  - boundary-reviewer 现在会在 /harness.exec 的 L2.4 阶段自动运行
  - 任一 NEW_VIOLATION 或 VIOLATION_EXPANSION 会阻断批次门禁
```

### 注意

- **不要修改 source code**。本命令只产出 yaml。
- **CLAUDE.md / spec / plan 与 yaml 的一致性**由下次 boundary-reviewer 在 L2.4 跑时检查（`consistency_warnings`），本命令不强制对齐这三处。
- **首次跑可能有大量 known_violations**——这是正常的 discovery。Sensor 进入"防扩大"模式即可，不需要在第一天就清零。
- **重跑本命令**（同一 Sprint）会**附加**而非覆盖 yaml——除非用户传 `--force`。
- 关联文档:
  - 原则 XI: `.specify/memory/constitution.md`
  - schema: `.harness/scope/_template.yaml`
  - sub-agent: `.harness/prompts/boundary-reviewer.md`
  - L2.4 验证: `.harness/prompts/evaluator.md`
