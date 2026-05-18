import { useEffect, useRef, useState } from 'react';
import type { FlowGraphSnapshot, FlowchartHint } from '../../../data/protocol/observer-protocol';
import { buildGraphDigest } from '../../../services/session/graph-digest-service';
import { generateGraphConsolidationAI } from '../../../services/ai/graph-consolidation-service';
import {
  DefaultGraphPatchService,
  type GraphPatchService,
} from '../../../services/session/graph-patch-service';

export interface UseGraphConsolidationInput {
  sessionId: string;
  graphSnapshot: FlowGraphSnapshot;
  hints: Record<string, FlowchartHint>;
  completedExplorationCount: number;
  enabled?: boolean;
}

export interface GraphConsolidationState {
  hintsOverlay: Record<string, FlowchartHint> | null;
  lastAction: 'idle' | 'consolidation_called' | 'keep_incremental' | 'patch_applied' | 'patch_failed';
}

export function shouldTriggerConsolidation(completedCount: number, lastConsolidatedCount: number): boolean {
  return completedCount - lastConsolidatedCount >= 3;
}

export function useGraphConsolidation(input: UseGraphConsolidationInput): GraphConsolidationState {
  const { sessionId, graphSnapshot, hints, completedExplorationCount, enabled = true } = input;
  const patchServiceRef = useRef<GraphPatchService | null>(null);
  if (!patchServiceRef.current) {
    patchServiceRef.current = new DefaultGraphPatchService();
  }
  const [state, setState] = useState<GraphConsolidationState>({
    hintsOverlay: null,
    lastAction: 'idle',
  });
  const lastConsolidatedCountRef = useRef(0);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!enabled || !sessionId) return;
    if (!shouldTriggerConsolidation(completedExplorationCount, lastConsolidatedCountRef.current)) return;
    if (runningRef.current) return;

    runningRef.current = true;
    setState((prev) => ({ ...prev, lastAction: 'consolidation_called' }));

    const digest = buildGraphDigest(graphSnapshot, { maxNodes: 30 });
    generateGraphConsolidationAI({ digest })
      .then((result) => {
        if (result.action !== 'patch' || result.graphPatch.length === 0) {
          lastConsolidatedCountRef.current = completedExplorationCount;
          setState((prev) => ({ ...prev, lastAction: 'keep_incremental' }));
          return;
        }
        const applied = patchServiceRef.current!.appendAndApply(sessionId, hints, result.graphPatch);
        lastConsolidatedCountRef.current = completedExplorationCount;
        if (!applied.applied) {
          setState((prev) => ({ ...prev, lastAction: 'patch_failed' }));
          return;
        }
        setState({
          hintsOverlay: applied.nextHints,
          lastAction: 'patch_applied',
        });
      })
      .catch(() => {
        setState((prev) => ({ ...prev, lastAction: 'patch_failed' }));
      })
      .finally(() => {
        runningRef.current = false;
      });
  }, [completedExplorationCount, enabled, graphSnapshot, hints, sessionId]);

  return state;
}
