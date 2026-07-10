---
name: harness-plan
description: 读取任务清单并按 Harness 规划规则拆分为 Sprint 计划和进度文件。
triggers:
  - harness plan
  - harness-plan
  - sprint planning
  - plan sprint
  - Sprint 规划
  - Sprint 计划
  - 拆分 Sprint
  - 生成 Sprint
  - 生成进度文件
---

# Harness Sprint 规划

**上下文管理**: 保持当前上下文（需要看到 tasks.md 全貌）

## 指令

读取以下文件：
1. `specs/[FEATURE_ID]/tasks.md` — 完整任务清单
2. `.harness/prompts/planner.md` — Sprint 规划模板

按照 planner.md 中的规划规则，将 tasks.md 拆分为 Sprint。

### 输入参数（用户可选提供）

- Sprint 时长: $ARGUMENTS 或默认 1周
- 团队规模: 如用户未指定，默认 1人 + 自动化辅助
- 从哪个 Phase 开始: 如用户未指定，从 Phase 1 开始

### 执行步骤

#### Step 0 · Spec 颗粒度 pre-check（关联 Constitution 原则 XII · 阻断式）

在生成 sprint 计划前必须先验证 spec 颗粒度。任一阈值超出 → **立即阻断**，提示用户走拆分流程，不进入后续步骤。

1. **数 user story**：从 `specs/<feature>/spec.md` 中 grep `^### User Story \d+` 行数，得到 US 数 N。
2. **数 task**：从 `specs/<feature>/tasks.md` 中 grep `^- \[[ x]\] T\d+` 行数，得到 task 数 M（tasks.md 缺失则跳过此项）。
3. **判定**：
   - N > 3 → **BLOCK** · 输出："Spec 含 N 个 user story，超过原则 XII 阈值 3。请先拆分为 N 个独立 spec，再依次跑 specify → plan → tasks → harness.plan。"
   - M > 30 → **BLOCK** · 输出："Tasks.md 含 M 个 task，超过原则 XII 阈值 30。这是 Sprint 49 类型的爆炸前兆，必须先拆 spec 再重新生成 tasks。"
   - 两者都 ≤ 阈值 → 继续 Step 1。
4. **3 选 1 处理建议**（BLOCK 时一并输出）：
   - 拆 spec（推荐）：列出当前 N 个 US 标题，建议按 US 边界切成 N 个 spec
   - 合并 US：仅当几个 US 真正紧密耦合（独立交付不构成价值）
   - 升级 justification：在 spec 末尾显式写明不可拆分的根本理由 + 增大 sprint 容量预估
5. **不允许 bypass**：除非用户在命令里加 `--force` flag 显式承担风险（且必须在 sprint plan 里显式记录"已 bypass 原则 XII"）。

如需手工跑独立审计：`/harness.spec-check <feature>`。

#### Step 1+ · 生成 Sprint 计划（pre-check 通过后才执行）

1. 读取 tasks.md，理解全部 Phase 和依赖关系
2. 读取 planner.md，理解规划规则和工时估算基准
3. 按规则生成 Sprint 计划，每个 Sprint 包含：
   - 目标和对应 Phase
   - 按 Day/Batch 组织的任务清单（含并行标记和预估工时）
   - 验证检查点
   - 风险项
4. 将 Sprint 计划写入 `.harness/sprints/sprint-{n}.md`
5. 创建对应的进度文件 `.harness/sprints/sprint-{n}-progress.md`，格式要求：
   - 每个任务一行: `- [ ] T{ID} {描述} | L1:- L2:- |`
   - **每个批次末尾必须插入门禁行**: `- [ ] 🚧 **批次X.X门禁: L1 Step4 ({验证内容描述})** | 结果: - |`
   - 门禁行的验证内容根据批次类型确定：
     - 服务/核心批次: `启动+数据迁移验证` 或 `启动+接口端点验证`
     - 用户界面批次: `[TYPECHECK_COMMAND]` 或 `[UI_START_COMMAND]+页面可访问`
     - 集成批次: `[APP_START_COMMAND]+[UI_START_COMMAND]+真实接口调用链验证`
     - **涉真实外部服务或用户 UI 批次**: 必须含 4f 子步骤（`[REAL_SERVICE_CHECK]` 至少 1 次成功 + UI 肉眼截图 ≥ 2 张 + `[MOCK_INDICATOR]` 清洁）· 见 `.harness/prompts/evaluator.md` L1 Step 4f
   - 门禁行是 harness.exec 的强制检查点，不可被跳过
6. **👁 人工验证节点 HV 强制识别**（Sprint 47 血教训沉淀 · 2026-04-24）:
   - 涉真实外部服务场景或用户可见 UI 的 feature · 必须识别至少 **2 个人工验证节点**
     （典型：首个 US MVP 完成 + 批次 5 Polish 收官前）
   - HV 节点对应批次门禁行格式扩展：`🚧 **批次N门禁: L1 Step4 + 👁 HV-M (~N min, 验证人)**`
   - 规划规则详见 `.harness/prompts/planner.md` § 人工验证节点
   - 纯内部重构（零 UI / 零真实外部服务）可 0 个 HV · 但需在 Sprint 目标里显式说明
   - 未识别 HV 节点直接规划 · Sprint 收官时 Checkpoint 自动对 Constitution VIII -2 · X -1
7. 输出 Sprint 总览表 · 表中含 `HV 节点数` 列

8. **Post-Generation Assess Review** (conditional, after `sprint-{n}.md` is written):

   Check whether assess configuration exists (find first match, stop on hit):

   1. `.harness/assess-project.json`（工作区根目录）
   2. `assess-project.json`（工作区根目录）

   - **If neither exists**: skip silently, proceed to step 9
   - **If either exists**: execute the full workflow defined in `.harness/assess.md` against the **newly generated or last modified** Sprint plan file:
     - **Target file**: `.harness/sprints/sprint-{n}.md`（本次 `/harness.plan` 写入或修订的 Sprint **计划**文件；**非** `sprint-{n}-progress.md`）
     - **Invocation arguments**: 仅传 `sprint-{n}.md` 相对 `projectRoot` 的路径（如 `.harness/sprints/sprint-1.md`），由 assess 按文件名自动匹配 Stage6
     - **Do not** call `npx assess run`、外部 LLM 或 `assess.json`；严格按 `.harness/assess.md` 执行（判定阶段 → 准备内容 → 评估计分 → 写报告）
     - **Read-only**: 只审核 Sprint 计划文件，不修改 sprint 内容
     - 记录审核结果供 step 9 汇总：`verdict`、`score`、报告路径 `.log/assess/stage-review-*.md`、未通过项摘要
     - 若审核结论为 `fail` 或 `partial`：在 completion 报告中**醒目列出**未通过项与报告路径，提示用户修订 sprint 计划后可重新运行 `/assess` 或再次 `/harness.plan`

9. **向用户报告完成**：
   - 生成的 `.harness/sprints/sprint-{n}.md` 与 `.harness/sprints/sprint-{n}-progress.md` 路径
   - Sprint 总览表（含 HV 节点数）
   - **Assess review**（若 step 8 已执行）：阶段、结论、得分、报告路径、未通过项摘要；若未执行则省略

### 注意
- 不要修改 tasks.md
- Sprint 编号从已有 sprint 文件后继续
