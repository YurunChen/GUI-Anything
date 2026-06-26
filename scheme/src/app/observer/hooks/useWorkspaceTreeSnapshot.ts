import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkspaceTreeSnapshot } from '../../../data/protocol/workspace-tree';
import { getWorkspaceTreeService } from '../../../services/workspace/workspace-tree-service';
import { createLogger } from '../../../utils/logger';
import { reportError } from '../../../utils/observability';

const log = createLogger('observer');
const WORKSPACE_TREE_POLL_INTERVAL_MS = 2000;

export function useWorkspaceTreeSnapshot(rootPath: string): WorkspaceTreeSnapshot | null {
  const [snapshot, setSnapshot] = useState<WorkspaceTreeSnapshot | null>(null);
  const scanningRef = useRef(false);

  const scan = useCallback(() => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    try {
      const next = getWorkspaceTreeService().snapshot(rootPath);
      setSnapshot((prev) => (
        prev && workspaceSnapshotsEquivalent(prev, next)
          ? prev
          : next
      ));
    } catch (error) {
      reportError('io', 'workspace tree scan failed', {
        rootPath,
        error: error instanceof Error ? error.message : String(error),
      });
      log.debug('workspace tree scan failed', {
        rootPath,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      scanningRef.current = false;
    }
  }, [rootPath]);

  useEffect(() => {
    scan();
    const timer = setInterval(scan, WORKSPACE_TREE_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [scan]);

  return snapshot;
}

export function workspaceSnapshotsEquivalent(
  prev: WorkspaceTreeSnapshot,
  next: WorkspaceTreeSnapshot,
): boolean {
  if (prev.rootPath !== next.rootPath || prev.truncated !== next.truncated) return false;
  if (prev.nodes.length !== next.nodes.length) return false;
  for (let index = 0; index < prev.nodes.length; index += 1) {
    const a = prev.nodes[index];
    const b = next.nodes[index];
    if (a.path !== b.path || a.isDir !== b.isDir || a.depth !== b.depth) return false;
  }
  return true;
}
