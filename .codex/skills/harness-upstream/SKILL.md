---
name: harness-upstream
description: 5 分钟反向沉淀 · 把评审会发现的纪律一句话快速加入 Constitution 待审条目（不立即生效，等下次 /speckit.constitution 正式吸纳）。
handoffs:
  - label: Promote pending principle to constitution
    agent: speckit.constitution
    prompt: 把 .specify/memory/constitution-pending.md 里待审条目正式吸纳进 constitution
---

## User Input

```text
$ARGUMENTS
```

格式：
```
/harness.upstream constitution "<纪律一句话>"
/harness.upstream incident      "<症状>" "<根因>" "<修法>" "<触发哪条规则升级>"
/harness.upstream pattern       "<observation>"
```

仅 `constitution` 子命令是 Q2 PoC 必达；`incident` / `pattern` 是 Q3 完整版预留位。

## Outline

**用途**：让评审会 / 故障复盘 / 跑 Sprint 现场识别的"早该有的规则"在 5 分钟内落到文档，不丢失。

**关键约束**：
- 本命令**不修改** `.specify/memory/constitution.md`。修改的是 `.specify/memory/constitution-pending.md`（待审条目）。
- 待审条目下次跑 `/speckit.constitution` 时由用户人工裁决：吸纳 / 修改 / 拒绝。
- 不允许此命令直接升原则编号 / 改 MAJOR 版本 — 那是 `/speckit.constitution` 的职责。

## Subcommand: constitution

**输入**：单参数，一句话纪律陈述。

**执行流程**：

1. 解析输入。如果输入为空或不像一句完整陈述，提示用户重写。

2. 读取 `.specify/memory/constitution.md`，识别现有原则编号上限（如 XII），下一编号为 PENDING-{N}。

3. 读取 `.specify/memory/constitution-pending.md`（不存在则用以下骨架创建）：
   ```markdown
   # Constitution Pending Principles

   待审条目。等下次 /speckit.constitution 正式吸纳。

   ---
   ```

4. 基于用户输入，AI 推导以下字段并填入待审条目模板（不要让用户手填这些字段，AI 自己推 + 标置信度）：

   - **触发故事**：从用户输入中识别"在哪个 Sprint / 任务 / 现场踩到了"。如果用户输入没说，写"待补 · /harness.upstream 时未提供"。
   - **不可协商度**：硬约束 / 软约束 / 信息性。AI 按以下规则判：
     - 含"必须 / 禁止 / 不允许 / 阻断"等强词 → 硬约束
     - 含"建议 / 应该 / 优先" → 软约束
     - 仅描述事实 → 信息性
   - **影响清单（候选）**：哪些 prompts / templates / commands 文件可能要联动改。AI 用关键词匹配粗略给候选清单（如纪律提到"测试" → evaluator.md / spec-template.md），最终由 `/speckit.constitution` 时人工核对。
   - **预估版本号 bump**：MAJOR / MINOR / PATCH（按 speckit.constitution 的语义版本规则）。

5. 在 `constitution-pending.md` 末尾追加：
   ```markdown
   ## PENDING-{N}：{AI 起的简短标题}

   **原始陈述**: {用户输入逐字}

   **触发故事**: {步骤 4 推导}
   **不可协商度**: {硬/软/信息性}
   **影响清单（候选）**: {文件清单}
   **预估版本 bump**: {MAJOR/MINOR/PATCH}

   **添加时间**: {ISO 日期时间}
   **添加方**: /harness.upstream constitution
   **状态**: 待审

   ---
   ```

6. 输出 Sync Impact Report 草稿到 stdout（不写入文件）：
   ```
   ## Sync Impact Report (draft · pending review)

   PENDING-{N} 已加入 constitution-pending.md。

   - 标题：{AI 起的标题}
   - 不可协商度：{...}
   - 影响清单候选：{...}

   下一步：跑 /speckit.constitution 时人工裁决。
   或运行 /harness.upstream constitution 删除 PENDING-{N}（如发现录错）来撤回。
   ```

7. 不输出其他内容。**用户付出 ≤ 5 分钟**：输入一句话即可。AI 全推导。

## Subcommand: incident

**Q3 上线**。Q2 用 evaluator FAIL 后强制弹出的 5 分钟复盘模板（Task #17）替代。

格式预留：4 字段（症状 / 根因 / 修法 / 触发哪条规则升级），落到 `.harness/incidents/{ts}-{task-id}.md`。

## Subcommand: pattern

**Q3 上线**。识别 evaluator FAIL 案例规模化模式（≥ 3 次同类失败），归档到 `.harness/patterns/`，喂 LoRA 训练池。

---

## 验收

- `/harness.upstream constitution "测试必须带 cycle 断言"` → 在 constitution-pending.md 追加 PENDING-{N} + 输出 Sync Impact Report 草稿
- 不修改 constitution.md 主文件
- 用户全程 ≤ 5 分钟（仅一句话输入）
- 下次 /speckit.constitution 时能读到待审条目并提示用户处理

## 设计依据

- 第 4.4.1.4 节"5 分钟积累机制"
- 第 4.5.4 节"反向沉淀流程"
- backlog.md §0.11"反向沉淀"
- task #15 PoC 设计
