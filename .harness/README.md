# Harness 驱动开发实践框架

## 概述

本框架将 Harness 工程架构应用于自动化辅助开发过程，结合 SDD（Spec-Driven Development）产出物，形成可执行、可验证、可度量的开发闭环。

**架构组成**: 四个操作层（约束、信息、验证、修正）+ 一个度量系统（监控全部操作层的健康度）。

**开发工具**: 项目约定的执行代理 / IDE
**SDD产出物**: spec.md → plan.md → data-model.md → contracts/ → tasks.md

## 核心循环

```
┌─────────────────────────────────────────────────────┐
│                    度量层 (Metrics)                   │
│   约束命中率 · 上下文覆盖率 · 验证通过率 · 修正收敛率  │
├─────────────────────────────────────────────────────┤
│                                                     │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐     │
│   │ Planner  │───>│Generator │───>│Evaluator │     │
│   │ Sprint规划│    │ 任务执行  │    │ 质量验证  │     │
│   └──────────┘    └──────────┘    └────┬─────┘     │
│        ▲                               │            │
│        │          ┌──────────┐         │            │
│        │          │Corrector │<────────┘            │
│        │          │ 定向修正  │   (不通过时)          │
│        │          └────┬─────┘                      │
│        │               │ (修正后重新验证)             │
│        └───────────────┘                            │
│                                                     │
├─────────────────────────────────────────────────────┤
│                   约束层 (Constraints)                │
│   Constitution · 项目约束 · 代码规范 · 安全规则        │
├─────────────────────────────────────────────────────┤
│                   信息层 (Context)                    │
│   spec.md · plan.md · data-model.md · contracts/    │
└─────────────────────────────────────────────────────┘
```

## 文件结构

```
.harness/
├── README.md                 # 本文件 - 框架总览
├── prompts/
│   ├── planner.md            # Sprint 规划 prompt 模板
│   ├── generator.md          # 任务执行 prompt 模板（8种任务类型）
│   ├── evaluator.md          # 四级验证 prompt 模板（编译→契约→E2E→Constitution）
│   ├── corrector.md          # 定向修正 prompt 模板（≤3轮+人工升级）
│   ├── metrics.md            # 五维度量采集与报告 prompt 模板
│   └── executor.md           # 执行协议（上下文管理、会话分段、进度持久化）
├── metrics/                  # 度量数据存放（自动生成）
│   └── sprint-{n}.json       # 每个Sprint的度量报告
└── sprints/                  # Sprint 规划存放（自动生成）
    ├── sprint-{n}.md          # 每个Sprint的任务清单
    └── sprint-{n}-progress.md # 执行进度追踪（跨会话持久化）
```

## 快速开始

### 1. Sprint 规划（Planner）

将 tasks.md 拆分为可执行的 Sprint：

```bash
# 在项目约定的执行代理中执行
复制 .harness/prompts/planner.md 的内容，替换变量后发送给执行代理
```

### 2. 任务执行（Generator）

逐个执行 Sprint 中的任务：

```bash
# 对每个任务，使用 generator prompt 模板
# 模板会自动注入约束层和信息层上下文
```

### 3. 质量验证（Evaluator）

每个任务完成后立即验证：

```bash
# 使用 evaluator prompt 模板检查
# 通过 → 进入下一个任务
# 不通过 → 进入 Corrector
```

### 4. 定向修正（Corrector）

不通过时精准修复：

```bash
# 使用 corrector prompt 模板
# 修正后重新进入 Evaluator
# 最多3轮修正，超过则人工介入
```

### 5. Sprint 度量（Metrics）

Sprint 结束后生成度量报告：

```bash
# 使用 metrics prompt 模板
# 自动计算各层指标
# 输出到 .harness/metrics/sprint-{n}.json
```

## 约束层详细规则

以下约束在整个开发过程中**始终生效**，Generator 和 Corrector 都必须遵守：

### 硬约束（违反即失败）

1. **Constitution 合规**: 所有代码必须符合 `.specify/memory/constitution.md` 的7条原则
2. **契约一致**: 接口实现必须与 `[API_CONTRACT_ROOT]` 中的项目接口契约完全一致
3. **数据模型一致**: 数据模型实现必须与 `[DATA_MODEL_DOC]` 定义一致
4. **项目技术约束**: 运行时、依赖、构建和测试工具以 Constitution、`plan.md` 与项目现有约定为准，不由 Harness 默认绑定
5. **安全底线**: 不存储明文密码、不暴露内部异常堆栈、所有受保护接口必须认证 / 授权

### 软约束（违反需记录理由）

1. **文件组织**: `[SOURCE_ROOT]` 下按 `[MODULE]` / 功能边界组织；测试位于 `[TEST_ROOT]` 或项目约定位置
2. **命名规范**: 遵循项目现有命名规范；新增命名约定需写入 Constitution 或 `plan.md`
3. **复杂度控制**: 单个方法不超过50行，单个文件不超过500行
4. **依赖限制**: 引入新依赖需在 plan.md Complexity Tracking 中记录理由
