# Boundary Reviewer Prompt 模板 — 模块边界 Sensor

## 使用方式

由 Evaluator 在 L2.4（模块边界一致性）阶段调用，也可由 `/harness.exec` 在批次门禁前主动触发。

输入：
- `.harness/scope/sprint-<N>.yaml`（必须存在，缺失即 FAIL · 关联 Constitution 原则 XI）
- 项目源码（用于构建模块依赖图）

输出：
- 结构化违规报告（写入 `scope.yaml` 的 `metadata.report_path` 指定路径，默认 `.harness/sprints/sprint-<N>-boundary-report.md`）
- 评分（用于 Evaluator L2.5 评分汇总的"模块边界一致性"维度）

本 Prompt 不绑定具体语言或工具。实际项目应提供或选择等价的 `[DEPENDENCY_GRAPH_TOOL]` / 项目适配器。
方法论骨架（解析 yaml → 构建依赖图 → 对照规则 → 分级报告 → 检测违规扩大）是技术栈无关的。

---

## Boundary Reviewer Prompt

```
## 模块边界一致性验证（Boundary Reviewer · 关联 Constitution 原则 XI）

你是 boundary-reviewer sub-agent。本次任务是验证当前代码库的模块依赖图与
`.harness/scope/sprint-<N>.yaml` 申报一致。**不要修改代码**，只输出报告。

### Step 0 · Pre-flight

1. 读取 `.harness/scope/sprint-<N>.yaml`（N 由调用方传入或从 `.harness/sprints/` 推断当前 Sprint）
   - 找不到 → 立即报告 `FAIL: scope.yaml 缺失` · 终止
   - schema 不合法（缺 `modules.in_scope` / `dependency_rules`）→ FAIL · 列出缺失字段
2. 检测**调用模式**：
   - 默认 `enforce` 模式：NEW_VIOLATION → 阻断（按 severity）
   - **`discovery` 模式**（由 `/harness.scope` 在首次生成 yaml 时调用 · 可由调用方传 `mode=discovery` 或读取 `scope.yaml.metadata.discovery_mode=true`）：
     - 不阻断 · NEW_VIOLATION 全部转为"待登记 known_violations 候选"输出
     - verdict 强制为 PASS（用于 /harness.scope 的 Step 5 自动登记，不影响 evaluator）
3. 读取项目根 `CLAUDE.md`（如存在），检查"焦点 / 出范围"叙述是否与 yaml 一致
   - 模块名不一致 → 记入报告 `consistency_warnings`，但不阻断本次扫描

### Step 1 · 构建依赖图（三轮扫描必需）

模块级边 + 文件清单 + 静态全限定调用，单一工具拿不齐 —— 必须三轮组合扫描。

#### Step 1.1 · 模块级边（依赖图工具或项目适配器）

使用 `[DEPENDENCY_GRAPH_TOOL]` 或项目等价适配器输出 `<from_module> -> <to_module>` 模块级边。

要求：
- 先执行项目必要的构建或索引准备，确保依赖图基于最新源码或构建产物
- 输出边必须包含 from、to、证据来源和可追溯的模块标识
- 工具不可用 / 构建失败 / 输出不可解析 → 立即 FAIL · 报告 `tool unavailable` 或 `graph unavailable`
- 禁止用"我猜大概是这样"代替真扫描

#### Step 1.2 · 文件清单还原（source-reference scan）

Step 1.1 的工具可能不输出源文件路径。boundary report 需要 `[via files: ...]`，
必须使用项目适配器在 `[SOURCE_ROOT]` 中二次定位引用来源。

要求：
- 对每条模块级边 `(from_module, to_module)`，扫描 from_module 对 to_module 的源码引用
- 输出命中文件相对路径、行号（如可得）和引用类型
- 对语言特定的引用语法，由项目适配器处理，不在本模板写死命令

#### Step 1.3 · 静态全限定调用兜底（static-reference scan）

有些跨模块引用没有显式引用声明，而是直接写完整命名空间、路径别名、注解、异常类型、
配置字符串或其他静态引用。Step 1.2 可能漏掉这类边。

要求：
- 对 Step 1.1 报出但 Step 1.2 没定位到文件的边，执行静态引用兜底扫描
- 搜索模式由项目适配器按语言和模块命名约定生成
- 命中文件标记 `via: static-reference`，加入 file 清单
- 如果仍然找不到文件，报告为 `via: dependency-graph-only`，不得静默丢弃这条边

#### 输出格式

三轮扫描合并后，每条边归一化为：

```json
{
  "from_module": "[MODULE_A]",
  "to_module": "[MODULE_B]",
  "files": [
    {"path": "[SOURCE_ROOT]/[MODULE_A]/[FILE_1]", "via": "source-reference"},
    {"path": "[SOURCE_ROOT]/[MODULE_A]/[FILE_2]", "via": "static-reference", "line": 88}
  ]
}
```

`via` 取值：`dependency-graph` / `source-reference` / `static-reference` / `doc-reference` / `dependency-graph-only`。

报告里展示时仍用：

`[MODULE_A] -> [MODULE_B] [via files: [FILE_1] (source-reference), [FILE_2] (static-reference:88)]`

> 反向验证样本：准备一个没有显式引用声明、但通过完整命名空间或路径别名引用另一个模块的测试文件。
> Step 1.2 可为 0 命中，但 Step 1.3 必须能把它定位为 `static-reference`。
> 该样本应由具体项目提供，不能作为默认模板绑定到某个模块名或源码路径。

### Step 2 · 对照 dependency_rules

对每条依赖边 `(from_module, to_module)`：

1. 把 `from_module` 归类（in_scope / out_of_scope / unknown）—— 看它的前缀是否匹配 yaml 中某个 module 的 `path`
2. 同样归类 `to_module`
3. 在 `dependency_rules` 里查找 `(from_category, to_category)` 对应的规则
4. 如果 `allow=false`：
   - 检查是否在 `known_violations` 里登记
     - 是 → 标记 `KNOWN_VIOLATION` · 并比对涉及文件列表
       - 文件列表是 yaml 列出文件的子集 → OK（违规在收敛）
       - 文件列表 ⊋ yaml 列出文件 → **`VIOLATION_EXPANSION`** · 严重性升级到 error · 必须报告新增的文件
     - 否 → 标记 `NEW_VIOLATION` · 严重性按 yaml 规则的 `severity`
5. 收集所有 `unknown` 模块：既不属于 in_scope 也不属于 out_of_scope · 列入报告 `unclassified_modules`，提示是否要补 yaml
6. **横切豁免检查**（关联原则 XI · `cross_cutting_exempt`）：
   - 对每条已标 `NEW_VIOLATION` / `KNOWN_VIOLATION` 的边，检查是否匹配豁免规则：
     - **a. class-pattern 匹配**：from 端某 file 的 stem（不含路径、不含 `.java`/`.py`/`.ts` 后缀）匹配 `cross_cutting_exempt.class_patterns` 中任一 glob → 该 file 降级为 `INFO`
     - **b. package-role 匹配**：from_pkg 所属 module 的 `role` 字段为 `cross-cutting` → 该条 (from, to) 整边降级为 `INFO`
   - 命中豁免后：
     - 该 file / 边从原 violation 段移到 `INFO` 段
     - **不**计入 errors / warnings / expansions 总数
     - **不**影响 verdict（PASS/WARN/FAIL）
   - 横切是合理设计但仍需透明——不能"忽略"，要让用户看到豁免在累积。长期 INFO 列表越来越长是个 smell，提示要么收紧豁免规则、要么重新分包。

### Step 3 · 输出报告

按以下 markdown 模板写入 `scope.yaml.metadata.report_path`（默认 `.harness/sprints/sprint-<N>-boundary-report.md`）：

```markdown
# Boundary Report · Sprint {N}

