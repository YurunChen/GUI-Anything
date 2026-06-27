import type {
  Exploration,
  IntentBucket,
  SessionScopedId,
  SummaryItem,
} from '../../data/protocol/observer-protocol';
import { makeSessionScopedId } from '../../data/protocol/observer-protocol';
import type { ExplorationSummary } from '../../data/protocol/wiki-types';
import type { WikiMatch } from '../../data/protocol/wiki-types';
import { EvidenceRepository } from '../../data/wiki/evidence-repository';
import { findPriorKnowledgeForExploration } from './wiki-retrieval-policy';
import { DefaultWikiMatchService } from './match-service';
import { KnowledgeRepository } from '../../data/wiki/knowledge-repository';

export interface IntentDigestExploration {
  explorationId: string;
  request: string;
  summary: string;
  solutionDetail?: string;
  keyCommand?: string;
  tags?: string[];
  shouldPersist?: boolean;
  commands: string[];
}

export interface IntentDigest {
  intentKey: string;
  nodeTitle: string;
  sessionId: string;
  explorations: IntentDigestExploration[];
  evidenceExcerpt: string;
  representativeQuestion: string;
  combinedSummary: string;
}

export interface BuildIntentDigestInput {
  sessionId: string;
  bucket: IntentBucket;
  summaries: Record<SessionScopedId, SummaryItem>;
  explorations: Exploration[];
}

function toExplorationSummary(
  sessionId: string,
  exploration: Exploration,
  item: SummaryItem,
): ExplorationSummary {
  const toolNodes = exploration.nodes?.filter((node) => node.type === 'tool') ?? [];
  return {
    id: exploration.id,
    request: exploration.question,
    summary: item.text,
    commands: toolNodes.map((node) => node.rawCommand || node.label),
    files: [],
    nodes: exploration.nodes?.map((node) => ({
      timestamp: node.timestamp,
      type: node.type,
      label: node.rawText || node.label,
      status: node.status,
      phase: node.phase,
      rawCommand: node.rawCommand,
    })) ?? [],
    result: 'success',
    duration: 0,
    tokens: 0,
    sessionId,
    persistMeta: item.persistMeta,
  };
}

function isLowValue(summary: ExplorationSummary): boolean {
  const request = (summary.request || '').trim().toLowerCase();
  const summaryText = (summary.summary || '').trim().toLowerCase();
  const hasToolNodes = summary.nodes?.some((node) => node.type === 'tool') ?? false;
  const hasWork = summary.commands.length > 0
    || summary.files.length > 0
    || hasToolNodes;
  if (hasWork || request.length > 24) return false;
  return ['hello', 'hi', 'hey', '你好', '您好', '在吗', 'test', 'ping']
    .some((word) => request === word || summaryText.includes(word));
}

export function buildIntentDigest(input: BuildIntentDigestInput): IntentDigest | null {
  const { sessionId, bucket, summaries, explorations } = input;
  const byId = new Map(explorations.map((e) => [e.id, e]));
  const digestExplorations: IntentDigestExploration[] = [];

  for (const explorationId of bucket.explorationIds) {
    const exploration = byId.get(explorationId);
    if (!exploration) continue;
    const scopedId = makeSessionScopedId(sessionId, explorationId);
    const item = summaries[scopedId];
    if (!item?.text?.trim() || item.status !== 'ready' || item.source === 'excerpt') continue;

    const toolNodes = exploration.nodes?.filter((node) => node.type === 'tool') ?? [];
    digestExplorations.push({
      explorationId,
      request: exploration.question,
      summary: item.text,
      solutionDetail: item.persistMeta?.solution_detail,
      keyCommand: item.persistMeta?.key_command ?? undefined,
      tags: item.persistMeta?.tags,
      shouldPersist: item.persistMeta?.should_persist,
      commands: toolNodes.map((node) => node.rawCommand || node.label).filter(Boolean),
    });
  }

  if (digestExplorations.length === 0) return null;

  const evidenceRepo = new EvidenceRepository();
  const evidence = evidenceRepo.loadEvidence(sessionId);
  const evidenceLines: string[] = [];
  for (const exp of digestExplorations) {
    const entry = evidence?.entries?.[exp.explorationId];
    if (entry) {
      evidenceLines.push(`[${exp.explorationId}] ${JSON.stringify(entry).slice(0, 400)}`);
    }
  }

  const combinedSummary = digestExplorations
    .map((exp, index) => `### Turn ${index + 1} (${exp.explorationId})\n${exp.summary}`)
    .join('\n\n');

  return {
    intentKey: bucket.intentKey,
    nodeTitle: bucket.nodeTitle,
    sessionId,
    explorations: digestExplorations,
    evidenceExcerpt: evidenceLines.join('\n').slice(0, 3000),
    representativeQuestion: bucket.nodeTitle || digestExplorations[0].request,
    combinedSummary,
  };
}

