import type { WorkspaceTreeSnapshot } from '../../data/protocol/workspace-tree';
import {
  defaultWorkspaceTreeRepository,
  type WorkspaceTreeRepository,
  type WorkspaceTreeScanOptions,
} from '../../data/workspace/workspace-tree-repository';

export class WorkspaceTreeService {
  constructor(
    private readonly repository: WorkspaceTreeRepository = defaultWorkspaceTreeRepository,
  ) {}

  snapshot(rootPath: string, options?: WorkspaceTreeScanOptions): WorkspaceTreeSnapshot {
    return this.repository.scan(rootPath, options);
  }
}

let singleton: WorkspaceTreeService | null = null;

export function getWorkspaceTreeService(): WorkspaceTreeService {
  if (!singleton) singleton = new WorkspaceTreeService();
  return singleton;
}