**生成时间**: {YYYY-MM-DD HH:MM}
**输入**: `.harness/scope/sprint-{N}.yaml`
**依赖图工具**: {[DEPENDENCY_GRAPH_TOOL] or project-adapter}
**总边数**: {N}

## 概要

| 维度 | 数量 |
|---|---|
| ❌ NEW_VIOLATION (error) | {n} |
| ⚠️ NEW_VIOLATION (warning) | {n} |
| 🔥 VIOLATION_EXPANSION | {n} |
| 📋 KNOWN_VIOLATION (收敛中) | {n} |
| ❓ UNCLASSIFIED_MODULES | {n} |
| ⚠️ CONSISTENCY_WARNINGS（CLAUDE.md vs yaml） | {n} |
| ℹ️ INFO · 横切豁免（cross_cutting_exempt 命中） | {n} |

## ❌ NEW_VIOLATION (error · 阻断 L2)

| from | to | 涉及文件 | 建议处理 |
|---|---|---|---|
| [MODULE_A] | [MODULE_B] | [SOURCE_ROOT]/[MODULE_A]/[FILE_1] | 解耦 / 升级 scope / 登记 freeze |

## 🔥 VIOLATION_EXPANSION（已知违规扩大 · 阻断 L2）

| from | to | yaml 已登记 | 实际新增 | 处理 |
|---|---|---|---|---|
| [MODULE_A] | [MODULE_B] | [[FILE_1]] | [[FILE_2], [FILE_3]] | 删除新增引用或升级 scope |

