/**
 * Session arc — one-line narrative across completed explorations (Clarity + Continuity).
 */

import type { Exploration } from '../../../data/protocol/observer-protocol';
import type { SummaryItem } from '../../../data/protocol/observer-protocol';
import { truncateFlowText } from '../../../utils/flow-text';

const MAX_STEPS = 5;
const LABEL_MAX = 16;

export function buildSessionArc(
  explorations: Exploration[],
  itemsByExplorationId: Record<string, SummaryItem | undefined>,
): string | undefined {
  const labels: string[] = [];

  for (const exploration of explorations) {
    if (exploration.status !== 'complete') continue;
    const item = itemsByExplorationId[exploration.id];
    const label = stepLabel(exploration, item);
    if (label) labels.push(label);
  }

  if (labels.length < 2) return undefined;
  return labels.slice(-MAX_STEPS).join(' → ');
}

function stepLabel(exploration: Exploration, item?: SummaryItem): string {
  const fromChart = item?.flowchart?.nodeTitle?.trim();
  if (fromChart) return truncateFlowText(fromChart, LABEL_MAX);

  const fromSummary = item?.text?.trim();
  if (fromSummary) {
    const first = fromSummary.split(/[。！？.!?\n]/)[0]?.trim();
    if (first) return truncateFlowText(first, LABEL_MAX);
  }

  const q = exploration.question.trim();
  if (q) return truncateFlowText(q, LABEL_MAX);
  return '';
}
