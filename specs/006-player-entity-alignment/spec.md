# Feature Specification: 球员实体对齐（统计域 ↔ 履历域）

**Feature Branch**: `006-player-entity-alignment`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "球员实体对齐 —— 打通 003 统计球员（Scout/比赛统计）与 005 Transfermarkt 履历球员（关系分析），避免两套身份各说各话"

**Parent Vision**: [000-football-community-vision](../000-football-community-vision/spec.md)

## Clarifications

- **当前无待澄清问题**：对齐键默认 Transfermarkt 外部 ID 精确匹配；模糊姓名匹配与手工合并 UI 明确排除在 Out of Scope；置信度分级见 Key Entities。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 建立可核验的身份映射 (Priority: P1)

作为系统运营方，我希望在统计球员与履历球员之间建立可追溯的对齐关系（优先基于 Transfermarkt ID），以便同一真实球员在 Scout 与关系分析中可被识别为同一人。

**Why this priority**: 无映射则跨页跳转与联合展示无法可靠；是后续一切跨域能力的基础。

**Independent Test**: 在两侧均存在同一 Transfermarkt ID 的样例数据上运行对齐；可查询到一条置信度为「高」的映射，且不修改任一侧球员主键语义。

**Acceptance Scenarios**:

1. **Given** 统计域某球员已有 Transfermarkt ID，履历域存在相同外部 ID 的球员，**When** 执行对齐（定时或按需），**Then** 系统生成一条双向可查的映射，并标注匹配依据为 Transfermarkt ID、置信度为高
2. **Given** 某侧缺少 Transfermarkt ID，**When** 执行对齐，**Then** 不为该球员创建「高」置信度映射，也不伪造 ID
3. **Given** 同一 Transfermarkt ID 在某一侧出现冲突候选，**When** 执行对齐，**Then** 不自动建立映射，并记录冲突供排查（不静默覆盖）

---

### User Story 2 - 关系分析页跳转到统计能力 (Priority: P2)

作为登录用户，我在球员关系分析页查看两名球员后，若其已对齐到统计域，希望能一键进入基于统计域的相关能力（如该球员详情或 Scout 上下文提示），而不必在另一套搜索里重新消歧。

**Why this priority**: 直接兑现「跨域不各说各话」的用户价值；依赖 US1 的映射结果。

**Independent Test**: 打开一对已对齐球员的关系页，可见「统计域已关联」提示与跳转入口；未对齐球员不展示误导性链接。

**Acceptance Scenarios**:

1. **Given** 关系页球员 A、B 均已有高置信度映射，**When** 用户查看分析结论区，**Then** 每人显示已关联状态，并可跳转到对应统计域球员详情（或明确的统计域入口）
2. **Given** 球员仅部分对齐，**When** 用户查看页面，**Then** 仅对齐者显示跳转；未对齐者显示「暂未关联统计库」而非错误链接
3. **Given** 映射置信度非高，**When** 展示跳转，**Then** UI 标注「待确认」类提示，避免用户以为 100% 同一人

---

### User Story 3 - 双向解析查询 (Priority: P3)

作为已登录用户（或受鉴权的客户端），我希望通过统一查询接口：给出统计球员 ID 可得到对应履历球员（若有），反之亦然，以便后续功能复用对齐结果。

**Why this priority**: 为 Scout、Feed、后续功能提供可编程能力；可独立验收但价值次于前台闭环。

**Independent Test**: 对已知映射对调用解析查询，双向均返回对端 ID 与置信度；无映射时返回明确「未找到」。

**Acceptance Scenarios**:

1. **Given** 存在高置信度映射，**When** 用统计球员 ID 查询，**Then** 返回履历球员 ID、匹配依据与置信度
2. **Given** 存在映射，**When** 用履历球员 ID 查询，**Then** 返回统计球员 ID 与同等元数据
3. **Given** 无映射，**When** 查询，**Then** 返回未找到（非 500），不编造对端身份

---

### Edge Cases

- 履历球员有 TM ID，但统计域尚未写入 `transfermarkt_id`：不建立高置信度映射；可提示「待统计侧补齐外部 ID」
- 统计域多名球员误写同一 TM ID：冲突，不自动映射
- 履历同步失败或 `sync_status=failed`：不影响已有映射的读取；新对齐跳过不可用记录
- 用户未登录：解析与跨域跳转遵循现有鉴权（与关系页一致，需登录）
- 删除/合并球员（若未来发生）：映射失效时查询返回未找到，前端隐藏跳转

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 维护「统计球员 ↔ 履历球员」的身份映射记录，包含：两侧标识、匹配依据、置信度、建立/更新时间
- **FR-002**: 系统 MUST 以 Transfermarkt 外部 ID 精确匹配作为建立「高」置信度映射的唯一自动规则（MVP）
- **FR-003**: 系统 MUST NOT 在缺少可核验外部 ID 时编造映射或合并两域主键
- **FR-004**: 系统 MUST NOT 修改 003 统计球员主键语义，也 MUST NOT 将 005 履历表合并进统计表；两域表结构保持独立
- **FR-005**: 当检测到同一匹配键对应多候选冲突时，系统 MUST 拒绝自动映射并保留可观测冲突信息
- **FR-006**: 系统 MUST 提供按需或批处理对齐能力（至少一种可触发方式），使已具备 TM ID 的存量数据可生成映射
- **FR-007**: 关系分析相关界面 MUST 在映射可用时展示跨域跳转入口，不可用时不得展示失效链接
- **FR-008**: 系统 MUST 提供双向解析能力（统计→履历、履历→统计），返回置信度与匹配依据
- **FR-009**: 若对齐需扩展 003 侧契约或索引（例如强化 TM ID 可查性），MUST 先在 [003 tasks.md](../003-football-scout-tactical/tasks.md) 增补任务并由 003 模块落地，本 feature 不得静默改对端契约
- **FR-010**: 映射与解析操作 MUST 留下可观测记录（成功数、冲突数、跳过原因），便于运维排查