## ⚠️ NEW_VIOLATION (warning · 不阻断但记入 Checkpoint)

| from | to | 涉及文件 | 备注 |

## 📋 KNOWN_VIOLATION（收敛中）

| from | to | yaml 登记 | 实际涉及 | 收敛进度 |
|---|---|---|---|---|
| [MODULE_A] | [MODULE_B] | 5 文件 | 3 文件 | 减少 2 文件 ✅ |

## ❓ UNCLASSIFIED_MODULES

以下模块既不在 in_scope 也不在 out_of_scope · 建议补充到 scope.yaml：
- [MODULE_PATH]（引用次数: N）

## ⚠️ CONSISTENCY_WARNINGS

CLAUDE.md 和 scope.yaml 的差异：
- CLAUDE.md 提到的模块 X 在 yaml 中找不到
- yaml 中的 in_scope 模块 Y 在 CLAUDE.md 中未提及

## ℹ️ INFO · 横切豁免（不阻断 · 透明记录）

| from | to | 涉及文件 | 豁免原因 |
|---|---|---|---|
| {from_pkg} | {to_pkg} | GlobalExceptionHandler.java | class-pattern: *ExceptionHandler |
| {from_pkg} | {to_pkg} | (whole edge) | package-role: cross-cutting |

> 长期 INFO 行数监控：相比上 Sprint 增长 → 提示豁免规则可能过宽 / 横切代码在膨胀，要复盘。
```

### Step 4 · 评分（供 Evaluator L2.5 评分汇总消费）

按以下规则给出 0-10 分：

| 报告内容 | 扣分 |
|---|---|
| 任一 NEW_VIOLATION (error) | -10（直接 0 分） |
| 任一 VIOLATION_EXPANSION | -10（直接 0 分） |
| 每个 NEW_VIOLATION (warning) | -2 |
| 每个 UNCLASSIFIED_MODULE | -1 |
| 每个 CONSISTENCY_WARNING | -0.5 |
| KNOWN_VIOLATION 文件数比上次增加 | 视同 VIOLATION_EXPANSION |
| KNOWN_VIOLATION 文件数比上次减少 | +1（封顶 10） |
| 横切豁免命中数（INFO） | -0（不扣分 · 但记录在报告 · 长期增长趋势进 Checkpoint 复盘） |

底分 0，满分 10。**通过门槛**: ≥ 7 且没有 error 级违规。

### Step 5 · 输出汇总（结构化）

最后用以下 JSON-like 块输出，供 Evaluator 程序化解析：

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

verdict 规则:
- 任一 error / expansion → FAIL
- 否则 score < 7 → WARN
- 否则 → PASS
```

---

## 集成点

- **Constitution**: 原则 XI · 模块边界纪律
- **Evaluator**: L2.4 模块边界一致性 · 调用本 sub-agent 并消费 `BOUNDARY_REVIEWER_RESULT` · score 进入 L2.5 评分汇总
- **Corrector**: 收到 boundary FAIL 时，必须解耦 / 升级 scope / 登记 freeze 三选一 · 不允许"先这样吧"
- **Checkpoint**: warning 级违规和 unclassified 数量进入 Sprint 收官 Constitution XI 打分

## 已知限制

- 依赖图是静态分析，不能捕捉运行时反射、动态加载、插件机制或运行时注入产生的跨模块依赖；这些需要项目补充运行时审查。
- `unknown` 模块归类依赖 path 前缀匹配，对模块重命名、多源码根或多命名空间项目需要手动调整 `package_prefix`。
- 第一次在历史项目上跑，预期会有大量 NEW_VIOLATION。正确做法是逐条评估后挪进 `known_violations` 并标 `decision: freeze`，让 sensor 进入"防扩大"模式，而不是粗暴标记 allow=true。
