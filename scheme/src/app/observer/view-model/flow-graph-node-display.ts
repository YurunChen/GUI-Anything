import type { FlowGraphNode } from '../../../data/protocol/observer-protocol';
import type { ObserverLocale } from '../../../constants/observer-locale';
import { resolveIntentChromeDisplay } from './intent-chrome-display';

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
