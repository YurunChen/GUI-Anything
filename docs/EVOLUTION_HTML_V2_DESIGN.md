# 🎨 项目演进史 HTML v2 — 信息增强设计稿

> **状态**: 设计评审中（未实现）
> **日期**: 2026-06-22
> **范围**: `--export-html`（项目功能演进史）的信息维度增强
> **背景**: 当前 `evolution.html` 只消费了 bundle 的单一维度（intent 修订流），信息密度偏低。
> 本稿在**不破坏现有分层红线**（`data → services → export`，见 AGENTS.md §4）的前提下，
> 把 bundle 里已有但未利用的数据挖出来，并引入 work-canvas 的组件词汇与设计系统。

---

## 1. 目标

四个新能力（与学长方向一一对应）：

1. **新维度 + KPI 仪表盘** — 把耗时 / tokens / 文件热点 / 试错强度 / 知识流挖出来，组成新分段。
2. **意图转折叙事（CC）** — AI 在 pivot 之间生成「为什么从 A 转向 B」的因果故事线。
3. **编码人格 SBTI** — 从行为数据反推 4 轴人格，趣味卡片 + 代表时刻。
4. **全局 Summary 一页式** — 跨所有会话的项目备忘录，固定 6 段格式。

work-canvas 融合方式：**借组件入管线**（把它的设计系统/组件搬进 `export/evolution/`，保持确定性数据管线）。

---

## 2. 数据盘点：已用 vs 可用（⚠️ 已抽样实测校正 2026-06-22）

数据真相源：`wiki/sessions/{id}/bundle.json`（`SessionBundle`，见 `data/wiki/session-bundle-types.ts`）。
**抽样 7 个真实 bundle 后，下表已按实测可靠度更新**（原稿假设过于乐观）。

| 维度 | 字段 | 实测可靠度 |
|------|------|-----------|
| 意图修订流 | `session.intent.history[]`（nodeTitle / titleDelta / intentKey / at） | ✅ 已用·可靠 |
| AI 纪元 | `services/ai/evolution-abstract.ts` 合成 | ✅ 已用 |
| 探索摘要 | `explorations[id].summary.text` | ✅ 已用 |
| **里程碑间耗时** | 相邻 `history[].at` 之差（**派生**，非 evidence.duration） | ✅ 可靠（时间戳每条都有） |
| **试错强度** | `explorations[id].meta.toolCount / errorCount / status` | ✅ **每条都有，可靠** |
| **知识命中** | `explorations[id].retrieval`（type/tags/score/excerpt） | ✅ 可靠（时有，无则 0） |
| **知识沉淀** | `explorations[id].write`（status/targetId/turnCount） | ✅ 可靠（时有，无则 0） |
| **落盘倾向** | `explorations[id].summary.persistMeta.type / confidence` | ✅ 可靠 |
| ~~耗时~~ | `curation.evidence[id].duration` | ❌ **恒为 0，弃用** |
| ~~Token 成本~~ | `curation.evidence[id].tokens` | ❌ **恒为 0，弃用** |
| 命令 | `curation.evidence[id].commands[]` | ⚠️ 仅 evidence 存在时有（稀疏），best-effort |
| 文件足迹 | `curation.evidence[id].files[]` | ❌ 实测为空，弃用（除非后续 pipeline 补填） |
| 意图聚类 | `curation.buckets` | ⚠️ 备用 |

**实测要点**：
- `curation.evidence` **大多为空**（7 个 bundle 仅 1 个有 1 条），磁盘上为 **snake_case**（`saved_at`/`exploration_id`），与 TS 类型 `BundleEvidenceEntry`(camelCase) 不一致 → 若读取需做映射。
- `duration`/`tokens`/`files` 即使在存在的 evidence 条目里也是 0/空 → **KPI 不能依赖它们**。
- **可靠信号集**：`meta.toolCount`、`meta.errorCount`、`meta.status`、`retrieval`、`write`、`persistMeta`、`history[].at`。本设计的 KPI / 试错强度 / SBTI 全部改为只用这一集合。

