/**
 * Map between SessionBundle exploration records and observer protocol types.
 */

import type {
  Exploration,
  ExplorationId,
  SessionId,
  SessionScopedId,
  SummaryItem,
  WikiMatch,
} from '../protocol/observer-protocol';
import { makeSessionScopedId } from '../protocol/observer-protocol';
import type { KnowledgeEntry } from './knowledge-repository';
import { formatKnowledgeExcerpt } from '../../utils/wiki-text';
import type {
  ExplorationCardRecord,
  ExplorationCardSummary,
  SessionBundle,
  WikiRetrievalSnapshot,
} from './session-bundle-types';
import { SESSION_BUNDLE_SCHEMA_VERSION } from './session-bundle-types';
import { resolveWorkspaceRootForCache } from '../session/workspace-root';
import {
  cardSummarySourceFromSummaryItem,
  summaryItemFromSessionBundle,
} from '../protocol/summary-provenance';

export function createEmptyBundle(input: {
  sessionId: SessionId;
  jsonlPath: string;
  jsonlMtime: number;
  workspaceRoot?: string;
}): SessionBundle {
  const workspaceRoot = input.workspaceRoot ?? resolveWorkspaceRootForCache();
  const now = Date.now();
  return {
    schemaVersion: SESSION_BUNDLE_SCHEMA_VERSION,
    meta: {
      sessionId: input.sessionId,
      workspaceRoot,
      jsonlPath: input.jsonlPath,
      jsonlMtime: input.jsonlMtime,
      updatedAt: now,
    },
    session: {
      intent: null,
      flow: {
        revision: 0,
        fingerprint: '',
        flowGraph: { nodes: [], edges: [], updatedAt: now },
        flowchartHints: {},
        graphPatchLedger: [],
      },
    },
    curation: {
      openIntentKey: '',
      buckets: {},
      evidence: {},
    },
    explorations: {},
  };
}

export function summaryItemToCardSummary(item: SummaryItem): ExplorationCardSummary {
  return {
    text: item.text,
    source: cardSummarySourceFromSummaryItem(item),
    status: item.status === 'failed' ? 'failed' : 'ready',
    reason: item.reason,
    flowchart: item.flowchart,
    persistMeta: item.persistMeta,
    savedAt: Date.now(),
  };
}

export function cardSummaryToSummaryItem(
  sessionId: SessionId,
  explorationId: ExplorationId,
  summary: ExplorationCardSummary,
): SummaryItem {
  return summaryItemFromSessionBundle(sessionId, explorationId, summary);
}

export function bundleToSummaryItems(
  sessionId: SessionId,
  bundle: SessionBundle,
): Record<SessionScopedId, SummaryItem> {
  const items: Record<SessionScopedId, SummaryItem> = {};
  for (const [explorationId, record] of Object.entries(bundle.explorations)) {
    if (!record.summary) continue;
    const id = makeSessionScopedId(sessionId, explorationId);
    items[id] = cardSummaryToSummaryItem(sessionId, explorationId, record.summary);
  }
  return items;
}

export function retrievalSnapshotToWikiMatch(snapshot: WikiRetrievalSnapshot): WikiMatch {
  const entry: KnowledgeEntry = {
    id: snapshot.entryId,
    slug: snapshot.slug,
    sessionId: '',
    explorationId: '',
    type: snapshot.type === 'summary' ? 'summary' : snapshot.type,
    request: snapshot.request,
    content: snapshot.excerpt,
    confidence: snapshot.score,
    tags: snapshot.tags,
    createdAt: snapshot.capturedAt,
    relativePath: snapshot.relativePath,
  };
  return {
    entry,
    score: snapshot.score,
    matchedKeywords: snapshot.matchedKeywords,
  };
}

export function wikiMatchToRetrievalSnapshot(
  match: WikiMatch,
  messages?: { emptyExcerpt?: string },
): WikiRetrievalSnapshot {
  const excerpt = formatKnowledgeExcerpt(match.entry.content, 240, messages as never);
  return {
    origin: 'retrieved',
    entryId: match.entry.id,
    relativePath: match.entry.relativePath || '',
    type: match.entry.type,
    slug: match.entry.slug,
    request: match.entry.request,
    excerpt,
    tags: match.entry.tags || [],
    score: match.score,
    matchedKeywords: match.matchedKeywords,
    capturedAt: Date.now(),
  };
}

export function buildCardMetaFromExploration(exploration: Exploration): ExplorationCardRecord['meta'] {
  if (exploration.status !== 'complete' && exploration.status !== 'interrupted') {
    return undefined;
  }
  const toolNodes = exploration.nodes.filter((n) => n.type === 'tool');
  const errorNodes = exploration.nodes.filter(
    (n) => n.status === 'error' || n.type === 'error',
  );
  const toolCounts = new Map<string, number>();
  for (const node of toolNodes) {
    const toolName = node.label.split(' ')[0] || 'unknown';
    toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1);
  }
  const toolSummary = [...toolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => `${name}×${count}`)
    .join(' · ');
  const durationMs =
    typeof exploration.endedAt === 'number' && exploration.endedAt > exploration.startedAt
      ? exploration.endedAt - exploration.startedAt
      : undefined;
  return {
    status: exploration.status,
    toolCount: toolNodes.length,
    errorCount: errorNodes.length,
    toolSummary: toolSummary || undefined,
    tokens: exploration.tokens && exploration.tokens > 0 ? exploration.tokens : undefined,
    files: exploration.files && exploration.files.length > 0 ? [...exploration.files] : undefined,
    durationMs,
  };
}

export function ensureExplorationRecord(
  bundle: SessionBundle,
  explorationId: ExplorationId,
  question: string,
): ExplorationCardRecord {
  const existing = bundle.explorations[explorationId];
  if (existing) {
    if (question.trim() && !existing.question.trim()) {
      existing.question = question;
    }
    return existing;
  }
  const record: ExplorationCardRecord = {
    explorationId,
    question,
    summary: null,
    write: null,
  };
  bundle.explorations[explorationId] = record;
  return record;
}

/** True when bundle has saved wiki/session content worth showing in replay. */
export function bundleHasDisplayData(bundle: SessionBundle | null | undefined): boolean {
  if (!bundle) return false;

  for (const card of Object.values(bundle.explorations)) {
    if (card.summary?.text?.trim()) return true;
    if (card.retrieval?.excerpt?.trim()) return true;
    if (card.write?.targetId || card.write?.targetPath) return true;
  }

  const nodes = bundle.session.flow?.flowGraph?.nodes;
  if (Array.isArray(nodes) && nodes.length > 0) return true;

  if (Object.keys(bundle.curation.evidence ?? {}).length > 0) return true;
  if (Object.keys(bundle.curation.buckets ?? {}).length > 0) return true;

  return false;
}

/** Per-exploration flags: bundle already has persisted AI/cache summary text. */
export function bundleSummaryFlags(bundle: SessionBundle | null | undefined): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!bundle) return out;
  for (const [explorationId, card] of Object.entries(bundle.explorations)) {
    out[explorationId] = Boolean(card.summary?.text?.trim());
  }
  return out;
}

/** @deprecated use retrievalSnapshotToWikiMatch */
export const knowledgeSnapshotToWikiMatch = retrievalSnapshotToWikiMatch;

/** @deprecated use wikiMatchToRetrievalSnapshot */
export const wikiMatchToKnowledgeSnapshot = wikiMatchToRetrievalSnapshot;