### Key Entities *(include if feature involves data)*

- **统计球员（Stats Player）**：003 域实体，主键为数据源球队阵容体系中的球员 ID；可持有 Transfermarkt 等外部 ID；服务于 Scout 与比赛统计
- **履历球员（Career Player）**：005 域实体，系统 UUID + `(external_source, external_id)`；服务于关系分析与履历时段
- **球员身份映射（Player Identity Link）**：连接一名统计球员与一名履历球员的对齐记录；含匹配依据（如 transfermarkt_id）、置信度、状态（有效/冲突搁置）
- **置信度**：映射可靠程度分级——**高** = Transfermarkt ID 精确唯一匹配；**中** = 预留（MVP 不自动产生）；**低** = 预留（MVP 不自动产生）。非高置信度不得作为「同一人」的默认断言

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** [Deferrable: no]: 在「两侧均有相同 Transfermarkt ID」的样例集上，自动对齐召回率达到 **100%**（应建尽建），且误建率为 **0**（无 TM ID 或冲突时不建高置信度映射）
- **SC-002** [Deferrable: no]: 登录用户打开已双向对齐的关系分析页后，**30 秒内**可完成「看到关联提示 → 进入统计域入口」的路径，无需重新搜索消歧
- **SC-003** [Deferrable: yes]: 对已映射球员，双向解析在数据已就绪时 **95%** 的请求在 **200ms 内**返回正确对端标识与置信度（人工或契约可测；可后验压测）
- **SC-004** [Deferrable: no]: 对齐批处理结束后，运维可从日志/指标中看到成功、冲突、跳过三类计数，冲突场次可人工复核

## 范围边界

### In Scope

- 独立身份映射模型与对齐规则（TM ID 精确匹配）
- 双向解析查询与关系页跨域跳转展示
- 存量可匹配数据的批处理/按需对齐触发
- 冲突不自动覆盖的安全策略
- 跨模块依赖申报与（如需）对 003 `tasks.md` 的增补任务提示

### Out of Scope

- 将两域合并为单一球员主表或改变 003/005 主键策略
- 仅凭姓名模糊匹配自动建立「高」置信度映射
- 管理员手工合并 UI、众包纠错工作流
- 关系分析的 LLM 叙事解读（另开 feature）
- 修改 005 履历采集源或替换 Transfermarkt
- 付费、计费、实时聊天等愿景 Out of Scope 项

## External Dependencies

| Producer Feature | 消费实体/服务/事件 | 用途 | 契约/模型引用路径 |
|------------------|-------------------|------|-------------------|
| 003-football-scout-tactical | Stats Player（含可选 Transfermarkt 外部 ID）、Players API | 读取统计域身份与外部 ID；解析对端 | [data-model.md](../003-football-scout-tactical/data-model.md)、[contracts/](../003-football-scout-tactical/contracts/) |
| 005-player-relationship-analysis | Career Player、Career Players API、关系分析页 | 读取履历域身份；在关系页展示跳转 | [data-model.md](../005-player-relationship-analysis/data-model.md)、[contracts/](../005-player-relationship-analysis/contracts/) |
| 001-football-feed-mvp | User、Auth | 登录鉴权（与关系页一致） | [data-model.md](../001-football-feed-mvp/data-model.md)、[contracts/](../001-football-feed-mvp/contracts/) |

## Assumptions

- Transfermarkt ID 是当前最可靠的跨域对齐键；003 侧已通过爬虫路径写入部分 `transfermarkt_id`，覆盖率随同步完善而提高
- MVP 不要求 100% 球员都有映射；「有 TM ID 的可对齐子集」即可交付价值
- 置信度「高」仅授予 TM ID 精确匹配；姓名相似等信号留待后续 feature，避免污染高置信度
- 不改变用户规模假设（中小型社区）；对齐批处理可在后台低峰执行
- 若 003 契约需为「按 TM ID 查找」增补接口或唯一性约束，将按多模块规约在 003 `tasks.md` 增补，而不是在 006 内直接改对端 OpenAPI
