---
name: harness-update
description: 重新运行 install.sh，将 SpecKit + Harness 工具链更新到 toolkit 最新版本。
triggers:
  - harness update
  - update toolkit
  - upgrade toolkit
  - 更新工具链
  - 更新 harness
  - 工具链更新
---

# Harness 工具链更新

**上下文管理**: ✅ 保持当前上下文（本命令主要是读配置 + 跑 shell）

## 指令

根据 `.harness/install.json` 中记录的源路径与安装参数，重新执行 `install.sh`，实现工具链一键更新。

### 输入参数

`$ARGUMENTS` — 可选：

| 模式 | 触发词 | 行为 |
|------|--------|------|
| **强制覆盖**（默认） | 无参数，或含 `force` / `强制` | 在原始安装参数基础上确保带 `--force`，覆盖已存在的同名文件 |
| **安全模式** | `safe` / `安全` / `--safe` | 使用原始安装参数，不添加 `--force`；已存在文件跳过 |

### 执行步骤

1. **读取安装记录**:
   - Read `.harness/install.json`
   - 若文件不存在 → 停止，提示用户先运行 `bash <toolkit>/install.sh` 完成首次安装
   - 解析字段：
     - `toolkit_root` — 工具链仓库根目录（`install.sh` 所在目录）
     - `args` — 上次安装时的命令行参数数组
     - `installed_at` — 上次安装时间（仅供参考）

2. **校验工具链源**:
   - 确认 `$toolkit_root/install.sh` 存在
   - 若不存在 → 停止，提示用户检查 `toolkit_root` 路径是否仍有效（仓库是否移动/删除）

3. **解析更新模式**:
   - 将 `$ARGUMENTS` 转小写后检查是否含 `safe` / `安全` / `--safe`
   - 命中 → **安全模式**；否则 → **强制覆盖模式**（默认）

4. **强制覆盖模式 — 必须先征得用户确认** ⛔:

   在运行任何 shell 命令之前，向用户展示以下信息并等待明确同意：

   ```
   即将以【强制覆盖】模式更新 SpecKit + Harness 工具链：

   源:     {toolkit_root}
   目标:   {当前项目根目录}
   参数:   {合并后的 args，含 --force}
   上次安装: {installed_at}

   强制覆盖将替换已存在的 slash commands、prompts、templates 等同名文件。
   项目业务代码与 .harness/sprints/ 等运行时数据不会被删除，但工具链文件会被覆盖。

   是否继续？(请回复「确认」或「取消」)
   ```

   - 用户回复确认（如「确认」「继续」「yes」）→ 进入步骤 5
   - 用户回复取消或拒绝 → 停止，输出「已取消更新」
   - **不得**在用户未明确确认的情况下执行 install.sh

5. **组装安装参数**:
   - 以 `install.json` 中的 `args` 数组为基准
   - **强制覆盖模式**: 若 `args` 中尚无 `--force`，追加 `--force`
   - **安全模式**: 从 `args` 中移除 `--force`（若存在）
   - 保留其他原始参数（`--agent`、`--with-superpowers`、`--no-constitution` 等）

6. **执行更新**:

   在项目根目录运行：

   ```bash
   bash "{toolkit_root}/install.sh" {组装后的参数}
   ```

   - 使用 Shell 工具执行，等待完成
   - 检查退出码；非 0 → 报告错误输出，停止
   - 成功 → install.sh 会自动刷新 `.harness/install.json`

7. **输出结果摘要**:

   ```
   ✅ 工具链更新完成

   模式:     {强制覆盖 | 安全}
   源:       {toolkit_root}
   安装时间: {install.json 中的新 installed_at}

   建议：若 slash command 有结构性变更，可新开 Agent 会话以确保加载最新命令。
   ```

### 错误处理

| 情况 | 处理 |
|------|------|
| `install.json` 不存在 | 提示首次安装命令 |
| `toolkit_root/install.sh` 不存在 | 提示路径失效，需手动修正 `install.json` 或重新安装 |
| 用户取消确认 | 正常退出，不执行 |
| install.sh 执行失败 | 展示 stderr/stdout，不声称成功 |

### 示例

```
/harness.update              # 默认强制覆盖，先确认再执行
/harness.update safe         # 安全模式，跳过已存在文件
/harness.update 安全模式      # 同上
```
