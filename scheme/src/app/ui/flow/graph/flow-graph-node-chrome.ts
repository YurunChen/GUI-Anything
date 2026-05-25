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

/** Left indent for rail tree depth (spaces, no box-drawing). */
export function resolveRailRowIndent(depth: number): number {
  return Math.max(0, depth) * flowSpacing.graphRailIndent;
}
