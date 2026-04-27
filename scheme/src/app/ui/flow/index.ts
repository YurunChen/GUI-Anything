/**
 * Flow Observer Component Library
 * 
 * Public exports for the Flow UI component system
 */

// Components
export { FlowObserverShell } from './FlowObserverShell';
export { ContextPanel } from './ContextPanel';
export { CommandBar } from './CommandBar';

// State Machine
export type {
  SessionState,
  ExplorationState,
  ContextTab,
  DirectionsState,
  WikiSearchState,
} from './flow-observer-state';
export {
  deriveSessionState,
  deriveExplorationState,
  getExplorationStatusText,
  getExplorationStatusColor,
} from './flow-observer-state';

// Inject Backend
export type { InjectBackend } from '../../../services/flow/inject';

// Constants
export {
  OBSERVER_POLL_MS,
  WIKI_SEARCH_THRESHOLD,
  COMPACT_LAYOUT_WIDTH,
  INPUT_BOX_HEIGHT_DEFAULT,
  INPUT_BOX_HEIGHT_COMPACT,
  INSPIRATION_SIDEBAR_WIDTH,
  INSPIRATION_MAX_RECENT,
  FILE_ACCESS_MAX_SHOW,
  FILE_ACCESS_WARN_THRESHOLD,
} from '../../../constants/flow-constants';

// Utils
export {
  extractCommandsFromNodes,
  extractPathsFromNodes,
  formatCompactTokens,
  getContextWindowTokens,
  shellSingleQuote,
} from './flow-utils';
