# 数据流转链路（bundle 聚合）

## 完整数据流

```
app/
  useSessionPolling → SessionIndexService → _index.json
  useExplorationSummaries → SummaryOrchestrator → hydrateFromBundle → generateMissing (live)
  useSessionIntent → SessionBundleService.getSessionIntent
  useWikiMatches → SessionBundleService.ensureExplorationRetrieval
  useWikiCurator → bundle.curation + patch write (origin: saved)
  useGraphSnapshot → bundle.session.flow (sole graph writer, debounced)
  LiveObserverContainer (k audit) → ensureExplorationRetrieval

services/
  session-bundle-service / session-index-service  ← hooks facade
  exploration-card-pipeline.ensureExplorationCardRetrieval  ← retrieval before summary
  summary-orchestrator  ← hydrate / generate scheduling
  wiki-retrieval-policy.ensureExplorationRetrieval  ← bundle retrieval IO
  exploration-summary-service → patch exploration cards
  graph-cache-service → session-flow-repository
  session-runtime-policy.ts
  session-banner.ts

data/
  wiki/sessions/_index.json
  wiki/sessions/{id}/bundle.json
  wiki/knowledge/**/*.md
```

## 目录结构（三链）

```
wiki/
├── knowledge/                      ← 长期 markdown
├── sessions/
│   ├── _index.json
│   └── {sessionId}/bundle.json     ← 唯一 session 派生聚合
└── notes/
```

路径常量：`scheme/src/data/wiki/wiki-data-layout.ts`。

**Wiki 根目录**：`resolveWikiRoot()` → `FLOW_WIKI_DIR` ?? `FLOW_ROOT_DIR/wiki` ?? …。`flow-run.sh` 设 `FLOW_ROOT_DIR` 为仓库根 → **`<repo>/wiki/knowledge/`**。

## Wiki：检索 vs 落盘（两条链）

| 链 | 时机 | 读/写 | UI |
|----|------|-------|-----|
| **Prior 检索** | 用户问题写入 `exploration.question` 后（`running` 即可），每帧同步 | 只读 `listMatchPoolSync()`（`contexts/` + `entities/`，**不含** `summaries/`） | KNOWLEDGE 卡片（与 SUMMARY 无关） |
| **Post-summary 落盘** | **pivot 关闭 intent** 或 session idle sweep | Intent digest → **Wiki Curator**（skill-only 写 `contexts/`） | 卡片 meta：**仅 anchor 轮** `wiki saved/updated/skipped` |

二者独立：**有 prior hit** 写入 bundle `retrieval`；策展结果写入 bundle `write`。Restore 模式只读 bundle，不 live 检索。

**Prior 检索**：`wiki-retrieval-policy.ensureExplorationRetrieval`（经 `SessionBundleService`）。`useWikiMatches` 与 `exploration-summary-service` 共用；live 卡片顺序 **retrieval → summary**。Bundle `retrieval`：`undefined` 未扫 · `null` 无 hit · `object` 命中。Restore 禁用 live search。

### Intent 策展时间序

```mermaid
sequenceDiagram
  participant Claude as 左屏 Claude
  participant Obs as Observer UI
  participant Sum as ExplorationSummaryService
  participant Match as match-service
  participant Bucket as IntentBucketLedger
  participant Cur as WikiCuratorService
  participant Disk as wiki/knowledge/*.md

  Claude->>Obs: exploration complete
  Obs->>Obs: ensureExplorationRetrieval → bundle.retrieval
  Obs->>Sum: generateMissing
  Sum-->>Obs: SummaryItem ready + flowchart hint

  Obs->>Bucket: recordSummary (accumulate)
  alt title_delta pivot
    Obs->>Cur: curateIntent(closed intentKey)
    Cur->>Cur: buildIntentDigest N turns
    Cur->>Cur: resolveWikiDecisionAsync (digest)
    Cur->>Disk: skill write / update (no extractor fallback)
    Cur->>Bucket: markCurated + anchorExplorationId
    Obs-->>Obs: wiki badge on pivot 轮 only
  else continue/refine
    Obs-->>Obs: KNOWLEDGE only, no write badge
  end

  Note over Obs,Cur: session idle 30s → sweep open bucket
```

### 落盘决策树（`WikiCuratorService.curateIntent`）

