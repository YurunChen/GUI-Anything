/**
 * Evolution service — orchestrates raw intent history into the evolution view-model.
 *
 * Right-rail nodes: one milestone per `pivot` revision; subsequent refine/continue/
 * blocked/done revisions fold under it as children.
 * Left-rail eras: by default grouped from consecutive same-intentKey runs (rule fallback).
 * An optional async `eraSynthesizer` (AI) may replace the rule grouping; on failure the
 * rule fallback is used and `aiUsed` is reported false.
 */

import type {
  EvolutionEra,
  EvolutionExport,
  EvolutionNode,
  EvolutionRevision,
  EvolutionSubStep,
  ProjectEvolution,
  ProjectEvolutionRaw,
  SessionEvolution,
  SessionEvolutionRaw,
} from '../../data/protocol/evolution-types';
import { isEvolutionIcon } from '../../data/protocol/evolution-types';
import { pickIcon } from './icon-heuristic';

/** Replaces rule-based era grouping. Return null/throw → rule fallback. */
export type EraSynthesizer = (
  nodes: EvolutionNode[],
  context: { scope: 'project' | 'session'; sessionId?: string },
) => Promise<EvolutionEra[] | null>;

function noteFor(rev: EvolutionRevision, summaries: Record<string, string>): string {
  if (rev.note?.trim()) return rev.note.trim();
  const summary = summaries[rev.explorationId]?.trim();
  if (summary) return summary.split(/\n/)[0].slice(0, 160);
  return '';
}

/** Build milestone nodes from one session's chronological revisions. */
function buildSessionNodes(raw: SessionEvolutionRaw): EvolutionNode[] {
  const nodes: EvolutionNode[] = [];
  for (const rev of raw.revisions) {
    const isMilestone = rev.delta === 'pivot' || nodes.length === 0;
    if (isMilestone) {
      nodes.push({
        id: `${raw.sessionId}:${rev.explorationId}`,
        eraId: '',
        sessionId: raw.sessionId,
        title: rev.nodeTitle,
        note: noteFor(rev, raw.summaries),
        at: rev.at,
        delta: rev.delta,
        icon: pickIcon(rev.nodeTitle, rev.intentKey),
        children: [],
      });
    } else {
      const sub: EvolutionSubStep = {
        title: rev.nodeTitle,
        note: noteFor(rev, raw.summaries) || undefined,
        at: rev.at,
        delta: rev.delta,
      };
      nodes[nodes.length - 1].children.push(sub);
    }
  }
  return nodes;
}

/** Rule fallback: group consecutive nodes sharing the leading sub-step intent. */
function buildRuleEras(nodes: EvolutionNode[], revisionsByNode: Map<string, string>): EvolutionEra[] {
  const eras: (EvolutionEra & { _key?: string })[] = [];
  for (const node of nodes) {
    const key = revisionsByNode.get(node.id) ?? 'general';
    const last = eras[eras.length - 1];
    if (last && last._key === key) {
      last.nodeIds.push(node.id);
      if (last.sceneAdds.length < 4 && !last.sceneAdds.includes(node.title)) {
        last.sceneAdds.push(node.title);
      }
      node.eraId = last.id;
    } else {
      const era: EvolutionEra & { _key?: string } = {
        id: `era_${eras.length}`,
        order: eras.length,
        title: node.title,
        abstract: node.note || node.title,
        icon: node.icon,
        sceneAdds: [node.title],
        nodeIds: [node.id],
        _key: key,
      };
      eras.push(era);
      node.eraId = era.id;
    }
  }
  // strip internal _key
  return eras.map(({ _key, ...era }: EvolutionEra & { _key?: string }) => era);
}

function intentKeyByNode(raw: SessionEvolutionRaw[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const session of raw) {
    for (const rev of session.revisions) {
      map.set(`${session.sessionId}:${rev.explorationId}`, rev.intentKey);
    }
  }
  return map;
}

async function synthEras(
  nodes: EvolutionNode[],
  ruleKeys: Map<string, string>,
  synthesizer: EraSynthesizer | undefined,
  context: { scope: 'project' | 'session'; sessionId?: string },
): Promise<{ eras: EvolutionEra[]; aiUsed: boolean }> {
  if (nodes.length === 0) return { eras: [], aiUsed: false };
  if (synthesizer) {
    try {
      const eras = await synthesizer(nodes, context);
      if (eras && eras.length > 0) {
        const valid = reconcileEras(eras, nodes);
        if (valid) return { eras: valid, aiUsed: true };
      }
    } catch {
      // fall through to rule fallback
    }
  }
  return { eras: buildRuleEras(nodes, ruleKeys), aiUsed: false };
}

/** Ensure AI eras reference real node ids and every node is assigned an era. */
function reconcileEras(eras: EvolutionEra[], nodes: EvolutionNode[]): EvolutionEra[] | null {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const assigned = new Map<string, string>();
  const normalized: EvolutionEra[] = [];
  eras.forEach((era, i) => {
    const ids = (era.nodeIds ?? []).filter((id) => nodeIds.has(id));
    if (ids.length === 0) return;
    const id = era.id || `era_${i}`;
    // Carry the AI-supplied icon if valid; else inherit the lead node's heuristic icon.
    const icon = isEvolutionIcon(era.icon) ? era.icon : nodeById.get(ids[0])?.icon;
    normalized.push({
      id,
      order: i,
      title: era.title || ids[0],
      abstract: era.abstract || '',
      icon,
      sceneAdds: (era.sceneAdds ?? []).slice(0, 4),
      nodeIds: ids,
    });
    for (const nid of ids) assigned.set(nid, id);
  });
  if (normalized.length === 0) return null;
  // Any unassigned node folds into the last era to keep scroll-spy total intact.
  for (const node of nodes) {
    if (!assigned.has(node.id)) {
      const last = normalized[normalized.length - 1];
      last.nodeIds.push(node.id);
      assigned.set(node.id, last.id);
    }
  }
  for (const node of nodes) node.eraId = assigned.get(node.id)!;
  return normalized;
}

export interface BuildEvolutionInput {
  raw: ProjectEvolutionRaw;
  theme?: string;
  eraSynthesizer?: EraSynthesizer;
}

export async function buildEvolutionExport(input: BuildEvolutionInput): Promise<EvolutionExport> {
  const { raw, theme, eraSynthesizer } = input;
  const ruleKeys = intentKeyByNode(raw.sessions);

  // Project nodes: per-session nodes concatenated (sessions already sorted asc).
  const projectNodes: EvolutionNode[] = raw.sessions.flatMap(buildSessionNodes);
  const projectResult = await synthEras(projectNodes, ruleKeys, eraSynthesizer, { scope: 'project' });

  const project: ProjectEvolution = {
    workspaceRoot: raw.workspaceRoot,
    eras: projectResult.eras,
    nodes: projectNodes,
  };

  // Session drill-downs (rule-based eras only; left-rail abstraction per session).
  const sessions: SessionEvolution[] = [];
  for (const sessionRaw of raw.sessions) {
    const nodes = buildSessionNodes(sessionRaw);
    const eras = buildRuleEras(nodes, ruleKeys);
    sessions.push({
      sessionId: sessionRaw.sessionId,
      title: sessionRaw.title,
      startedAt: sessionRaw.startedAt,
      eras,
      nodes,
    });
  }

  return {
    version: '1.0',
    generatedAt: Date.now(),
    aiUsed: projectResult.aiUsed,
    project,
    sessions,
    theme,
  };
}