**关键连接键**：里程碑/子步骤的 `EvolutionRevision.explorationId` ↔ `explorations[explorationId]`（可靠）。
一个里程碑节点 = 1 个 pivot exploration + 其折叠的 children explorations，metrics 在节点层聚合。

---

## 3. 架构落点（遵守 AGENTS.md §4 红线）

```
data/                services/                     export/evolution/
─────────────────    ──────────────────────────   ──────────────────────
project-evolution    evolution-service.ts          styles.ts  (work-canvas 设计系统)
  -repository.ts  →    (聚合 metrics 进 node/era) →  client.ts  (tab 壳 + 新组件渲染)
  (聚合 evidence)     services/ai/                  template.ts(注入新 JSON)
evolution-types.ts     evolution-abstract.ts(现有)
  (扩展协议类型)        transition-narrative.ts(新)
                       coding-persona.ts(新)
                       project-digest.ts(新)
```

- 文件 IO 只在 `data/**`；新增 metrics 聚合在 `project-evolution-repository.ts`。
- AI 合成全部走 `services/ai/`，复用 `runClaudePrintPrompt` + `extractJsonFromText`，**失败回退**（与 `evolution-abstract.ts` 同构，`--no-ai` 时不加载）。
- UI 只消费内嵌 JSON，禁止 import services/repository（红线）。

---

## 4. 数据层改动（`evolution-types.ts` + repository）

### 4.1 新增 metrics 协议（只含实测可靠字段）

```ts
/** 里程碑/会话/项目聚合出的行为指标。仅用 explorations[].meta + history[].at（实测可靠）。*/
export interface EvolutionMetrics {
  toolCount: number;      // Σ meta.toolCount        ✅ 可靠
  errorCount: number;     // Σ meta.errorCount       ✅ 可靠
  retrievals: number;     // explorations[].retrieval 非空计数 ✅
  writes: number;         // explorations[].write 且 status∈created/updated ✅
  interrupted: number;    // meta.status==='interrupted' 计数 ✅
  // 派生耗时：相邻里程碑 at 之差（节点级）/ 首末 at 跨度（会话·项目级）
  elapsedMs?: number;     // ✅ 来自 history[].at，非 evidence.duration（后者恒 0）
  // best-effort，可能为空，渲染需判空、不进核心 KPI
  commands?: string[];    // ⚠️ 仅 evidence 存在时
}
```

> **已删除** `durationMs`/`tokens`/`files`：实测恒为 0/空，留着会让 KPI 失真。

- `EvolutionNode` 增 `metrics?: EvolutionMetrics`（pivot + children 聚合；`elapsedMs` = 下一里程碑 `at` − 本 `at`）。
- `EvolutionEra` 增 `metrics?: EvolutionMetrics`（Σ 其 nodeIds）。
- `ProjectEvolution` / `SessionEvolution` 增 `metrics: EvolutionMetrics`（`elapsedMs` = 首末 `at` 跨度）。
- `EvolutionExport` 增 `narrative?`、`persona?`、`digest?`（见 §6–§8）。

### 4.2 repository 提取

`project-evolution-repository.ts` 的 `extractSessionEvolution` 额外读取 `bundle.explorations[].meta/retrieval/write`，按 explorationId 输出可靠 metrics（**不读 evidence.duration/tokens/files**；`commands` 若读 evidence 需处理 snake_case 映射，best-effort）。`evolution-service.ts` 在 `buildSessionNodes` 时把 pivot+children 的 explorationId 聚合成 `node.metrics` 并用相邻 `at` 算 `elapsedMs`，再上卷成 era / session / project 级。

---

## 5. 功能 1：新维度 + KPI 仪表盘

### 5.1 KPI 仪表盘（顶部，work-canvas KPI 卡片）
替换/增强现有 hero stats，**只展示可靠卡片**：Session 数 · 里程碑 · pivot 次数 · 项目时间跨度（`elapsedMs`，首末 `at`）· 工具调用 Σ · 错误 Σ · 知识命中/沉淀 Σ。每卡一个图标 + 数字 + 标签。
> ⚠️ 不放「累计耗时(秒级)/tokens/文件数」——实测无数据。时间维度只用 `at` 跨度。

