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
  FlowGraphNodeStatus,
  FlowGraphSnapshot,
  SessionScopedId,
  PersistResultStatus,
  TitleDelta,
  WikiMatch,
} from '../../data/protocol/observer-protocol';
import { makeSessionScopedId } from '../../data/protocol/observer-protocol';
import { ruleBasedPersona } from './persona-score';

export interface LivePersonaInput {
  graphSnapshot: FlowGraphSnapshot;
  explorations: Exploration[];
  flowchartHints?: Record<string, FlowchartHint>;
  explorationPersistStatus?: Record<string, PersistResultStatus | 'pending'>;
  wikiMatchesByExploration?: Record<string, WikiMatch | null>;
}

export const LIVE_PERSONA_MIN_COMPLETED_EXPLORATIONS = 3;
export const LIVE_PERSONA_REFRESH_COMPLETED_EXPLORATIONS = 3;

export function resolveLiveCodingPersona(input: LivePersonaInput): CodingPersona | null {
  if (input.graphSnapshot.nodes.length === 0) return null;
  const evidenceInput = buildLivePersonaEvidenceInput(input);
  if (!evidenceInput) return null;
  return ruleBasedPersona(buildLivePersonaNodes(evidenceInput, 'explorations'), 1);
}

type LivePersonaMetricSource = 'graph' | 'explorations';

export function buildLivePersonaNodes(
  input: LivePersonaInput,
  metricSource: LivePersonaMetricSource = 'graph',
): EvolutionNode[] {
  const orderedExplorations = sortExplorationsByTimeline(input.explorations);
  return input.graphSnapshot.nodes.map((node) => (
    toEvolutionNode(node, relatedExplorations(node, orderedExplorations, input), input, metricSource)
  ));
}

export function stableLivePersonaExplorations(explorations: Exploration[]): Exploration[] {
  const completed = sortExplorationsByTimeline(explorations)
    .filter((exploration) => exploration.status === 'complete');
  if (completed.length < LIVE_PERSONA_MIN_COMPLETED_EXPLORATIONS) return [];
  const stableCount = Math.floor(completed.length / LIVE_PERSONA_REFRESH_COMPLETED_EXPLORATIONS)
    * LIVE_PERSONA_REFRESH_COMPLETED_EXPLORATIONS;
  return completed.slice(0, stableCount);
}

function buildLivePersonaEvidenceInput(input: LivePersonaInput): LivePersonaInput | null {
  const explorations = stableLivePersonaExplorations(input.explorations);
  if (explorations.length === 0) return null;

  const nodes = input.graphSnapshot.nodes
    .map((node) => {
      const related = relatedExplorations(node, explorations, input);
      return related.length > 0 ? toStableEvidenceNode(node, related, input) : null;
    })
    .filter((node): node is FlowGraphNode => Boolean(node));
  if (nodes.length === 0) return null;

  return {
    ...input,
    explorations,
    graphSnapshot: {
      ...input.graphSnapshot,
      nodes,
    },
  };
}

function toStableEvidenceNode(
  node: FlowGraphNode,
  related: Exploration[],
  input: LivePersonaInput,
): FlowGraphNode {
  const representative = related.find((item) => item.id === node.explorationId) ?? related.at(-1)!;
  const sessionId = node.id.split(':')[0] || 'current';
  const representativeHint = input.flowchartHints?.[representative.id];
  const nodeSlug = slugFlowchartNodeId(representativeHint?.nodeId ?? node.intentKey, representative.id);

  return {
    ...node,
    id: makeSessionScopedId(sessionId, `${nodeSlug}_${representative.id}`) as SessionScopedId,
    explorationId: representative.id,
    label: representativeHint?.nodeTitle?.trim() || node.label,
    status: stableNodeStatus(related),
    startedAt: Math.min(...related.map((item) => item.startedAt)),
    endedAt: related.at(-1)?.endedAt,
    metaBadges: {
      tools: related.reduce((sum, item) => sum + item.nodes.filter((child) => child.type === 'tool').length, 0),
      errors: related.reduce((sum, item) => sum + item.errorCounts.tool + item.errorCounts.system + item.errorCounts.result, 0),
      wiki: stableWikiState(related, node, input),
    },
  };
}

function stableNodeStatus(related: Exploration[]): FlowGraphNodeStatus {
  const hasErrors = related.some((item) =>
    item.errorCounts.tool + item.errorCounts.system + item.errorCounts.result > 0);
  if (hasErrors) return 'error';
  if (related.some((item) => item.status === 'interrupted')) return 'interrupted';
  return 'complete';
}

function stableWikiState(
  related: Exploration[],
  node: FlowGraphNode,
  input: LivePersonaInput,
): FlowGraphNode['metaBadges']['wiki'] {
  for (let i = related.length - 1; i >= 0; i -= 1) {
    const status = input.explorationPersistStatus?.[related[i].id];
    if (status) return status;
  }
  return related.some((item) => item.id === node.explorationId) ? node.metaBadges.wiki : 'none';
}

function toEvolutionNode(
  node: FlowGraphNode,
  explorations: Exploration[],
  input: LivePersonaInput,
  metricSource: LivePersonaMetricSource,
): EvolutionNode {
  const related = explorations.length > 0 ? explorations : [];
  const representative = related.find((item) => item.id === node.explorationId) ?? related.at(-1);
  const toolCount = metricSource === 'explorations' && related.length > 0
    ? related.reduce((sum, item) => sum + item.nodes.filter((child) => child.type === 'tool').length, 0)
    : node.metaBadges.tools;
  const errorCount = metricSource === 'explorations' && related.length > 0
    ? related.reduce((sum, item) => sum + item.errorCounts.tool + item.errorCounts.system + item.errorCounts.result, 0)
    : node.metaBadges.errors;
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
      toolCount,
      errorCount,
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
