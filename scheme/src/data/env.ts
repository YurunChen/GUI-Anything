import * as os from 'node:os';
import * as path from 'node:path';
import type { FlowEnv } from './protocol/observer-protocol';

export interface FlowEnvRepository {
  read(): FlowEnv;
}

/**
 * Flow logging (scheme/src/utils/logger.ts):
 * - FLOW_LOG_LEVEL: debug | info | warn | error (default info)
 * - FLOW_LOG_MODULES: comma allowlist, e.g. binding,session,summary,runtime
 * - FLOW_LOG_FILE: log path (default FLOW_ROOT_DIR/logs/observer.log)
 * - FLOW_LOG_DISABLED: 1 = stderr only
 */

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
 * Ephemeral Zellij layout directory (not persisted in repo).
 * Priority: FLOW_LAYOUT_DIR > TMPDIR/gui-anything-flow/layouts
 */
export function resolveZellijLayoutDir(): string {
  if (process.env.FLOW_LAYOUT_DIR) {
    return process.env.FLOW_LAYOUT_DIR;
  }
  const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || os.tmpdir();
  return path.join(base, 'gui-anything-flow', 'layouts');
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
