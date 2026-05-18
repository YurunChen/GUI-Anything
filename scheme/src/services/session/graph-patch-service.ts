import type { FlowchartHint, GraphPatch } from '../../data/protocol/observer-protocol';
import {
  FileGraphPatchRepository,
  type GraphPatchLedger,
  type GraphPatchRepository,
} from '../../data/session/graph-patch-repository';

export interface ApplyGraphPatchResult {
  applied: boolean;
  appliedCount: number;
  nextHints: Record<string, FlowchartHint>;
  errors: string[];
}

export interface GraphPatchService {
  loadLedger(sessionId: string): GraphPatchLedger;
  appendAndApply(
    sessionId: string,
    hints: Record<string, FlowchartHint>,
    patches: GraphPatch[],
  ): ApplyGraphPatchResult & { ledger: GraphPatchLedger };
}

const MAX_LEDGER_PATCHES = 20;

export function applyGraphPatch(
  hints: Record<string, FlowchartHint>,
  patches: GraphPatch[],
): ApplyGraphPatchResult {
  const nextHints: Record<string, FlowchartHint> = { ...hints };
  const errors: string[] = [];
  let appliedCount = 0;

  for (const patch of patches) {
    const ok = applyOnePatch(nextHints, patch, errors);
    if (ok) appliedCount += 1;
  }

  return {
    applied: appliedCount > 0,
    appliedCount,
    nextHints,
    errors,
  };
}

export class DefaultGraphPatchService implements GraphPatchService {
  constructor(private readonly repository: GraphPatchRepository = new FileGraphPatchRepository()) {}

  loadLedger(sessionId: string): GraphPatchLedger {
    return this.repository.load(sessionId) || {
      sessionId,
      updatedAt: Date.now(),
      patches: [],
    };
  }

  appendAndApply(
    sessionId: string,
    hints: Record<string, FlowchartHint>,
    patches: GraphPatch[],
  ): ApplyGraphPatchResult & { ledger: GraphPatchLedger } {
    const existing = this.loadLedger(sessionId);
    const mergedPatches = [...existing.patches, ...patches];
    const compactedPatches = compactLedgerPatches(mergedPatches);
    const nextLedger: GraphPatchLedger = {
      sessionId,
      updatedAt: Date.now(),
      patches: compactedPatches,
    };
    this.repository.save(sessionId, nextLedger);
    const applied = applyGraphPatch(hints, nextLedger.patches);
    return {
      ...applied,
      ledger: nextLedger,
    };
  }
}

function compactLedgerPatches(patches: GraphPatch[]): GraphPatch[] {
  if (patches.length <= MAX_LEDGER_PATCHES) return patches;
  return patches.slice(-MAX_LEDGER_PATCHES);
}

function applyOnePatch(
  hints: Record<string, FlowchartHint>,
  patch: GraphPatch,
  errors: string[],
): boolean {
  if (patch.op === 'merge_intents') {
    if (!patch.targetIntentKey || !patch.sourceIntentKeys || patch.sourceIntentKeys.length === 0) {
      errors.push('merge_intents requires targetIntentKey and sourceIntentKeys');
      return false;
    }
    const sourceSet = new Set(patch.sourceIntentKeys);
    for (const key of Object.keys(hints)) {
      if (!sourceSet.has(hints[key].intentKey)) continue;
      hints[key] = {
        ...hints[key],
        intentKey: patch.targetIntentKey,
        nodeId: patch.targetIntentKey,
      };
    }
    return true;
  }

  if (patch.op === 'rename_intent') {
    if (!patch.targetIntentKey || !patch.newTitle) {
      errors.push('rename_intent requires targetIntentKey and newTitle');
      return false;
    }
    let touched = false;
    for (const key of Object.keys(hints)) {
      if (hints[key].intentKey !== patch.targetIntentKey) continue;
      hints[key] = { ...hints[key], nodeTitle: patch.newTitle };
      touched = true;
    }
    if (!touched) {
      errors.push(`rename_intent target not found: ${patch.targetIntentKey}`);
      return false;
    }
    return true;
  }

  if (patch.op === 'reparent_intent') {
    if (!patch.targetIntentKey) {
      errors.push('reparent_intent requires targetIntentKey');
      return false;
    }
    if (
      patch.newParentIntentKey
      && createsCycle(hints, patch.targetIntentKey, patch.newParentIntentKey)
    ) {
      errors.push('reparent_intent rejected: cycle detected');
      return false;
    }
    let touched = false;
    for (const key of Object.keys(hints)) {
      if (hints[key].intentKey !== patch.targetIntentKey) continue;
      hints[key] = {
        ...hints[key],
        parentId: patch.newParentIntentKey ?? null,
      };
      touched = true;
    }
    if (!touched) {
      errors.push(`reparent_intent target not found: ${patch.targetIntentKey}`);
      return false;
    }
    return true;
  }

  if (patch.op === 'drop_intent') {
    if (!patch.targetIntentKey) {
      errors.push('drop_intent requires targetIntentKey');
      return false;
    }
    let touched = false;
    for (const key of Object.keys(hints)) {
      if (hints[key].intentKey !== patch.targetIntentKey) continue;
      hints[key] = { ...hints[key], dropFromChart: true };
      touched = true;
    }
    if (!touched) {
      errors.push(`drop_intent target not found: ${patch.targetIntentKey}`);
      return false;
    }
    return true;
  }

  errors.push(`unsupported patch op: ${patch.op}`);
  return false;
}

function createsCycle(
  hints: Record<string, FlowchartHint>,
  targetIntentKey: string,
  newParentIntentKey: string,
): boolean {
  if (targetIntentKey === newParentIntentKey) return true;
  const parentByIntent = new Map<string, string | null>();
  for (const hint of Object.values(hints)) {
    if (!parentByIntent.has(hint.intentKey)) {
      parentByIntent.set(hint.intentKey, hint.parentId);
    }
  }
  parentByIntent.set(targetIntentKey, newParentIntentKey);

  let cursor: string | null = newParentIntentKey;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === targetIntentKey) return true;
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = parentByIntent.get(cursor) ?? null;
  }
  return false;
}
