# Executor 协议 — 上下文管理与执行编排

## 问题

Code Agent 有上下文窗口限制。一个 Sprint 29个任务，每个任务需要加载约束层+信息层上下文，
加上生成的代码、Evaluator 输出、Corrector 修正……一个会话装不下。

## 解决方案：分段执行 + 精准上下文 + 进度持久化

### 核心原则

```
1. 每个任务只加载它需要的上下文，不加载全部文档
2. 每个批次（Batch）是一个自然的上下文段落
3. 进度保存在文件中，跨会话可恢复
4. constitution.md 是永久约束层，每个会话自动加载
```

---

## 一、上下文加载协议

### 按任务类型的最小上下文

不同类型的任务需要不同的上下文。**只加载需要的，不加载全部**。

| 任务类型 | 需要读取的文件 | 不需要的 |
|---------|--------------|---------|
| 数据迁移 | [DATA_MODEL_DOC]（仅相关对象段落） | [API_CONTRACT_ROOT], spec.md |
| 数据模型 | [DATA_MODEL_DOC]（仅相关对象段落） | [API_CONTRACT_ROOT], spec.md |
| 业务逻辑单元 | 对应的 [API_CONTRACT_ROOT] 契约 + spec.md（仅对应 US 的验收场景） | 其他 US 的 spec, 其他契约 |
| 接口入口 | 对应的 [API_CONTRACT_ROOT] 契约 | [DATA_MODEL_DOC], spec.md |
| 用户界面接口适配 | 对应的 [API_CONTRACT_ROOT] 契约 | [DATA_MODEL_DOC], spec.md |
| 用户界面页面/组件 | spec.md（仅对应 US 的验收场景）+ 视觉/交互约定（constitution.md 已有） | [API_CONTRACT_ROOT], [DATA_MODEL_DOC] |
| 测试 | 被测代码文件 + 对应 [API_CONTRACT_ROOT] 契约 | spec.md 全文 |
| E2E 测试 | spec.md（仅对应 US 的验收场景） | [API_CONTRACT_ROOT], [DATA_MODEL_DOC] |

### 始终自动加载的上下文（通过 constitution.md）

- 项目技术与运行时约束
- 硬性编码规则
- 视觉/交互约定
- 项目结构

### 按需加载示例

```
# ❌ 错误：一次性加载全部
读取 spec.md（214行）+ plan.md（123行）+ data-model.md（380行）
+ 9个 contracts/*.yaml + constitution.md（155行）
= 上下文爆炸

# ✅ 正确：只加载这个任务需要的
任务 T025: 创建 [MODULE] 相关数据模型
→ 只读取 [DATA_MODEL_DOC] 中对应业务对象的段落（约60行）
→ 不需要 [API_CONTRACT_ROOT]，不需要 spec.md，不需要其他对象
```

---

## 二、会话分段策略

### 段落划分：按批次（Batch）分段

Sprint 1 的 Day 1-4 已经按批次组织了。每个批次是一个上下文段落。

```
会话 1: Day 1 全部（7个任务 + L1验证）
         ↓ 上下文开始变重
会话 2: Day 2 批次 2.1-2.2（通用组件 + 数据模型）
         ↓
会话 3: Day 2 批次 2.3（认证/权限能力 + 契约测试）
         ↓
会话 4: Day 3 批次 3.1（真实外部服务接入）
         ↓
会话 5: Day 3 批次 3.2-3.3（用户界面基础设施）
         ↓
会话 6: Day 4（集成验证 + E2E + Constitution审查 + 度量）
```

### 何时清空重开新会话？

| 信号 | 操作 |
|------|------|
| 一个批次完成后 | 可以继续，也可以新开（视上下文剩余空间） |
| 上下文压缩提示出现 | 立即保存进度，新开会话 |
| 切换到完全不同的模块 | 建议新开（用户界面→服务/核心，US1→US2） |
| Corrector 循环超过2轮 | 新开会话，带上失败报告重新处理 |
| 一个 Day 结束 | 建议新开，干净开始下一 Day |

### 新会话启动模板

每次新开会话时，发送以下内容建立上下文：