export function shouldSkipIntentCurate(input: BuildIntentDigestInput): string | null {
  const digest = buildIntentDigest(input);
  if (!digest) return 'empty_digest';

  const { sessionId, summaries, explorations } = input;
  const byId = new Map(explorations.map((e) => [e.id, e]));
  let lowValueCount = 0;
  let hasSolutionDetail = false;
  let toolTurns = 0;

  for (const explorationId of input.bucket.explorationIds) {
    const exploration = byId.get(explorationId);
    if (!exploration) continue;
    const scopedId = makeSessionScopedId(sessionId, explorationId);
    const item = summaries[scopedId];
    if (!item?.text?.trim()) continue;
    const summary = toExplorationSummary(sessionId, exploration, item);
    if (isLowValue(summary)) {
      lowValueCount += 1;
    }
    if (item.persistMeta?.solution_detail?.trim()) {
      hasSolutionDetail = true;
    }
    if ((exploration.nodes?.filter((n) => n.type === 'tool').length ?? 0) > 0) {
      toolTurns += 1;
    }
  }

  if (lowValueCount === input.bucket.explorationIds.length) {
    return 'low_value';
  }
  if (!hasSolutionDetail && toolTurns < 1) {
    return 'no_increment';
  }
  return null;
}

export function findPriorHitForDigest(
  digest: IntentDigest,
  explorations: Exploration[],
  sessionId: string,
  matchService?: DefaultWikiMatchService,
): WikiMatch | null {
  const repo = new KnowledgeRepository();
  const service = matchService ?? new DefaultWikiMatchService(repo);
  const anchor = explorations.find((e) => e.id === digest.explorations[0]?.explorationId)
    ?? explorations[0];
  if (!anchor) return null;

  const proxy: Exploration = {
    ...anchor,
    question: digest.representativeQuestion || anchor.question,
  };
  return findPriorKnowledgeForExploration(proxy, sessionId, undefined, service);
}

export function digestToExplorationSummary(digest: IntentDigest): ExplorationSummary {
  const last = digest.explorations[digest.explorations.length - 1];
  const allTags = [...new Set(digest.explorations.flatMap((e) => e.tags ?? []))];
  const allCommands = [...new Set(digest.explorations.flatMap((e) => e.commands))];
  const solutionParts = digest.explorations
    .map((e) => e.solutionDetail?.trim())
    .filter(Boolean) as string[];

  return {
    id: last.explorationId,
    request: digest.representativeQuestion,
    summary: digest.combinedSummary,
    commands: allCommands,
    files: [],
    nodes: [],
    result: 'success',
    duration: 0,
    tokens: 0,
    sessionId: digest.sessionId,
    persistMeta: {
      solution_detail: solutionParts.join('\n\n') || digest.combinedSummary,
      tags: [...new Set([`intent:${digest.intentKey}`, ...allTags])],
      should_persist: digest.explorations.some((e) => e.shouldPersist !== false),
      key_command: digest.explorations.map((e) => e.keyCommand).find(Boolean),
      type: 'context',
      confidence: 0.75,
      reason: `intent_digest:${digest.intentKey}`,
    },
  };
}
