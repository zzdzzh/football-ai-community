---
name: "speckit-plan"
description: "Execute the implementation planning workflow using the plan template to generate design artifacts."
argument-hint: "Optional guidance for the planning phase"
compatibility: "Requires spec-kit project structure with .specify/ directory"
triggers:
  - speckit plan
  - plan
  - speckit-plan
  - 实施计划
  - 写 plan
  - 生成计划
  - 规划
metadata:
  author: "github-spec-kit"
  source: "templates/commands/plan.md"
user-invocable: true
disable-model-invocation: false
---


## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks (before planning)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_plan` key
- If the YAML cannot be parsed or is invalid, skip hook checking silently and continue normally
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
    - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
    - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- When constructing slash commands from hook command names, replace dots (`.`) with hyphens (`-`). For example, `speckit.git.commit` → `/speckit-git-commit`.
- For each executable hook, output the following based on its `optional` flag:
    - **Optional hook** (`optional: true`):
      ```
      ## Extension Hooks
  
      **Optional Pre-Hook**: {extension}
      Command: `/{command}`
      Description: {description}
  
      Prompt: {prompt}
      To execute: `/{command}`
      ```
    - **Mandatory hook** (`optional: false`):
      ```
      ## Extension Hooks
  
      **Automatic Pre-Hook**: {extension}
      Executing: `/{command}`
      EXECUTE_COMMAND: {command}
  
      Wait for the result of the hook command before proceeding to the Outline.
      ```
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Outline

1. **Setup**: Run `.specify/scripts/bash/setup-plan.sh --json` from repo root and parse JSON for FEATURE_SPEC, IMPL_PLAN, SPECS_DIR, BRANCH. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load context**: Read FEATURE_SPEC and `.specify/memory/constitution.md`. Load IMPL_PLAN template (already copied).

3. **Execute plan workflow**: Follow the structure in IMPL_PLAN template to:
    - Fill Technical Context (mark unknowns as "NEEDS CLARIFICATION")
    - Fill Constitution Check section from constitution
    - Evaluate gates (ERROR if violations unjustified)
    - Phase 0: Generate research.md (resolve all NEEDS CLARIFICATION)
    - Phase 1: Generate data-model.md, contracts/, quickstart.md
    - Phase 1: Update agent context by running the agent script
    - Re-evaluate Constitution Check post-design

4. **Complete planning**: Command ends after Phase 2 planning（`plan.md` 及 research.md、data-model.md、contracts/、quickstart.md 等产物已生成）。

5. **Post-Generation Assess Review** (conditional, after `plan.md` / `IMPL_PLAN` is written):

   Check whether assess configuration exists (find first match, stop on hit):

   1. `.harness/assess-project.json`（工作区根目录）
   2. `assess-project.json`（工作区根目录）

   - **If neither exists**: skip silently, proceed to step 6
   - **If either exists**: execute the full workflow defined in `.harness/assess.md` against the **newly generated or last modified** `IMPL_PLAN` (`plan.md`):
     - **Target file**: `IMPL_PLAN`（本次 `/speckit-plan` 写入或修订的 `plan.md`）
     - **Invocation arguments**: 仅传 `IMPL_PLAN` 相对 `projectRoot` 的路径（如 `specs/003-user-auth/plan.md`），由 assess 按文件名自动匹配 Stage3
     - **Do not** call `npx assess run`、外部 LLM 或 `assess.json`；严格按 `.harness/assess.md` 执行（判定阶段 → 准备内容 → 评估计分 → 写报告）
     - **Read-only**: 只审核 `plan.md`，不修改 plan 内容
     - 记录审核结果供 step 6 汇总：`verdict`、`score`、报告路径 `.log/assess/stage-review-*.md`、未通过项摘要
     - 若审核结论为 `fail` 或 `partial`：在报告中**醒目列出**未通过项与报告路径，提示用户修订 plan 后可重新运行 `/assess` 或再次 `/speckit-plan`

6. **Report completion** to the user with:
    - Branch, `IMPL_PLAN` path, and generated artifacts（research.md、data-model.md、contracts/、quickstart.md 等）
    - **Assess review**（若 step 5 已执行）：阶段、结论、得分、报告路径、未通过项摘要；若未执行则省略

7. **Check for extension hooks**: After reporting completion, check if `.specify/extensions.yml` exists in the project root.
    - If it exists, read it and look for entries under the `hooks.after_plan` key
    - If the YAML cannot be parsed or is invalid, skip hook checking silently and continue normally
    - Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
    - For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
        - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
        - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
    - When constructing slash commands from hook command names, replace dots (`.`) with hyphens (`-`). For example, `speckit.git.commit` → `/speckit-git-commit`.
    - For each executable hook, output the following based on its `optional` flag:
        - **Optional hook** (`optional: true`):
          ```
          ## Extension Hooks
   
          **Optional Hook**: {extension}
          Command: `/{command}`
          Description: {description}
   
          Prompt: {prompt}
          To execute: `/{command}`
          ```
        - **Mandatory hook** (`optional: false`):
          ```
          ## Extension Hooks
   
          **Automatic Hook**: {extension}
          Executing: `/{command}`
          EXECUTE_COMMAND: {command}
          ```
    - If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Phases

### Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
    - For each NEEDS CLARIFICATION → research task
    - For each dependency → best practices task
    - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```text
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
    - Decision: [what was chosen]
    - Rationale: [why chosen]
    - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

### Phase 1: Design & Contracts

**Prerequisites:** `research.md` complete

1. **Extract entities from feature spec** → `data-model.md`:
    - Entity name, fields, relationships
    - Validation rules from requirements
    - State transitions if applicable

2. **Define interface contracts** (if project has external interfaces) → `/contracts/`:
    - Identify what interfaces the project exposes to users or other systems
    - Document the contract format appropriate for the project type
    - Examples: public APIs for libraries, command schemas for CLI tools, endpoints for web services, grammars for parsers, UI contracts for applications
    - Skip if project is purely internal (build scripts, one-off tools, etc.)

3. **Agent context update**:
    - Update the plan reference between the `<!-- SPECKIT START -->` and `<!-- SPECKIT END -->` markers in `CLAUDE.md` to point to the plan file created in step 1 (the IMPL_PLAN path)

**Output**: data-model.md, /contracts/*, quickstart.md, updated agent context file

## Key rules

- Use absolute paths for filesystem operations; use project-relative paths for references in documentation and agent context files
- ERROR on gate failures or unresolved clarifications
