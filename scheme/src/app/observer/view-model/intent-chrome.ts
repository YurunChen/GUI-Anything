import type {
  Exploration,
  SessionIntentState,
  SessionScopedId,
  SummaryItem,
} from '../../../data/protocol/observer-protocol';
import { catalogIntentKey, resolveLatestFlowchartChrome } from '../../../data/protocol/flowchart-intent';
import { indexSummaryItemsByExploration } from '../../../data/protocol/summary-contract';

export interface LiveIntentChromeView {
  title: string;
  intentKey: string;
}

export function buildLiveIntentChrome(input: {
  sessionIntent?: SessionIntentState | null;
  explorations: Exploration[];
  summaryItems?: Record<SessionScopedId, SummaryItem>;
}): LiveIntentChromeView | undefined {
  if (input.summaryItems) {
    const fromFlowchart = resolveLatestFlowchartChrome({
      explorations: input.explorations,
      itemsByExplorationId: indexSummaryItemsByExploration(input.summaryItems),
    });
    if (fromFlowchart) return fromFlowchart;
  }

  return buildFromSessionIntent(input.sessionIntent);
}

function buildFromSessionIntent(state: SessionIntentState | null | undefined): LiveIntentChromeView | undefined {
  const title = state?.nodeTitle?.trim();
  const intentKey = state?.intentKey?.trim();
  if (!title || !intentKey) return undefined;
  return {
    title,
    intentKey: catalogIntentKey(intentKey),
  };
}