1. 门禁：`shouldSkipIntentCurate` — 空 bucket / 全 low_value / 无 solution_detail 且无工具轮 → skip
2. `buildIntentDigest` — bucket 内多轮 `SummaryItem`（来自 bundle）+ `curation.evidence`
3. `findPriorHitForDigest` + `resolveWikiDecisionAsync`（digest 模式 prompt）
4. skill 失败或无 prior 且 rules 回落 → `skipped: skill_failed` / `skill_only_no_prior`（**不** `extractWikiEntry` → create）

## Wiki：治理链（Phase 2，手动 CLI）

与 Phase 1 ingest 同属 `/llm-wiki` skill；Phase 2 **不**在 Observer 内自动调度。

| 步骤 | 动作 |
|------|------|
| Flow pivot/sweep | Phase 1 ingest（自动）→ 有维护项则 Phase 2（同 `/llm-wiki` skill） |
| 用户 `k` | KNOWLEDGE prior 有误 → `knowledge/audit/*.md`（open） |
| `wiki-maintain.sh --list-audits` | 列出 open（severity、target_id）/ resolved |
| `wiki-maintain.sh --dry-run` | 报告：open audits + lint + intent 桶统计 |
| `wiki-maintain.sh` | `/llm-wiki` Phase 2 → 修条目 / 迁路径 / `audits_resolved` |
| 服务层 | `rebuildKnowledgeIndex`、log、progress（与 ingest 相同） |

Skill：`skills/llm-wiki/`（Phase 1 + Phase 2）。代码：`wiki-maintenance-report.ts`、`wiki-maintain-agent/`、`wiki-maintain-service.ts`。

Legacy：`FLOW_WIKI_LEGACY_PER_TURN=1` 恢复每 exploration `persistCompleted`（开发对比用）。

### 单轮时间序（legacy，已默认关闭）

```mermaid
sequenceDiagram
  participant Claude as 左屏 Claude
  participant Obs as Observer UI
  participant Sum as ExplorationSummaryService
  participant Match as match-service
  participant Wiki as WikiMaintenanceService
  participant Disk as wiki/knowledge/*.md
  participant Cache as wiki/sessions/*-summaries.json

  Claude->>Obs: user question → exploration running
  Obs->>Match: searchByQuerySync(question)
  Match->>Disk: listMatchPoolSync 扫盘
  Disk-->>Match: C001…
  Match-->>Obs: WikiMatch → KNOWLEDGE 卡片

  Obs->>Sum: generateMissing
  Sum->>Sum: Summary Agent + structured persistMeta
  Sum->>Cache: saveOne → *-summaries.json
  Sum-->>Obs: SummaryItem ready → SUMMARY

  Obs->>Wiki: persistCompleted (每 exploration 仅一次)
  Wiki->>Match: findPriorHit (同检索逻辑)
  Wiki->>Wiki: resolveWikiDecisionAsync (skill / print / rules)
  alt action skip 或 dedup
    Wiki-->>Obs: PersistResult skipped + log
  else create / update
    Wiki->>Disk: KnowledgeRepository.save
    Wiki-->>Obs: saved / updated
  end
```

### 落盘决策树（`maintainExploration`）

1. 门禁：`resolveWikiPersistPhase` 要求 exploration `complete` + AI summary ready；`persistence-service` 再调本服务
2. 无摘要文本 → `skipped: missing_summary`
3. `isLowValue`（短问候等）→ `skipped: low_value`
4. `findPriorHit` + `resolveWikiDecisionAsync`（Wiki Agent，不看 Summary `should_persist`）：
   - **skill**（`/llm-wiki`，`acceptEdits`）：Agent 可先写盘，再交 manifest；服务层 `resolveAgentWriteProof` 校验
   - **claude --print**：JSON 决策
   - **rules**：有 prior → 默认 `update`；无 prior → `extractWikiEntry` → `create` 或 `skip`
5. `decision.action === 'skip'` → `skipped`（reason 来自 Agent，如 `skip` / 无增量）
6. **create 路径** → `deduplicateKnowledge`：
   - 同 `sessionId` + `explorationId` 已有条目 → `already_exists_same_source`
   - `request` 与库内相似（≥0.85）→ `similar_request_exists`（仍会显示 prior hit 的 C001）
7. **update 路径** → `KnowledgeRepository.save(overwrite)` → `updated`（目标文件不存在则回落 `create`）

### 与「删了 wiki 仍命中」相关的机制

