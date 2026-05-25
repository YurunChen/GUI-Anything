import * as path from 'node:path';
import type { FlowEnv } from './protocol/observer-protocol';

export interface FlowEnvRepository {
  read(): FlowEnv;
}

/**
 * Resolve the unified data directory for observer.
 * Priority: FLOW_DATA_DIR > FLOW_ROOT_DIR/.flow-runtime
 */
export function resolveFlowDataDir(): string {
  if (process.env.FLOW_DATA_DIR) {
    return process.env.FLOW_DATA_DIR;
  }
  const rootDir = process.env.FLOW_ROOT_DIR || process.cwd();
  return path.join(rootDir, '.flow-runtime');
}

// Note: SQLite removed — summary cache: data/wiki/summary-repository.ts

/**
 * Resolve Wiki root directory.
 * Priority: FLOW_WIKI_DIR > FLOW_ROOT_DIR/wiki > FLOW_PROJECT_DIR/wiki > ./wiki
 */
export function resolveWikiRoot(): string {
  if (process.env.FLOW_WIKI_DIR) {
    return process.env.FLOW_WIKI_DIR;
  }
  const rootDir = process.env.FLOW_ROOT_DIR || process.env.FLOW_PROJECT_DIR;
  if (rootDir) {
    return path.join(rootDir, 'wiki');
  }
  return path.join(process.cwd(), 'wiki');
}

/**
 * Resolve layouts directory.
 * Priority: FLOW_LAYOUT_DIR > FLOW_DATA_DIR/layouts
 */
export function resolveLayoutDir(): string {
  if (process.env.FLOW_LAYOUT_DIR) {
    return process.env.FLOW_LAYOUT_DIR;
  }
  return path.join(resolveFlowDataDir(), 'layouts');
}

/** Stable project tag for wiki entries, e.g. `proj:gui-anything`. */
export function resolveProjectTag(): string {
  const rootDir = process.env.FLOW_ROOT_DIR || process.env.FLOW_PROJECT_DIR || process.cwd();
  const slug = path.basename(rootDir)
    .toLowerCase()
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `proj:${slug || 'unknown'}`;
}

export class ProcessFlowEnvRepository implements FlowEnvRepository {
  read(): FlowEnv {
    return {
      flowProjectDir: process.env.FLOW_PROJECT_DIR,
      flowRootDir: process.env.FLOW_ROOT_DIR,
      flowSessionId: process.env.FLOW_SESSION_ID,
      claudeModel: process.env.CLAUDE_MODEL,
    };
  }
}