### 5.2 试错强度时间线
现有右栏节点按 `metrics.errorCount`/`toolCount` 染色（绿→红渐变），节点旁加小徽章「N 工具 · M 错误」+ 该阶段耗时（`elapsedMs` 人性化，如「~12 分钟」）。**需图例**（work-canvas 非协商项：颜色编码必须有 legend）。

### 5.3 文件热点（降级为可选 / best-effort）
`evidence.files` 实测为空 → **默认不做**。若后续 pipeline 补填 files，再启用：`fileHeat` Top N 横向条形。当前版本占位，不进 KPI。

### 5.4 知识流
新分段：左「站在哪些旧知识上」（retrieval excerpt + tags + score）→ 右「这一程沉淀了什么」（write targetId）。与现有 `--knowledge-graph` 呼应，可加跳转。**实测可靠**（retrieval/write 时有，无则展示空态）。

---

## 6. 功能 2：意图转折叙事（CC）

**新合成器** `services/ai/transition-narrative.ts`，契约同 `EraSynthesizer`：

- 输入：相邻里程碑对（前/后 title + delta + note + metrics）。
- 输出：每个 pivot 一段 `{ fromNodeId, toNodeId, why: string(≤60字), evidence?: string }`，解释「为什么转向」。
- 失败回退：无叙事（节点照常展示）。
- 渲染：在两个里程碑之间插入一条「转折卡」，串成因果故事线。

```ts
export interface TransitionNarrative {
  edges: { fromNodeId: string; toNodeId: string; why: string; evidence?: string }[];
}
```

挂在 `EvolutionExport.narrative`。

---

## 7. 功能 3：编码人格 SBTI

### 7.1 四轴（行为数据反推，非问卷）

| 轴 | 信号（来自 metrics/history） | 两极标签 |
|----|------|----------|
| 发散 ↔ 聚焦 | pivot 频率 / 里程碑数 | 发散思考者 ↔ 深潜者 |
| 探索 ↔ 执行 | explore/research intentKey 占比 vs edit/build | 先看后做 ↔ 直接开干 |
| 试错 ↔ 规划 | Σ errorCount / Σ toolCount 密度 | 莽撞快手 ↔ 三思后行 |
| 复用 ↔ 原创 | Σ retrievals / 里程碑数 | 站巨人肩膀 ↔ 重造轮子 |

每轴算 0–100 分（确定性，在 `services/evolution/persona-score.ts`），AI 只负责「起名 + 趣味解读」。

### 7.2 AI 合成器 `services/ai/coding-persona.ts`

- 输入：四轴分数 + 关键里程碑列表。
- 输出：
```ts
export interface CodingPersona {
  scores: { axis: string; value: number; leftLabel: string; rightLabel: string }[];
  typeCode: string;     // 如 "ENTP-Coder"
  title: string;        // "发散型·架构诗人"
  tagline: string;      // 一句标语
  reading: string;      // 趣味解读段落（先回顾"你在这些会话里做了X、然后Y"，再给评估）
  signatureNodeId?: string; // 代表时刻（链接到最能体现特质的里程碑）
}
```
- 失败回退：只展示分数 + 规则生成的 typeCode（不写解读）。
- 渲染：可分享卡片（4 条滑杆 + 人格名 + 标语 + 解读 + 代表时刻跳转）。挂 `EvolutionExport.persona`。

---

## 8. 功能 4：全局 Summary 一页式

**新合成器** `services/ai/project-digest.ts`，固定 6 段（对齐 work-canvas progress-report 骨架）：

```ts
export interface ProjectDigest {
  headline: string;                 // 1. 一句话主旨：项目正在长成什么
  chapters: { era: string; line: string; span: string }[]; // 2. 旅程章节（每纪元一行）
  turningPoints: { title: string; why: string }[];         // 3. 关键转折 Top N（复用 §6 叙事）
  outputs: { label: string; value: string }[];             // 4. 累计产出（KPI）
  learned: string[];                // 5. 学到了什么（write 沉淀的知识条目）
  nextSteps: string[];              // 6. 下一步 / 待决策（work-canvas "What needs your input"，只列真问题）
}
```

