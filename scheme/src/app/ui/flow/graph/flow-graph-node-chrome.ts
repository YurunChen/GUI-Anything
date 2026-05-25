import type { FlowGraphNode } from '../../../../data/protocol/observer-protocol';
import { resolveIntentChromeDisplay } from '../../../observer/view-model/intent-chrome-display';
import { flowSpacing } from '../flow-ui/flow-spacing';
import type { ObserverLocale } from '../../../constants/observer-locale';

export interface GraphNodeChromeParts {
  badge: string | null;
  title: string;
  isIdle: boolean;
}

export function resolveGraphNodeChromeParts(
  flowNode: FlowGraphNode,
  locale: ObserverLocale = 'en',
): GraphNodeChromeParts {
  return resolveIntentChromeDisplay({
    intentKey: flowNode.intentKey,
    title: flowNode.label,
    locale,
  });
}

/** Left indent fallback when connector prefix is empty (multi-root spacing). */
export function resolveRailRowIndent(depth: number): number {
  return Math.max(0, depth) * flowSpacing.graphRailIndent;
}

/** Vertical + arrow connector between stacked node cards. */
export function formatStackConnector(trunk: string, down: string): string {
  return `${trunk}\n${down}`;
}
