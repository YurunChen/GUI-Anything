import type { CodingPersona, EvolutionNode } from '../../data/protocol/evolution-types';
import {
  catalogIntentKeyFromHint,
  slugFlowchartNodeId,
  sortExplorationsByTimeline,
} from '../../data/protocol/flowchart-intent';
import type {
  Exploration,
  FlowchartHint,
  FlowGraphNode,
  FlowGraphSnapshot,
  PersistResultStatus,
  TitleDelta,
  WikiMatch,
} from '../../data/protocol/observer-protocol';
import { ruleBasedPersona } from './persona-score';

export interface LivePersonaInput {
  graphSnapshot: FlowGraphSnapshot;
  explorations: Exploration[];
  flowchartHints?: Record<string, FlowchartHint>;
  explorationPersistStatus?: Record<string, PersistResultStatus | 'pending'>;
  wikiMatchesByExploration?: Record<string, WikiMatch | null>;
}

export function resolveLiveCodingPersona(input: LivePersonaInput): CodingPersona | null {
  if (input.graphSnapshot.nodes.length === 0) return null;
  return ruleBasedPersona(buildLivePersonaNodes(input), 1);
}

export function buildLivePersonaNodes(input: LivePersonaInput): EvolutionNode[] {
  const orderedExplorations = sortExplorationsByTimeline(input.explorations);
  return input.graphSnapshot.nodes.map((node) => (
    toEvolutionNode(node, relatedExplorations(node, orderedExplorations, input), input)
  ));
}

function toEvolutionNode(node: FlowGraphNode, explorations: Exploration[], input: LivePersonaInput): EvolutionNode {
  const related = explorations.length > 0 ? explorations : [];
  const representative = related.find((item) => item.id === node.explorationId) ?? related.at(-1);
  const writes = related.length > 0
    ? related.filter((item) => isPersisted(item.id, node, input)).length
    : nodeWriteFallback(node);
  const retrievals = related.filter((item) => Boolean(input.wikiMatchesByExploration?.[item.id])).length;
  const interrupted = Math.max(
    node.status === 'interrupted' || node.status === 'error' ? 1 : 0,
    related.filter((item) => item.status === 'interrupted').length,
  );
  const children = related
    .filter((item) => item.id !== node.explorationId)
    .map((item) => ({
      title: input.flowchartHints?.[item.id]?.nodeTitle || item.question,
      note: undefined,
      at: item.startedAt,
      delta: input.flowchartHints?.[item.id]?.titleDelta || 'continue',
    }));

  return {
    id: node.id,
    eraId: 'live',
    sessionId: node.id.split(':')[0] ?? 'current',
    title: node.label,
    note: node.summaryPreview,
    at: node.startedAt,
    delta: resolveNodeDelta(representative, related, input),
    children,
    metrics: {
      toolCount: node.metaBadges.tools,
      errorCount: node.metaBadges.errors,
      retrievals,
      writes,
      interrupted,
    },
  };
}

function relatedExplorations(
  node: FlowGraphNode,
  explorations: Exploration[],
  input: LivePersonaInput,
): Exploration[] {
  return explorations.filter((exploration) => isRelatedExploration(node, exploration, input.flowchartHints));
}

function isRelatedExploration(
  node: FlowGraphNode,
  exploration: Exploration,
  flowchartHints: Record<string, FlowchartHint> | undefined,
): boolean {
  if (exploration.id === node.explorationId) return true;
  const hint = flowchartHints?.[exploration.id];
  if (!hint) return false;
  const representativeHint = flowchartHints?.[node.explorationId];
  if (representativeHint) {
    const hintNodeId = slugFlowchartNodeId(hint.nodeId, exploration.id);
    const representativeNodeId = slugFlowchartNodeId(representativeHint.nodeId, node.explorationId);
    if (hintNodeId === representativeNodeId) return true;
  }
  return catalogIntentKeyFromHint(hint) === node.intentKey
    && normalizeTitle(hint.nodeTitle) === normalizeTitle(node.label);
}

function resolveNodeDelta(
  representative: Exploration | undefined,
  related: Exploration[],
  input: LivePersonaInput,
): TitleDelta {
  const representativeDelta = representative ? input.flowchartHints?.[representative.id]?.titleDelta : undefined;
  if (representativeDelta) return representativeDelta;
  if (related.some((item) => input.flowchartHints?.[item.id]?.titleDelta === 'pivot')) return 'pivot';
  if (related.some((item) => input.flowchartHints?.[item.id]?.titleDelta === 'blocked')) return 'blocked';
  if (related.some((item) => input.flowchartHints?.[item.id]?.titleDelta === 'done')) return 'done';
  return 'continue';
}

function isPersisted(explorationId: string, node: FlowGraphNode, input: LivePersonaInput): boolean {
  const status = input.explorationPersistStatus?.[explorationId];
  if (status === 'saved' || status === 'updated') return true;
  return explorationId === node.explorationId && nodeWriteFallback(node) > 0;
}

function nodeWriteFallback(node: FlowGraphNode): number {
  return node.metaBadges.wiki === 'saved' || node.metaBadges.wiki === 'updated' ? 1 : 0;
}

function normalizeTitle(value: string | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}