- 输入：project 级 metrics + eras + narrative + write 列表。
- 失败回退：用确定性数据填 1/2/4/5，跳过需要 AI 的 3/6。
- 渲染：独立 tab，一页可滚动 / 可打印。挂 `EvolutionExport.digest`。

---

## 9. work-canvas 组件借入清单

来源：work-canvas-skill（`assets/base.css` + `assets/interactions.js`）。借入 `export/evolution/styles.ts` 与 `client.ts`：

| work-canvas 组件 | 用在 | 备注 |
|------|------|------|
| KPI 卡片 | §5.1 仪表盘 | — |
| 状态徽章 badge | §5.2 试错强度 | 配 legend |
| 标签页 tabs（`initTabs`） | 顶层壳 | 总览 / 演进主线 / 知识流 / 编码人格 / 全景 Summary |
| scrollspy（`initScrollspy`） | 演进主线 | 我们已有自研 spy，二选一 |
| 排序/筛选表（`initTables`） | §5.3 文件热点 | — |
| 评论持久化（`initPersist`） | 里程碑批注 | localStorage，可让学长在节点上留言 |
| 复制按钮（`initCopy`） | nextSteps 命令 | paste-ready |
| 主题切换（`initTheme`） | 现有 30 主题 | 复用我们的，不引入它的双主题 |

**保留 work-canvas 非协商项**：单文件自包含（已满足）· provenance 页脚（加：哪个 agent + 模型 + 日期）· 颜色编码必带 legend · 「待决策」只列真问题 · 非破坏性。

---

## 10. 分期实施

| 阶段 | 内容 | 依赖 |
|------|------|------|
| P0 | 数据层：metrics 协议 + repository 提取 + service 聚合 | 无 |
| P1 | KPI 仪表盘 + 试错强度 + 文件热点（确定性，无 AI） | P0 |
| P2 | tab 壳 + work-canvas 组件借入（styles/client） | P1 |
| P3 | 知识流分段 | P0 |
| P4 | AI：意图转折叙事 | P0 |
| P5 | AI：编码人格 SBTI（分数确定性 + AI 解读） | P0 |
| P6 | AI：全局 Summary 一页式 | P4 |

每阶段独立可验证；AI 阶段全部带 `--no-ai` 回退。

---

## 11. 完成标准（AGENTS.md §7）

- [ ] `cd scheme && bun test && bunx tsc --noEmit`
- [ ] 未违反 §4 分层红线（UI 不 import services/repository）
- [ ] 新 AI 合成器全部失败回退、`--no-ai` 不加载
- [ ] 颜色编码均有 legend；页脚有 provenance
- [ ] 行为变更有测试；README/development 同步

---

## 12. 决策记录（2026-06-22 已确认）

1. **evidence 数据完整度** → ✅ **已抽样实测，结论：`duration`/`tokens`/`files` 恒为 0/空，evidence 大多缺失。**
   KPI 与所有指标改为只用可靠信号集（`meta.toolCount/errorCount/status`、`retrieval`、`write`、`history[].at`）。见 §2/§4.1 修订。
2. **tab vs 单页滚动** → ✅ **保留滚动叙事**：顶层 tab，但「演进主线」tab 内部维持现有单页 scrollspy 体验，tab 只切换视图、不破坏滚动。
3. **SBTI 轴定义** → ✅ **由实现方自定，趣味优先**（学长授权）。四轴沿用 §7，命名以有趣为主、可解释为辅。
4. **AI 调用次数** → ✅ **不合并**，3 个合成器各自独立调用 `claude --print`，以质量优先（学长授权）；各自带失败回退、`--no-ai` 不加载。

> 当前所有 4 项已解决，可进入实现规划（建议从 P0 数据层 + P1 无 AI 的 KPI/试错强度 起步，最快见效）。
