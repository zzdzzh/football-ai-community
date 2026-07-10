# ⚠️ 已废弃：001-football-multi-agent-community

**废弃日期**: 2026-07-10  
**原因**: 违反 Constitution 原则 XII（7 个 User Story、31 个 task 超阈值）

本目录下的 `spec.md`、`plan.md`、`tasks.md` 等已迁移拆分。请使用以下新路径：

## 新 Spec 结构

| 用途 | 路径 |
|------|------|
| 产品愿景与路线图 | [specs/000-football-community-vision/spec.md](../000-football-community-vision/spec.md) |
| **当前可执行 feature（Harness 入口）** | [specs/001-football-feed-mvp/](../001-football-feed-mvp/) |
| MVP-2 Stats + Content | [specs/002-football-stats-content/spec.md](../002-football-stats-content/spec.md) |
| MVP-3 Scout + Tactical | [specs/003-football-scout-tactical/spec.md](../003-football-scout-tactical/spec.md) |
| MVP-4 Fan + 治理 | [specs/004-football-fan-community/spec.md](../004-football-fan-community/spec.md) |

## 下一步

```text
/harness.plan @specs/001-football-feed-mvp
```

完成 MVP-1 后，对 002 → 003 → 004 依次执行 `speckit-plan` → `speckit-tasks` → `harness.plan`。
