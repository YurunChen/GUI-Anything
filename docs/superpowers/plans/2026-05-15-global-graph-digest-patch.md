# Global Graph Digest + Patch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global-view graph consolidation path that reuses current incremental flowchart hints, with deterministic local patch application and session-bound persistence for fast resume.

**Architecture:** Keep current per-exploration hint generation as the primary path, then run a periodic consolidation pass using a compressed graph digest. LLM outputs only `keep_incremental` or `graph_patch[]`; local services validate and apply patches over existing hints before calling the existing graph builder.

**Tech Stack:** TypeScript, Bun tests, existing Claude CLI integration, JSON file caches under `wiki/runtime`, React hooks in observer app.

---

## File Structure (new and modified)

- Create: `scheme/src/data/session/graph-patch-repository.ts`
- Create: `scheme/src/services/session/graph-digest-service.ts`
- Create: `scheme/src/services/session/graph-patch-service.ts`
- Create: `scheme/src/services/ai/graph-consolidation-service.ts`
- Create: `scheme/src/app/observer/hooks/useGraphConsolidation.ts`
- Modify: `scheme/src/data/protocol/observer-protocol.ts`
- Modify: `scheme/src/services/ai/structured-output.ts`
- Modify: `scheme/src/services/ai/flow-summaries.ts`
- Modify: `scheme/src/app/observer/LiveObserverContainer.tsx`
- Test: `scheme/src/services/session/graph-digest-service.test.ts`
- Test: `scheme/src/services/session/graph-patch-service.test.ts`
- Test: `scheme/src/services/ai/graph-consolidation-service.test.ts`
- Test: `scheme/src/app/observer/hooks/useGraphConsolidation.test.ts`

---

### Task 1: Define GraphPatch Protocol + Validator

**Files:**
- Modify: `scheme/src/data/protocol/observer-protocol.ts`
- Modify: `scheme/src/services/ai/structured-output.ts`
- Test: `scheme/src/services/ai/structured-output.test.ts`

- [ ] **Step 1: Write failing protocol/validator tests**

```ts
it('accepts valid graph patch list', () => {
  const raw = JSON.stringify({
    action: 'patch',
    graph_patch: [
      { op: 'merge_intents', source_intent_keys: ['a', 'b'], target_intent_key: 'ab', reason: 'duplicate', confidence: 0.8 },
    ],
  });
  const result = validateGraphConsolidationOutput(raw);
  expect(result.success).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test scheme/src/services/ai/structured-output.test.ts`  
Expected: FAIL with missing `validateGraphConsolidationOutput` and missing patch types.

- [ ] **Step 3: Add protocol types and validator**

```ts
export type GraphPatchOp = 'merge_intents' | 'rename_intent' | 'reparent_intent' | 'drop_intent';

export interface GraphPatch {
  op: GraphPatchOp;
  targetIntentKey?: string;
  sourceIntentKeys?: string[];
  newTitle?: string;
  newParentIntentKey?: string | null;
  reason: string;
  confidence: number;
}
```

- [ ] **Step 4: Re-run validator tests**

Run: `bun test scheme/src/services/ai/structured-output.test.ts`  
Expected: PASS for valid/invalid patch shape cases.

- [ ] **Step 5: Commit**

```bash
git add scheme/src/data/protocol/observer-protocol.ts scheme/src/services/ai/structured-output.ts scheme/src/services/ai/structured-output.test.ts
git commit -m "feat: add graph patch protocol and structured validator"
```

---

### Task 2: Build Data + Service Layer for Digest/Patch

**Files:**
- Create: `scheme/src/data/session/graph-patch-repository.ts`
- Create: `scheme/src/services/session/graph-digest-service.ts`
- Create: `scheme/src/services/session/graph-patch-service.ts`
- Test: `scheme/src/services/session/graph-digest-service.test.ts`
- Test: `scheme/src/services/session/graph-patch-service.test.ts`

- [ ] **Step 1: Write failing digest and patch service tests**

```ts
it('builds deterministic digest with capped nodes', () => {
  const digest = buildGraphDigest(snapshot, { maxNodes: 20 });
  expect(digest.nodes.length).toBeLessThanOrEqual(20);
});

it('rejects patch that creates parent cycle', () => {
  const result = applyGraphPatch(baseHints, [{ op: 'reparent_intent', targetIntentKey: 'a', newParentIntentKey: 'a', reason: 'bad', confidence: 0.9 }]);
  expect(result.applied).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test scheme/src/services/session/graph-digest-service.test.ts scheme/src/services/session/graph-patch-service.test.ts`  
Expected: FAIL because services and repository do not exist.

- [ ] **Step 3: Implement data-layer patch repository**

```ts
export class FileGraphPatchRepository implements GraphPatchRepository {
  load(sessionId: string): GraphPatchLedger | null { /* read JSON */ }
  save(sessionId: string, ledger: GraphPatchLedger): void { /* write JSON */ }
}
```

- [ ] **Step 4: Implement digest + patch apply services**

```ts
export function buildGraphDigest(snapshot: FlowGraphSnapshot, options: { maxNodes: number }): GraphDigest { /* stable sort + cap */ }

export function applyGraphPatch(hints: Record<string, FlowchartHint>, patches: GraphPatch[]): ApplyPatchResult { /* validate op + merge */ }
```

- [ ] **Step 5: Run service tests**

Run: `bun test scheme/src/services/session/graph-digest-service.test.ts scheme/src/services/session/graph-patch-service.test.ts`  
Expected: PASS, including cycle rejection and deterministic digest.

- [ ] **Step 6: Commit**

```bash
git add scheme/src/data/session/graph-patch-repository.ts scheme/src/services/session/graph-digest-service.ts scheme/src/services/session/graph-patch-service.ts scheme/src/services/session/graph-digest-service.test.ts scheme/src/services/session/graph-patch-service.test.ts
git commit -m "feat: add graph digest and patch services"
```

