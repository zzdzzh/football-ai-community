---
name: harness-checkpoint
description: 执行 Sprint 收官 Constitution 审查，按核心原则评分并输出验收结果。
triggers:
  - harness checkpoint
  - sprint checkpoint
  - constitution review
  - Sprint 收官
  - Constitution 审查
  - 核心原则评分
---

# Harness Sprint Checkpoint（Constitution 审查）

**上下文管理**: 🔄 清空上下文 — 使用子代理执行，确保无偏见的全面审查

## 指令

对当前 Sprint 的所有代码进行 Constitution 全面合规审查。通常在 Sprint 最后一天执行。

### ⚠️ 实物验收前置条件（Sprint 47 血教训 · 2026-04-24 · 不可协商）

Checkpoint **不能只看 progress.md 数字**。主审（你）在委派子代理审查**之前**必须完成以下准备：

1. **查 Sprint feature 是否涉真实外部服务 / 用户 UI**（读 spec / progress 文件）
2. **若涉真实外部服务**：确认项目凭据可加载，并执行 `[REAL_SERVICE_CHECK]` 至少 1 次成功走查 · 拿到 runId + success 状态证据再委派子代理
3. **若涉用户 UI**：主审执行 `[APP_START_COMMAND]` / `[UI_START_COMMAND]` 并启动必要依赖服务 · 浏览器肉眼打开 feature 关联页面 · 截图 ≥ 2 张存证至 `[E2E_SCREENSHOT_DIR]` 或 `/tmp/sprint-{N}-checkpoint/`
4. **实物证据给子代理**：委派任务时必须把 runId / 截图路径 / 接口 response 片段作为证据传入 · 让子代理**基于实测证据审查**（不是 progress.md 数字）

若主审跳过以上准备直接委派子代理 → 子代理必须**显式声明"未收到实物证据"** · 对原则 VIII 至少扣 1 CONDITIONAL · 不允许默认 PASS。

### 输入参数

$ARGUMENTS — 可选，Sprint 编号。不指定则自动检测当前 Sprint。

### 执行步骤

使用 Agent 工具启动子代理，传入以下任务：

```
你是 Harness Constitution 审查员。你的职责是对代码进行独立的合规审查，不受之前开发上下文影响。

1. 读取 `.specify/memory/constitution.md`，提取全部7条原则及其 MUST 条款
2. 读取 `.harness/sprints/sprint-{N}-progress.md`，了解本 Sprint 完成的任务和文件变更
3. 逐条审查：

### 原则 I: 架构边界
- 检查服务端、用户界面和其他运行时边界是否符合 Constitution
- 检查是否存在跨边界直接耦合的实现
- 检查所有跨边界通信是否通过项目定义接口

### 原则 II: 接口契约驱动
- 读取 `specs/[FEATURE_ID]/contracts/` 或 `[API_CONTRACT_ROOT]` 中所有已实现的接口契约
- 逐个端点对照实现，检查路径/方法/参数/响应是否一致
- 检查是否存在契约中未定义的接口

### 原则 III: 测试纪律
- 检查认证、权限和高风险业务规则是否达到要求的分支覆盖
- 检查已实现接口是否有契约测试
- 检查测试是否可在 CI 环境独立运行（无外部依赖）

### 原则 IV: 外部服务抽象层
- 检查 `[EXTERNAL_SERVICE_NAME]` 调用是否通过 `[EXTERNAL_SERVICE_ADAPTER]` 接口
- 检查 Prompt/配置是否外置在 `[PROMPT_ROOT]` 或项目约定位置中
- 检查是否配置了超时和降级策略

### 原则 V: 可观测性
- 检查接口请求日志是否有结构化记录
- 检查外部服务调用是否有指标记录
- 检查错误是否有唯一追踪 ID

### 原则 VI: 简单优先
- 检查是否引入了不必要的抽象层
- 检查新依赖是否在 Complexity Tracking 中有记录
- 检查是否引入了不必要的架构拆分

### 原则 VII: 安全与权限
- 检查所有接口是否有认证检查
- 检查敏感操作是否有审计日志
- 检查是否存储明文密码或暴露内部异常

### 原则 VIII: 用户界面与真实服务验收（Sprint 47 沉淀 · 实物验收硬约束）
- **涉真实外部服务场景**：主审给的 runId 是否 success · `[EXTERNAL_SERVICE_METRIC]` 非零 · failed 为 0
- **涉用户 UI**：主审给的截图是否覆盖 feature 关键页面 ≥ 2 张 · 截图里关键字段非空
- **人工验证节点**：planner 规划时 identify 的 HV 节点是否全部有签收记录（progress.md 里 `👁 HV-M PASS`）
- **Spec 边界承诺**：是否存在"零 X 改动"类声明被本 Sprint 打破却未扣分（scope 漏洞诚实承认）
- 若主审未给实物证据（runId / 截图 / HV 签收），本原则**自动扣至少 1 CONDITIONAL**，不默认 PASS
- `[E2E_TOOL]` 的 Mock 模式通过 ≠ PASS（只能证明主路径不崩）

### 原则 IX: 用户界面视觉质量
- 布局/间距/色板合规 · HV 节点截图视觉审查

### 原则 X: Corrector 纪律
- Sprint 内 Corrector 轮次计数（含批次内收敛）· 非零不等于 FAIL
- 每轮 Corrector 是否严格走 `/harness.fix`（先审 spec 定预期 · TDD Red/Green · 回归 · 实物验收）
- 未经 /harness.fix 的乱改代码 → FAIL · 合规则按轮次扣：0 轮满分 · 1-2 轮扣 1-2 · 3+ 轮 FAIL

输出合规审查报告：
| 原则 | 状态 | 检查项数 | 通过数 | 问题详情 / 扣分依据 |
|------|------|---------|--------|---------|

### 得分规则（诚实扣分 · 避免 100/100 凑分）
- 全部核心原则 × 10 为满分
- 每原则按扣分项逐条扣（1 扣 1 · 2 扣 2 · 硬违反至少扣 5）
- 得分率 ≥ 99% PASS · ≥ 95% CONDITIONAL PASS · < 95% FAIL
- Sprint 47 教训：诚实扣分好过假 100/100 · scope 漏洞 / DEFERRED 未跑 / Corrector 发生都应扣

### Checkpoint 演进轨迹（必须）
若本 Sprint 的 Checkpoint 经历过撤回 / 重跑 · 必须在 checkpoint.md 显式记录：
- 初判（日期 + 得分 + 审查方法）
- 撤回原因（具体 SEV + 违反原则）
- 重跑（基于实测证据 + 对比初判差异）
- 纪律沉淀（教训去向 · memory / template）

总体结论：PASS / CONDITIONAL PASS / FAIL（基于得分阈值）

如有违反，输出具体的文件路径和行号，以及修复建议。
更新 sprint-*-progress.md 中的 Constitution 审查结果。
```