```
我正在执行 [PROJECT_NAME] 的 Sprint {N} 开发。

## 当前进度
请读取 `.harness/sprints/sprint-1-progress.md` 了解已完成和待执行的任务。

## 当前批次
我要执行的是 Day {N} 批次 {X}，包含以下任务：
{任务列表}

## 约束
请读取 constitution.md 了解项目约束。
请读取 `.specify/memory/constitution.md` 了解 Constitution 原则。

## 请开始执行第一个任务: {任务ID}
按照 `.harness/prompts/generator.md` 中的模板 {N} 执行。
需要的上下文：请读取 {具体文件和行号范围}。
```

---

## 三、进度持久化

### 进度追踪文件

每个任务完成后，更新 `.harness/sprints/sprint-1-progress.md`：

```markdown
# Sprint 1 执行进度

**最后更新**: {YYYY-MM-DD HH:mm}
**当前状态**: Day 2 批次 2.2 执行中
**已完成任务**: 12/29
**当前会话**: #3

## 任务状态

### Day 1 — 项目骨架 ✅
- [x] T001 服务/核心运行时初始化 | L1:✅ L2:N/A | 首次通过
- [x] T002 用户界面运行时初始化 | L1:✅ L2:N/A | 首次通过
- [x] T003 应用配置 | L1:✅ | 首次通过
- [x] T004 依赖服务启动脚本 | L1:✅ | 首次通过
- [x] T005 本地联调配置 | L1:✅ | 首次通过
- [x] T006 全局样式或设计系统接入 | L1:✅ | 首次通过
- [x] T007 静态检查配置 | L1:✅ | 首次通过
📊 Day 1 度量: 7/7通过, 首次通过率100%, 耗时2.5h

### Day 2 — 服务/核心基础设施 🔄
- [x] T008 数据迁移 V1 | L1:✅ L2:✅(10/10) | 首次通过
- [x] T010 枚举/常量类型 | L1:✅ | 首次通过
- [x] T011 统一错误处理 | L1:✅ | 首次通过
- [x] T012 审计日志 | L1:✅ L2:✅(9/10) | 首次通过
- [x] T120 集成测试环境 | L1:✅ | 首次通过
- [ ] T009 用户数据模型 | 待执行
- [ ] T122 日志过滤器 | 待执行
- [ ] T124 指标采集 | 待执行
...

### Day 3 — 外部服务接入 + 用户界面 ⏳
...

### Day 4 — 集成验证 ⏳
...

## 修正记录

| 任务 | 修正轮次 | 原因 | 修正内容 |
|------|---------|------|---------|
| T012 | 1 | AuditLog缺少traceId字段 | 补充字段和索引 |

## 度量快照

| 指标 | 当前值 |
|------|--------|
| 已完成任务 | 12/29 |
| 首次通过率 | 91.7% (11/12) |
| 修正次数 | 1 |
| 平均修正轮次 | 1.0 |
| 累计耗时 | 5.5h |
```

### 进度更新规则

1. **每个任务完成后**: 立即更新任务状态行（✅/❌ + 验证结果）
2. **每个批次结束后**: 更新度量快照
3. **每个 Day 结束后**: 汇总 Day 度量
4. **修正发生时**: 记录到修正记录表

---

## 四、子代理（Sub-Agent）策略

对于标记 [P] 的并行任务，可以使用 Code Agent 的 Agent 工具启动子代理：

### 适合子代理的场景

| 场景 | 说明 |
|------|------|
| 并行的独立文件创建 | 如 T010+T011+T012 三个独立组件 |
| 服务/核心和用户界面同时开发 | 如业务逻辑单元 + 用户界面接口适配 |
| 测试编写 | 测试与实现代码独立 |

### 子代理上下文注入

每个子代理启动时注入最小上下文：

```
启动子代理执行任务 T010:
- 读取 constitution.md（自动）
- 读取 [DATA_MODEL_DOC] 中 [MODULE] 相关枚举/常量定义
- 生成 [SOURCE_ROOT]/[MODULE]/model/ 下的枚举或常量文件
- 完成后报告：文件路径 + [BUILD_COMMAND] 结果
```

