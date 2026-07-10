---
name: assess-stage-review
description: 按 .harness/assess-project.json 对单个文件执行单阶段文档质量审核（Agent 内置模型，不走外部 LLM）。
triggers:
  - assess stage-review
  - assess stage review
  - 阶段文档审核
  - 单文件文档审核
  - 文档质量审核
  - 文档审核
  - assess-stage
---

# 单阶段单文件文档审核

对**一个文件**、**一个阶段**做质量审核；由当前 Agent 完成评估，产出 Markdown 报告。

**禁止**：`npx assess run`、外部 LLM API、`assess.json`  
**只读**：不修改被审文件；不运行 `git` 命令。

## 输入

```text
$ARGUMENTS
```

- 推荐：`<filePath>`（按文件名自动匹配阶段）
- 或：`<stageKey> <filePath>` / `--stage <stageKey> <filePath>`
- 可选：`--config <path>`（默认 `.harness/assess-project.json`）、`--project <path>`

## 流程

### 1. 加载配置，确定阶段与目标文件

1. 读取 `assess-project.json`（`--config` 或 `.harness/assess-project.json`），校验 `stages` 非空。
2. `projectRoot`：`--project` → 配置内 `project.path` → 工作区根目录。
3. 从参数解析 `filePath`；`stageKey` 可显式传入，否则按 **basename** 自动匹配：
   - 遍历各 stage（`enabled !== false`）的 `rules[].pattern`，取 pattern 最后一段为 basename 规则
   - 通配符按 glob 匹配；否则精确相等
   - 多命中时按 `stage_order` 升序取第一个（如 `spec.md` → Stage2）
   - 无命中 → 报错并列出各 stage 的 pattern，提示 `--stage`
4. 在 `stages` 中定位 `stageKey`；`enabled === false` 则退出。
5. 读取目标文件（相对 `projectRoot`）；不存在则 `verdict=fail`，直接写报告（跳过评估）。

### 2. 准备评估内容

1. 读取目标文件正文（上限 120k 字符，超出则截断并标注 `[FILE_OVERSIZED]`）。
2. 读取阶段 `prompt_template`（按序尝试：`.harness/<path>`、`.claude/assess/bundled-api/<path>`）。
3. 将阶段 `criteria` 整理为评估清单（`criterion_key`、`description`、`blocking`、`weight`）。

**单文件模式**：仅依据已提供文件评判；依赖其他文件的项判 `passed=false`，`reason` 注明「单文件模式未提供依赖文件」。

### 3. 评估与计分

按 `prompt_template` + 评估清单 + 文件正文，由 Agent 逐条给出结论：

- 覆盖配置中**全部** `criterion_key`
- 每项：`passed`、`evidence`/`reason`；未通过时尽量注明 `file` + `location`

计分与裁决：

```text
score = round(通过项 weight 之和 / 全部项 weight 之和 × 100)
passLine = stage.thresholds.passing_score ?? config.passing_score ?? 70
score < passLine → fail；否则有未通过项 → partial；否则 → pass
```

配置有而评估未覆盖的项 → `passed=false`，`reason=评估未覆盖该项`。

### 4. 写报告并回报

写入 `<projectRoot>/.log/assess/stage-review-<stageKey>-<YYYYMMDD-HHMMSS>.md`。

**检查项格式**（必须用 checkbox + emoji，标记紧跟在 `criterion_key` 编号后面）：

- 通过：`- <criterion_key> [x] ✅ <description> — <evidence>`
- 未通过：`- <criterion_key> [ ] ❌ <description> — <reason> [<file> @ <location>]`

报告结构示例：

```markdown
# 评估报告

- **配置**: <config_name> v<version>
- **项目路径**: <projectRoot>
- **评估时间**: <ISO8601>
- **执行阶段**: <stageKey> <name>
- **审核文件**: <相对路径>
- **总体结论**: <通过|部分通过|不通过>
- **总分**: <score>

## 检查项

- S2-C1 [x] ✅ 用户故事是否按优先级排列 — 见 §用户故事，P1/P2 标注清晰
- S2-C2 [ ] ❌ 成功标准是否可度量 — 缺少量化指标 [spec.md @ §成功标准]

## 摘要

<llm_summary>

## 维度得分（若配置有 report_dimensions）

| 维度 | 得分 |
|------|------|
| 完备性 | 85 |
```

向用户简要回报：阶段、文件、结论、得分、报告路径；列出未通过项（若有）。

**完成后立即停止**——不要 `git status`、不要重复读文件验证、不要执行其他工作流。

## 示例

```text
/assess constitution.md
/assess specs/003-user-auth/spec.md
/assess --stage Stage4 specs/003-user-auth/tasks.md
```
