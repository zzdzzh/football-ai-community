# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]

**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]

**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]

**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]

**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]

**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]

**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]

**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]

**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

对照 `.specify/memory/constitution.md` 逐条判定（✅ PASS / ❌ FAIL / ➖ N/A）：

| 原则 | 判定 | 理由（关联本 plan 的具体方案要素） |
|------|------|-----------------------------------|
| I. 前后端分离架构 | | Vue3 前台 + Node.js `server/` + SQLite |
| II. 契约优先 | | `contracts/` 先定义后实现；多模块引用对端契约 |
| III. 测试纪律 | | 单元/集成/契约测试；高风险路径 100% 分支覆盖 |
| IV. AI/LLM 外部服务治理 | | 统一抽象层；Prompt 外置；超时降级 |
| V. 可观测性优先 | | 结构化日志 + 业务指标 |
| VI. 简单优先 (YAGNI) | | 无预防性复杂度；新依赖记入 Complexity Tracking |
| VII. 安全与权限 | | JWT + RBAC；HTTPS；用户级数据隔离 |
| VIII. 用户界面可视化验证 | | 人工测试截图 + 交互断言（非 Playwright） |
| IX. 用户界面视觉质量标准 | | 布局/品牌色/状态设计/交互反馈 |
| X. Corrector 修正回归纪律 | | 完整交互路径回归；任务 ID 追溯 |
| XI. 模块边界纪律 | | scope.yaml 申报；External Dependencies 对齐 |
| XII. Spec 颗粒度纪律 | | ≤3 user story；≤30 task |

**Gate Result**: [ALL PASS / 有违规但 Complexity Tracking 已说明 / BLOCK]

有 ❌ FAIL 项时 MUST 在下方 Complexity Tracking 表中给出豁免理由，否则 BLOCK 进入 Phase 0。

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