---

### Task 3: Add LLM Consolidation Service (Reuse Existing AI Runner)

**Files:**
- Create: `scheme/src/services/ai/graph-consolidation-service.ts`
- Modify: `scheme/src/services/ai/flow-summaries.ts`
- Test: `scheme/src/services/ai/graph-consolidation-service.test.ts`

- [ ] **Step 1: Write failing consolidation tests**

```ts
it('returns keep_incremental when evidence is insufficient', async () => {
  const result = await generateGraphConsolidationAI(input, mockRunner);
  expect(result.action).toBe('keep_incremental');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test scheme/src/services/ai/graph-consolidation-service.test.ts`  
Expected: FAIL due to missing consolidation service.

- [ ] **Step 3: Implement service by reusing existing Claude execution path**

```ts
const promptText = `${GRAPH_CONSOLIDATION_PROMPT}\n\n${formatGraphDigest(input.digest)}`;
const raw = await runClaudeSpawn({ args, promptText, timeoutMs: 45000, taskId: `graph_patch_${Date.now()}` });
return parseGraphConsolidationOutput(raw.output);
```

- [ ] **Step 4: Run consolidation tests**

Run: `bun test scheme/src/services/ai/graph-consolidation-service.test.ts`  
Expected: PASS for keep + patch outputs and malformed JSON fallback.

- [ ] **Step 5: Commit**

```bash
git add scheme/src/services/ai/graph-consolidation-service.ts scheme/src/services/ai/flow-summaries.ts scheme/src/services/ai/graph-consolidation-service.test.ts
git commit -m "feat: add graph consolidation ai service"
```

---

### Task 4: Wire App Hook for Periodic Consolidation

**Files:**
- Create: `scheme/src/app/observer/hooks/useGraphConsolidation.ts`
- Modify: `scheme/src/app/observer/LiveObserverContainer.tsx`
- Test: `scheme/src/app/observer/hooks/useGraphConsolidation.test.ts`

- [ ] **Step 1: Write failing hook tests**

```ts
it('triggers consolidation every 3 completed explorations', async () => {
  const state = await runHookScenario({ completedCount: 3 });
  expect(state.lastAction).toBe('consolidation_called');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test scheme/src/app/observer/hooks/useGraphConsolidation.test.ts`  
Expected: FAIL because hook is missing.

- [ ] **Step 3: Implement hook with safe trigger policy**

```ts
if (completedCount - lastConsolidatedCount >= 3) {
  // build digest -> call consolidation -> validate/apply patch
}
```

- [ ] **Step 4: Integrate in container without moving data logic into app layer**

```ts
const consolidation = useGraphConsolidation({ sessionId, graphSnapshot, hints: flowchartHints });
const mergedHints = consolidation.hintsOverlay ?? flowchartHints;
```

- [ ] **Step 5: Run hook and observer tests**

Run: `bun test scheme/src/app/observer/hooks/useGraphConsolidation.test.ts scheme/src/app/ui/live-observer-flow-body.test.ts`  
Expected: PASS with unchanged baseline behavior when no patch is emitted.

- [ ] **Step 6: Commit**

```bash
git add scheme/src/app/observer/hooks/useGraphConsolidation.ts scheme/src/app/observer/LiveObserverContainer.tsx scheme/src/app/observer/hooks/useGraphConsolidation.test.ts
git commit -m "feat: wire periodic graph consolidation in observer"
```

---

### Task 5: End-to-End Regression + Safety Checks

**Files:**
- Modify: `scheme/src/app/ui/flow/graph/graph-builder.test.ts`
- Modify: `scheme/src/services/session/graph-cache-service.test.ts`
- Modify: `scheme/src/services/session/session-binding-policy.test.ts`

- [ ] **Step 1: Add regression tests for patch overlay + cache interaction**

```ts
it('applies valid merge patch and still produces deterministic graph ids', () => {
  const snapshot = buildFlowGraphSnapshot({ ...inputWithPatchedHints });
  expect(snapshot.nodes.map(n => n.id)).toEqual(expectedIds);
});
```

- [ ] **Step 2: Run full target suite**

Run: `bun test scheme/src/services/session/graph-cache-service.test.ts scheme/src/services/session/session-binding-policy.test.ts scheme/src/services/session/graph-digest-service.test.ts scheme/src/services/session/graph-patch-service.test.ts scheme/src/services/ai/graph-consolidation-service.test.ts scheme/src/app/observer/hooks/useGraphConsolidation.test.ts scheme/src/app/ui/flow/graph/graph-builder.test.ts`  
Expected: all PASS, no baseline graph behavior regressions.

- [ ] **Step 3: Run lint checks for changed files**

Run: `bunx tsc --noEmit` (or repo standard lint command)  
Expected: no new diagnostics from changed modules.

- [ ] **Step 4: Commit**

```bash
git add scheme/src/services/session/graph-cache-service.test.ts scheme/src/services/session/session-binding-policy.test.ts scheme/src/app/ui/flow/graph/graph-builder.test.ts
git commit -m "test: add consolidation and graph stability regressions"
```

---

## Self-Review Checklist (completed by implementer before merge)

- [ ] Spec coverage: each section in `global-graph-digest-patch` has matching task(s)
- [ ] No placeholders (`TODO/TBD/...`) remain in changed production code
- [ ] Type consistency: `GraphPatch` fields and names are identical across protocol, validator, service, and tests
- [ ] Backward compatibility: no change to existing incremental hint behavior when consolidation is disabled or returns keep

---

Plan complete and saved to `docs/superpowers/plans/2026-05-15-global-graph-digest-patch.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
