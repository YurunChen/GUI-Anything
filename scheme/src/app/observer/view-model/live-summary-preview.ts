import type { Exploration } from '../../../data/protocol/observer-protocol';
import { buildExplorationRoundRecord } from '../../../services/ai/exploration-round-record';
import {
  buildGreetingFlowchartHint,
  isTrivialGreetingExploration,
} from '../../../services/ai/flow-summaries';
import type { FlowchartHint } from '../../../data/protocol/observer-protocol';
import { getObserverMessages } from '../../ui/i18n/observer-messages';

function toSummaryNodes(nodes: Exploration['nodes']) {
  return nodes.map((node) => ({
    timestamp: node.timestamp,
    type: node.type,
    label: node.label,
    status: node.status,
  }));
}

export function buildLiveSummaryPreview(exploration: Exploration): string {
  const nodes = toSummaryNodes(exploration.nodes);
  if (isTrivialGreetingExploration(exploration.question, nodes)) {
    return getObserverMessages().trivialGreetingDistill;
  }
  return buildExplorationRoundRecord(exploration.question, nodes);
}

export function buildLiveSummaryPreviewFlowchart(exploration: Exploration): FlowchartHint | undefined {
  const nodes = toSummaryNodes(exploration.nodes);
  if (isTrivialGreetingExploration(exploration.question, nodes)) {
    return buildGreetingFlowchartHint();
  }
  return undefined;
}
