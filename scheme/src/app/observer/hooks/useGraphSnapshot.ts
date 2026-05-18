import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Exploration,
  FlowGraphSnapshot,
  FlowchartHint,
  SessionId,
} from '../../../data/protocol/observer-protocol';
import { buildFlowGraphSnapshot } from '../../ui/flow/graph/graph-builder';
import {
  DefaultGraphCacheService,
  type GraphCacheLoadStatus,
  type GraphCacheService,
  buildGraphInputFingerprint,
} from '../../../services/session/graph-cache-service';

export interface UseGraphSnapshotInput {
  sessionId: SessionId;
  sessionPath: string;
  sourceMtimeMs: number;
  explorations: Exploration[];
  summaries: Record<string, string>;
  flowchartHints?: Record<string, FlowchartHint>;
  wikiPersistStatus?: Record<string, 'saved' | 'skipped' | 'failed' | 'pending'>;
}

export interface GraphSnapshotState {
  snapshot: FlowGraphSnapshot;
  cacheStatus: GraphCacheLoadStatus | 'idle';
  cacheReason: string;
  cacheHit: boolean;
}

export interface GraphResolveResult {
  snapshot: FlowGraphSnapshot;
  cacheStatus: GraphCacheLoadStatus | 'idle';
  cacheReason: string;
  cacheHit: boolean;
  shouldPersist: boolean;
}

export function resolveGraphSnapshot(
  input: UseGraphSnapshotInput,
  service: GraphCacheService,
  fingerprint: string,
): GraphResolveResult {
  const buildInput = {
    sessionId: input.sessionId || 'current',
    explorations: input.explorations,
    summaries: input.summaries,
    flowchartHints: input.flowchartHints,
    wikiPersistStatus: input.wikiPersistStatus,
  };

  if (!input.sessionId || !input.sessionPath || input.sourceMtimeMs <= 0) {
    return {
      snapshot: buildFlowGraphSnapshot(buildInput),
      cacheStatus: 'idle',
      cacheReason: 'missing_session_context',
      cacheHit: false,
      shouldPersist: false,
    };
  }

  const cache = service.loadGraphSnapshotWithStatus({
    sessionId: input.sessionId,
    jsonlMtime: input.sourceMtimeMs,
    fingerprint,
  });
  if (cache.snapshot) {
    return {
      snapshot: cache.snapshot,
      cacheStatus: cache.status,
      cacheReason: cache.reason,
      cacheHit: cache.status === 'hit',
      shouldPersist: false,
    };
  }

  return {
    snapshot: buildFlowGraphSnapshot(buildInput),
    cacheStatus: cache.status,
    cacheReason: cache.reason,
    cacheHit: false,
    shouldPersist: true,
  };
}

export function useGraphSnapshot(input: UseGraphSnapshotInput): GraphSnapshotState {
  const serviceRef = useRef<GraphCacheService | null>(null);
  if (!serviceRef.current) {
    serviceRef.current = new DefaultGraphCacheService();
  }

  const fingerprint = useMemo(
    () => buildGraphInputFingerprint({
      explorations: input.explorations,
      summaries: input.summaries,
      flowchartHints: input.flowchartHints,
      wikiPersistStatus: input.wikiPersistStatus,
    }),
    [input.explorations, input.summaries, input.flowchartHints, input.wikiPersistStatus],
  );

  const {
    sessionId,
    sessionPath,
    sourceMtimeMs,
    explorations,
    summaries,
    flowchartHints,
    wikiPersistStatus,
  } = input;

  const initial = useMemo(
    () => resolveGraphSnapshot({
      sessionId,
      sessionPath,
      sourceMtimeMs,
      explorations,
      summaries,
      flowchartHints,
      wikiPersistStatus,
    }, serviceRef.current!, fingerprint),
    [fingerprint, sessionId, sessionPath, sourceMtimeMs, explorations, summaries, flowchartHints, wikiPersistStatus],
  );

  const [state, setState] = useState<GraphSnapshotState>({
    snapshot: initial.snapshot,
    cacheStatus: initial.cacheStatus,
    cacheReason: initial.cacheReason,
    cacheHit: initial.cacheHit,
  });

  useEffect(() => {
    const service = serviceRef.current!;
    const resolved = resolveGraphSnapshot({
      sessionId,
      sessionPath,
      sourceMtimeMs,
      explorations,
      summaries,
      flowchartHints,
      wikiPersistStatus,
    }, service, fingerprint);
    setState({
      snapshot: resolved.snapshot,
      cacheStatus: resolved.cacheStatus,
      cacheReason: resolved.cacheReason,
      cacheHit: resolved.cacheHit,
    });
    if (!resolved.shouldPersist || !sessionId || sourceMtimeMs <= 0) {
      return;
    }
    const timer = setTimeout(() => {
      service.saveGraphSnapshot({
        sessionId,
        jsonlMtime: sourceMtimeMs,
        fingerprint,
        snapshot: resolved.snapshot,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [
    fingerprint,
    sessionId,
    sessionPath,
    sourceMtimeMs,
    explorations,
    summaries,
    flowchartHints,
    wikiPersistStatus,
  ]);

  return state;
}