### 不适合子代理的场景

| 场景 | 原因 |
|------|------|
| 有依赖关系的任务链 | 如 T008→T009→T013→T014 |
| Evaluator Level 2+ 验证 | 需要对照多个文档，主会话更适合 |
| Corrector 修正 | 需要理解失败原因的完整上下文 |

---

## 五、异常恢复

### 会话意外中断

1. 读取 `sprint-1-progress.md` 找到最后完成的任务
2. 检查最后一个任务的文件是否完整（代码是否被截断）
3. 如果截断：删除不完整文件，重新执行该任务
4. 如果完整：从下一个任务继续

### 上下文溢出

1. Code Agent 会自动压缩早期消息
2. 如果压缩后仍然不够：保存进度，新开会话
3. 新会话用"新会话启动模板"恢复上下文

### Corrector 死循环

1. 3轮修正后仍 FAIL → 生成人工介入报告
2. 保存到 `sprint-1-progress.md` 的修正记录
3. 跳过该任务，标记为 ⚠️ BLOCKED
4. 继续后续不依赖它的任务
5. 人工解决后回来补完

---

## 六、执行命令速查

```bash
# 开始 Sprint 1
"请读取 .harness/sprints/sprint-1.md 和 .harness/prompts/generator.md，
 开始执行 Day 1 批次 1.1"

# 继续执行（新会话）
"请读取 .harness/sprints/sprint-1-progress.md，
 继续执行下一个未完成的任务"

# 执行验证
"请用 .harness/prompts/evaluator.md 的 Level {N} 模板，
 验证任务 {ID} 的输出"

# 执行修正
"请用 .harness/prompts/corrector.md，
 修正以下 Evaluator 失败项: {失败项}"

# 生成度量
"请用 .harness/prompts/metrics.md，
 基于 sprint-1-progress.md 的数据生成 Sprint 1 度量报告"
```

---

## 七、命令过渡指引

各 `/harness.*` 命令之间的标准使用流程和上下文衔接：

```
┌─────────────────────────────────────────────────────┐
│                  Sprint 生命周期                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  /harness.plan          规划Sprint（当前会话）        │
│       │                                             │
│       ▼                                             │
│  /harness.start         状态报告（子代理，干净上下文） │
│       │                  → 返回主会话，提示下一步      │
│       ▼                                             │
│  /harness.exec          执行任务（当前会话，循环）     │
│  /harness.exec          ← 连续执行，保持上下文        │
│  /harness.exec batch    ← 批量执行当前批次            │
│       │                                             │
│       │ 上下文变重？新开会话 ──────────────────┐      │
│       │                                      │      │
│       ▼                                      ▼      │
│  /harness.eval          验证（当前会话）  /harness.start│
│       │                                  (恢复进度)  │
│       │── PASS → 继续 /harness.exec                 │
│       │── FAIL → /harness.fix（当前会话，≤3轮）      │
│       │                                             │
│       ▼ (用户故事完成时)                              │
│  /harness.e2e US{N}     E2E测试（子代理）             │
│       │                                             │
│       ▼ (Sprint 最后一天)                             │
│  /harness.checkpoint    Constitution审查（子代理）    │
│       │                                             │
│       ▼                                             │
│  /harness.metrics       度量报告（子代理）             │
│       │                                             │
│       ▼                                             │
│  /harness.plan          规划下一个Sprint              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 关键衔接规则

1. `/harness.plan` → `/harness.start`：可以在同一会话，也可以新开。plan 产出的 sprint 文件已写入磁盘。
2. `/harness.start` → `/harness.exec`：start 用子代理执行，返回后在主会话继续 exec。
3. `/harness.exec` → `/harness.exec`：保持同一会话连续执行。上下文重时新开会话用 start 恢复。
4. `/harness.exec` → `/harness.eval`：同一会话，eval 可以看到 exec 刚生成的代码。
5. `/harness.eval` FAIL → `/harness.fix`：同一会话，fix 需要看到 eval 的失败详情。
6. `/harness.e2e`、`/harness.checkpoint`、`/harness.metrics`：都用子代理，不影响当前会话上下文。
