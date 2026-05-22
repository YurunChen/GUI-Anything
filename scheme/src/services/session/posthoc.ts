/**
 * @deprecated Import from `data/session/*` — kept for backward-compatible service-layer imports.
 */
export {
  encodePath,
  resolveGitRoot,
  projectDir,
  listAllProjectDirs,
  findLatestSession,
} from '../../data/session/claude-project';

export type {
  Exploration,
  ExplorationNode,
  SessionStats,
} from '../../data/session/session-types';

export {
  extractLastPrompt,
  isSessionOngoing,
  extractSessionStats,
  extractExplorationsFromSession,
  parseJsonlFile,
  buildTreeFromEvents,
} from '../../data/session/jsonl-session';