- **KNOWLEDGE 只认磁盘上的 `knowledge/{contexts,entities}/**/*.md`**，不认 bundle 内 summary 文本（删 bundle 摘要不影响 prior hit）。
- **删 markdown 后**：下一轮检索应无 hit；若仍有 hit，说明当时磁盘上仍有该文件（常见：本轮/上一轮 **落盘或 Agent skill 又写回** C001）。
- **Observer 进程内**：intent 策展对同一 bucket **只 curate 一次**（`curatedAt` 后不再触发）；删 `knowledge/*.md` **不会**自动重跑 Agent。Legacy per-turn：`useWikiPersistence` + `resolveWikiPersistPhase` 仍可对同一 `exploration.id` 只跑一次。

### Observer UI：检索 vs 落盘展示

| 区域 | 内容 |
|------|------|
| **探索卡片** | 用户问题 · 工具 meta · **KNOWLEDGE**（规则检索，`running` 起即可展示）· SUMMARY |
| **顶栏 `ObserverStatusBar`** | 第 1 行会话 meta；第 2 行 Intent（仅当前 `node_title`），无 Running tools / Summarizing 等活动行 |
| **探索卡片 meta** | `Done · N tools`；**仅 pivot/sweep anchor 轮** 追加 `wiki C001 saved`（多轮 `(3 turns)`） |

展示：读链 `wiki-turn-chrome.ts`（`resolveWikiTurnUi`）；写链 `wiki-write-chrome.ts`（`resolveWikiWriteChrome`）；积累/策展 `useWikiCurator` + `wiki-persist-policy.ts`。

- **frontmatter 遗留**：如 `source: exploration/exp_1`（非 `session_id` / `exploration_id` 块）时，解析得到 `sessionId=""`，`hydrateFromWiki` / `findBySource` 可能对不上，但 **按 request 相似度的检索与 dedup 仍可能命中 C001**。

### Session 派生存储（bundle 聚合）

| 路径 | 内容 | 删了的影响 |
|------|------|------------|
| `wiki/sessions/{id}/bundle.json` | `explorations[].summary/retrieval/write`、`session.flow`、`curation` | Continue/replay 卡片、图、策展状态丢失；live 可重建摘要 |
| `wiki/knowledge/**/*.md` | 长期知识 | KNOWLEDGE / prior hit / 策展落盘目标 |
| `wiki/sessions/_index.json` | workspace 继续指针 | `-c` 绑定可能退化为扫 bundle / 最新 jsonl |

旧布局 `{id}-summaries.json`、`-intent-buckets.json` 等 per-file 缓存已废弃；数据在 `bundle.json` 内。

摘要契约（跨层唯一形状）：`scheme/src/data/protocol/summary-contract.ts` — `SummaryItem` 从 cache/AI → 应用展示 → wiki 落盘，禁止拆成 `summaries` + `persistMeta` 两条并行 map 再拼装。

`knowledge-base/` 等旧布局：`scripts/wiki/migrate-wiki-layout.sh`（仅搬 contexts/entities/summaries；errors/snippets/decisions 直接删除）。工程类顶层目录 `errors/snippets/decisions/` 与 `E###`/`S###`/`D###` 条目在 `ensureKnowledgeMetaLayout` 时自动删除，或 `./scripts/wiki/purge-legacy-knowledge.sh`。

## 更新后的导入链

```typescript
// 应用层
import { DefaultExplorationSummaryService } from 'services/ai/exploration-summary-service';
import { DefaultWikiPersistenceService } from 'services/wiki/persistence-service';

// 服务层
import { KnowledgeRepository } from 'data/wiki/knowledge-repository';
import { EvidenceRepository } from 'data/wiki/evidence-repository';

// 不再存在
// import { FileWikiRepository } from 'data/wiki/repository'; ❌ 已删除
```

## 重启验证清单

1. [ ] 若 wiki 仍在旧目录，先运行 `./scripts/wiki/migrate-wiki-layout.sh`
2. [ ] 重启 observer（若曾误报 `skipped · already_exists`，需重启后 `getExistingIds()` 才会扫到 `knowledge/{type}/` 下已有条目）
3. [ ] 执行一个 exploration
4. [ ] 检查 `wiki/knowledge/{type}/` 有新格式文件（ID 如 `C002` 递增，不重复 `C001`）
5. [ ] 检查 `wiki/sessions/{sessionId}/bundle.json` 含 `explorations` / `curation` / `session.flow`
