/**
 * Evolution HTML export — option shapes.
 * Domain/view-model types live in data/protocol/evolution-types.ts.
 */

export type { EvolutionExport } from '../../data/protocol/evolution-types';
import type { ObserverLocale } from '../../constants/observer-locale';

export interface ExportEvolutionOptions {
  outputPath?: string;
  /** Drill straight into a single session instead of the project overview. */
  sessionId?: string;
  scope?: 'project' | 'session';
  /** Skip AI era synthesis; use deterministic rule grouping. */
  noAi?: boolean;
  theme?: string;
  workspaceRoot?: string;
  /** Explicit wiki root (server resolves once and passes down); else resolved from env/cwd. */
  wikiRoot?: string;
  /** Display locale; defaults to FLOW_LOCALE/LANG via the shared resolver. */
  locale?: ObserverLocale;
}
