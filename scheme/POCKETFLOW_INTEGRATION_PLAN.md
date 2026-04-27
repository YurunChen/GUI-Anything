# Scheme Flow Observer Plan

基于 [Pocket Flow](https://the-pocket.github.io/PocketFlow/) 的核心理念，scheme 当前不应该先发展成通用 workflow 框架，而应该明确为：

```text
Claude Code Live Observer + Knowledge Memory
```

它的第一目标是帮助用户保持心流：旁路观察 Claude Code 会话，自动整理过程、总结结果、沉淀知识、提示下一步，但不抢主线、不打断用户。

---

## 1. 当前方案到底是什么

当前 scheme 是一个 **Claude Code 会话旁路观察器**：

```text
Claude Code JSONL Session
  ↓
Live Observer Polling
  ↓
Exploration Extraction
  ↓
Summary / Wiki / Evidence / Directions
  ↓
OpenTUI Side Panel
```

它目前承担四类职责：

| 模块 | 职责 | 当前状态 |
|------|------|----------|
| Live Observer | 实时展示 Claude Code 会话状态 | 已有 |
| Summary | 为每个 completed exploration 生成短总结 | 已有，但来源不透明 |
| Knowledge Memory | 保存 evidence 和 knowledge-base | 已有，但需要更稳定的可观测性 |
| Directions / Notes | 辅助用户记录灵感、查看下一步方向 | 已有雏形 |

它不是：

- 通用 Node/Flow 框架。
- 多 agent 编排器。
- 自动执行用户任务的 pipeline。
- Mermaid / Graphviz 可视化工具。
- 向量数据库或 RAG 框架。

---

## 2. 心流原则

scheme 的设计应该围绕“助流”，不是“控流”。

### 2.1 应该做

- 被动观察，不打断 Claude Code 主交互。
- 自动保存有价值的上下文，减少用户记忆负担。
- 用极少的状态提示告诉用户：现在发生了什么、学到了什么、下一步可选做什么。
- 让所有 AI 自动行为可解释：summary 来源、cache 是否命中、wiki 为什么 saved/skipped。
- 把复杂链路藏在服务层，只在 UI 暴露有用的结果和异常。

### 2.2 不应该做

- 默认展开大量 trace，制造视觉噪音。
- 主动推动用户进入下一步，打断当前思考。
- 为了 Pocket Flow 概念而抽象出通用框架。
- 把内部 pipeline 设计成用户必须理解的产品概念。

---

## 3. 与 Pocket Flow 的关系

Pocket Flow 的核心是 **Graph + Shared Store**：

- `Node`：处理一个小任务。
- `Action`：节点执行结果，用于选择下一步。
- `Shared Store`：节点之间共享状态。
- `Flow`：连接节点，不绑定具体工具和 vendor。

scheme 应该借用这个思想，但只用于内部数据链路：

| Pocket Flow 概念 | scheme 中的落点 | 说明 |
|------------------|-----------------|------|
| Node | 一个内部处理步骤 | summary cache、summary generate、wiki save 等 |
| Action | 处理结果标签 | hit、generated、saved、skipped、failed |
| Shared Store | PipelineContext | session、exploration、summary、evidence、wiki 状态 |
| Flow | 内部 pipeline runner | 只服务 observer 数据链路 |

关键约束：

- 不先做通用 Flow DSL。
- 不先做 registry 插件系统。
- 不先做并行、多 agent 或外部 workflow 编排。
- Pipeline trace 是调试/可观测能力，不是主要 UI。

---

## 4. UI 和功能合约优先

在实现 pipeline 之前，先理清 UI 应该回答的三个问题。

### 4.1 现在发生了什么？

用户需要快速知道当前 Claude Code 会话是否还在工作。

应展示：

- 当前 session 文件名 / session id。
- runtime model。
- token 状态。
- 当前 phase。
- completed / error 数量。
- 最新 exploration 状态。
- tools / errors 概览。

当前已有大部分能力，但 `FlowObserverShell` 承载了太多布局、键盘、状态和派生逻辑，后续应拆分。

### 4.2 我们学到了什么？

用户需要知道每个 exploration 的结果是否可靠。

应展示：

- Summary 文本。
- Summary 来源：`cache` / `wiki` / `ai` / `fallback`。
- Summary 是否正在生成。
- Wiki 保存状态：`saved` / `skipped` / `failed` / `pending`。
- skipped/failed reason。
- evidence 是否已保存。
- knowledge 文件 id 或路径。

这是当前最缺的 UI 合约。没有 provenance 时，用户无法判断“summary 质量差”是因为：

- 命中了旧 cache。
- 从 wiki hydrate 出来。
- AI 生成失败走了 fallback。
- prompt 本身质量差。
- session 绑定错了。

### 4.3 下一步做什么？

下一步建议应该是辅助，不应该抢主线。

应展示：

- directions 仅手动触发或轻提示。
- 若证据不足，明确说明 insufficient。
- 相关 wiki match 只作为参考。
- notes 输入保持低干扰。

---

## 5. 目标与非目标

### 5.1 目标

| 目标 | 当前问题 | 改进方向 |
|------|----------|----------|
| UI 合约清晰 | Summary/Wiki/Cache 来源不透明 | 先补 provenance 和 reason |
| 心流稳定 | UI 混合了状态、结果、记忆、建议 | 重组为“发生了什么 / 学到了什么 / 下一步” |
| 数据链路可追踪 | summary、wiki、evidence 分散在 hooks/services | 用内部 pipeline trace 串联 |
| AI 输出稳定 | 自由文本/弱结构导致质量不稳 | 增加轻量结构化校验 |
| 知识可复用 | knowledge-base 保存后较少参与后续生成 | 后置轻量 RAG |

### 5.2 非目标

第一阶段不做：

- 通用 Flow 框架。
- Flow DSL。
- registry 插件系统。
- Mermaid / Graphviz / SVG 图。
- vector database / BM25 索引。
- 多 Exploration 用户任务编排。
- 多 agent 协作。
- 大依赖。

---

## 6. 推荐架构

```text
app/
  observer/
    LiveObserverContainer.tsx
    hooks/
      useSessionPolling.ts          # session 数据
      useExplorationSummaries.ts    # summary + source/provenance
      useWikiPersistence.ts         # wiki save status + reason
  ui/
    flow/
      FlowObserverShell.tsx         # shell，只做布局和快捷键
      ContextPanel.tsx              # notes / context side panel
      CommandBar.tsx                # 操作提示
    live-observer-flow-body.tsx     # exploration 列表

services/
  ai/
    exploration-summary-service.ts  # summary hydrate/generate
    summary-cache.ts                # runtime cache
    structured-output.ts            # 轻量 validator
    rag-context-service.ts          # 后置
  wiki/
    persistence-service.ts          # evidence/knowledge save
    match-service.ts                # wiki match
  pipeline/
    node.ts                         # 后置：极简 Node 类型
    runner.ts                       # 后置：内部 runner
    trace.ts                        # 后置：trace 记录

data/
  protocol/
    observer-protocol.ts            # 现有类型扩展 provenance/status
    pipeline-protocol.ts            # 后置：trace 类型
  wiki/
    knowledge-repository.ts
    evidence-repository.ts
```

---

## 7. Phase 0：UI Provenance 和状态合约

### 目标

先让用户看得懂当前 UI：summary 从哪里来，wiki 为什么 saved/skipped，runtime cache 是否命中。

### 文件

- 修改：`scheme/src/data/protocol/observer-protocol.ts`
- 修改：`scheme/src/services/ai/summary-cache.ts`
- 修改：`scheme/src/services/ai/exploration-summary-service.ts`
- 修改：`scheme/src/services/wiki/persistence-service.ts`
- 修改：`scheme/src/app/observer/hooks/useExplorationSummaries.ts`
- 修改：`scheme/src/app/observer/hooks/useWikiPersistence.ts`
- 修改：`scheme/src/app/ui/live-observer-flow-body.tsx`

### 设计

扩展 summary 状态：

```typescript
export type SummarySource = 'cache' | 'wiki' | 'ai' | 'fallback';

export interface SummaryItem {
  id: SessionScopedId;
  sessionId: SessionId;
  explorationId: ExplorationId;
  text: string;
  source: SummarySource;
  status: 'ready' | 'pending' | 'failed';
  persistMeta: WikiPersistMeta | null;
  reason?: string;
}
```

扩展 persist 状态：

```typescript
export interface PersistResult {
  id: SessionScopedId;
  status: 'saved' | 'skipped' | 'failed';
  reason?: string;
  path?: string;
}
```

UI 示例：

```text
Summary  source: ai
Wiki     skipped: already_persisted
Cache    miss → generated
```

### 验收标准

- [ ] 每条 summary 显示来源：cache/wiki/ai/fallback。
- [ ] Wiki skipped/failed 显示 reason。
- [ ] runtime cache 命中/过期行为可定位。
- [ ] `-r` 自动发现 session 时，不会让用户误以为一定是新 AI summary。

---

## 8. Phase 1：UI 结构重组

### 目标

把 UI 从“信息堆叠”改成三段式心流面板：

```text
Now      当前会话和 exploration 状态
Learned  summary + provenance + wiki status
Next     optional directions + notes + wiki match
```

### 文件

- 修改：`scheme/src/app/ui/flow/FlowObserverShell.tsx`
- 修改：`scheme/src/app/ui/live-observer-flow-body.tsx`
- 修改：`scheme/src/app/ui/flow/ContextPanel.tsx`
- 可能新增：`scheme/src/app/ui/flow/ExplorationCard.tsx`
- 可能新增：`scheme/src/app/ui/flow/SummaryPanel.tsx`
- 可能新增：`scheme/src/app/ui/flow/StatusBadges.tsx`

### 拆分建议

| 组件 | 职责 |
|------|------|
| `FlowObserverShell` | 顶层布局、快捷键、active tab |
| `SessionHeader` | model/token/session/phase |
| `ExplorationCard` | 单个 exploration 的状态和问题 |
| `SummaryPanel` | summary 文本、source、cache/wiki 状态 |
| `NextPanel` | directions、wiki match、notes |

### 验收标准

- [ ] Summary 区域不再混入工具统计、wiki 状态、directions 的过多信息。
- [ ] provenance 和 reason 是轻提示，不抢占主内容。
- [ ] directions 默认不打断当前阅读。
- [ ] `FlowObserverShell` 不继续膨胀。

---

## 9. Phase 2：结构化输出稳定 summary 和 persist decision

### 目标

提升 AI summary 质量，减少 fallback 和弱结构解析。

### 文件

- 新增：`scheme/src/services/ai/structured-output.ts`
- 修改：`scheme/src/services/ai/flow-summaries.ts`
- 修改：`scheme/src/services/wiki/auto-extractor.ts`

### 输出结构

```typescript
export interface StructuredSummaryOutput {
  summary: string;
  solution_detail: string;
  persist: {
    should_persist: boolean;
    type: 'error' | 'snippet' | 'decision' | 'context' | 'none';
    confidence: number;
    reason?: string;
  };
  tags?: string[];
  key_command?: string | null;
}
```

### 策略

- Prompt 明确要求严格 JSON。
- 手写 validator 校验必要字段。
- 校验失败时 fallback，并在 provenance/reason 中标注。
- Summary 不超过 UI 可读长度，但 knowledge 的 `solution_detail` 保留更多上下文。

### 验收标准

- [ ] JSON 解析失败不会污染 wiki。
- [ ] fallback summary 在 UI 中明确显示 `source=fallback`。
- [ ] `persist.type` 和知识目录映射稳定。
- [ ] 生成质量差时可以从 UI 判断原因。

---

## 10. Phase 3：极简内部 Pipeline Trace

### 目标

使用 Pocket Flow 的 Node / Action / Shared Store 思想，整理内部数据链路，但不暴露成通用框架。

### 文件

- 新增：`scheme/src/data/protocol/pipeline-protocol.ts`
- 新增：`scheme/src/services/pipeline/node.ts`
- 新增：`scheme/src/services/pipeline/runner.ts`
- 新增：`scheme/src/services/pipeline/trace.ts`

### 最小类型

```typescript
export type PipelineAction = 'success' | 'skip' | 'failed' | 'retry';

export interface PipelineNode<TContext> {
  id: string;
  exec(context: TContext): Promise<PipelineAction> | PipelineAction;
}

export interface NodeTrace {
  id: string;
  status: 'pending' | 'running' | 'success' | 'skipped' | 'failed';
  message?: string;
  startedAt?: number;
  endedAt?: number;
}
```

### 首批节点

| Node | 职责 |
|------|------|
| `SummaryCacheNode` | hydrate runtime cache |
| `SummaryGenerateNode` | generate missing summary |
| `WikiHydrateNode` | hydrate saved knowledge status |
| `EvidenceSaveNode` | save aggregated evidence |
| `KnowledgeExtractNode` | extract knowledge entry |
| `KnowledgeSaveNode` | save knowledge markdown |

### UI 原则

Trace 默认折叠，只在异常或调试模式展示。

### 验收标准

- [ ] 每个 completed exploration 可获得内部 trace。
- [ ] trace 解释 cache hit/miss、wiki saved/skipped、fallback reason。
- [ ] 不引入新依赖。
- [ ] 不形成通用 workflow API。

---

## 11. Phase 4：轻量 RAG 上下文

### 目标

让已有 knowledge-base 在后续 summary 生成中复用，但不引入 vector index。

### 文件

- 新增：`scheme/src/services/ai/rag-context-service.ts`
- 修改：`scheme/src/services/ai/exploration-summary-service.ts`
- 修改：`scheme/src/services/ai/flow-summaries.ts`

### 第一版策略

```text
current question + recent tool/file signals
  ↓
KnowledgeRepository.search()
  ↓
top 3 knowledge entries
  ↓
注入 summary prompt
```

### 约束

- prompt 明确标注：知识仅供参考，不是当前事实。
- 无匹配时不影响生成。
- trace 中记录 `rag matched: n`。

### 验收标准

- [ ] 最多注入 3 条相关知识。
- [ ] 不命中时无行为变化。
- [ ] UI 可显示是否使用了 wiki context。

---

## 12. 后置能力

以下能力暂不进入当前计划：

- 通用 Flow DSL。
- 多 Exploration 用户任务编排。
- 并行节点执行。
- Flow 模板保存。
- Mermaid / Graphviz 导出。
- BM25 / vector index。
- 多 agent 协作。

这些能力只有在 `Flow Observer + Knowledge Memory` 稳定后才考虑。

---

## 13. 推荐实施顺序

1. **Phase 0：UI Provenance 和状态合约**
2. **Phase 1：UI 结构重组**
3. **Phase 2：结构化输出**
4. **Phase 3：极简内部 Pipeline Trace**
5. **Phase 4：轻量 RAG**

原因：

- 先解决用户看不懂的问题。
- 再解决 UI 干扰心流的问题。
- 然后提升 AI 输出质量。
- 最后再把内部链路 Node 化。

---

## 14. 成功标准

- [ ] 用户能一眼看出 summary 来源。
- [ ] 用户能知道 wiki 为什么 saved/skipped/failed。
- [ ] UI 主要展示结果，不默认暴露内部复杂度。
- [ ] `-r` / `-c` / 新 session 的 cache 行为可解释。
- [ ] Summary 质量问题可以从 provenance 定位。
- [ ] Pipeline 只服务内部可观测性，不演化成重型框架。
- [ ] Knowledge 能在后续生成中被复用，但不会污染当前事实。

---

## 15. 下一步

先细化 Phase 0 的实施任务：

```text
Summary source provenance
  ↓
Persist reason propagation
  ↓
Runtime cache hit/miss status
  ↓
UI light badges
```

完成后再进入 UI 结构重组。
