/**
 * WikiMaintenanceService — post-summary pipeline: prior match → Wiki Agent → repo → index → log.
 * UI prior KNOWLEDGE uses the same match path at question time (running+), independent of summary.
 */

import type {
  Exploration,
  PersistResult,
  SessionScopedId,
  SummaryItem,
} from '../../data/protocol/observer-protocol';
import { makeSessionScopedId } from '../../data/protocol/observer-protocol';
import type { ExplorationSummary } from '../../data/protocol/wiki-types';
import type { WikiMatch } from '../../data/protocol/wiki-types';
import {
  KnowledgeRepository,
  type KnowledgeEntry,
} from '../../data/wiki/knowledge-repository';
import {
  ensureKnowledgeScopeTags,
  filterProjectCompatibleKnowledge,
} from '../../data/wiki/knowledge-scope';
import { EvidenceRepository } from '../../data/wiki/evidence-repository';
import { rebuildKnowledgeIndex } from '../../data/wiki/knowledge-index-service';
import { appendKnowledgeLog } from '../../data/wiki/knowledge-log-service';
import { deduplicateKnowledge } from '../../data/management/data-governance';
import { findPriorKnowledgeForExploration } from './wiki-retrieval-policy';
import { regenerateProgressPage } from './progress-html-service';
import {
  extractWikiEntry,
} from './auto-extractor';
import { resolveWikiRoot } from '../../data/env';
import {
  renderKnowledgeMarkdown,
  resolveWikiDecision,
  resolveWikiDecisionAsync,
  ensureKnowledgeSourceMetadata,
} from './wiki-agent/run';
import type { WikiAgentDecision } from './wiki-agent/schema';
import type { WikiAgentManifest } from './wiki-agent/manifest';
import { DefaultWikiMatchService } from './match-service';
import { resolveAgentWriteProof } from './wiki-agent/validate-agent-write';

export interface MaintainExplorationInput {
  sessionId: string;
  exploration: Exploration;
  summaryItem: SummaryItem;
}

export interface WikiMaintenanceResult {
  result: PersistResult;
  /** Extraction sidecar for evidence (create path). */
  evidenceJson?: string;
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
  const hasToolNodes = (summary.nodes?.some((node) => node.type === 'tool') ?? false);
  const hasWork = summary.commands.length > 0
    || summary.files.length > 0
    || hasToolNodes;
  if (hasWork || request.length > 24) return false;
  return ['hello', 'hi', 'hey', '你好', '您好', '在吗', 'test', 'ping']
    .some((word) => request === word || summaryText.includes(word));
}

export class WikiMaintenanceService {
  private matchService: DefaultWikiMatchService;

  constructor(
    private knowledgeRepo = new KnowledgeRepository(),
    private evidenceRepo = new EvidenceRepository(),
    matchService?: DefaultWikiMatchService,
  ) {
    this.matchService = matchService ?? new DefaultWikiMatchService(this.knowledgeRepo);
  }

  findPriorHit(exploration: Exploration, sessionId: string): WikiMatch | null {
    return findPriorKnowledgeForExploration(
      exploration,
      sessionId,
      undefined,
      this.matchService,
    );
  }

  private async loadAgentCandidates(
    exploration: Exploration,
    sessionId: string,
    priorHit: WikiMatch | null,
  ): Promise<KnowledgeEntry[]> {
    const pool = filterProjectCompatibleKnowledge(this.knowledgeRepo.listMatchPoolSync());
    if (priorHit) {
      const rest = pool.filter((e) => e.id !== priorHit.entry.id).slice(0, 4);
      return [priorHit.entry, ...rest];
    }
    const query = exploration.question?.trim();
    if (query && query.length >= 5) {
      const hit = this.matchService.searchByQuerySync(query, 0.25, {
        excludeTurn: { sessionId, explorationId: exploration.id },
      });
      if (hit) {
        return [hit.entry, ...pool.filter((e) => e.id !== hit.entry.id).slice(0, 4)];
      }
    }
    return pool.slice(0, 5);
  }

  async maintainExploration(input: MaintainExplorationInput): Promise<WikiMaintenanceResult> {
    const { sessionId, exploration, summaryItem } = input;
    const id = makeSessionScopedId(sessionId, exploration.id);

    if (!summaryItem.text?.trim()) {
      return {
        result: { id, status: 'skipped', reason: 'missing_summary' },
      };
    }
    const summary = toExplorationSummary(sessionId, exploration, summaryItem);
    if (isLowValue(summary)) {
      appendKnowledgeLog({ op: 'skip', reason: 'low_value' });
      return {
        result: { id, status: 'skipped', reason: 'low_value' },
      };
    }

    const priorHit = this.findPriorHit(exploration, sessionId);
    const candidates = await this.loadAgentCandidates(exploration, sessionId, priorHit);
    const targetExcerpt = priorHit
      ? priorHit.entry.content.replace(/^---[\s\S]*?---\n?/, '').trim().slice(0, 1200)
      : undefined;

    const { decision, agentWroteDisk, manifest } = await resolveWikiDecisionAsync({
      summary,
      priorHit,
      candidates,
      targetExcerpt,
    });

    if (!decision || decision.action === 'skip') {
      appendKnowledgeLog({ op: 'skip', reason: decision?.reason ?? 'agent_skip' });
      return {
        result: { id, status: 'skipped', reason: decision?.reason ?? 'low_value' },
      };
    }

    if (agentWroteDisk && manifest) {
      return this.finalizeAgentWrite(
        id,
        sessionId,
        exploration.id,
        summary,
        decision,
        priorHit,
        manifest,
      );
    }

    if (decision.action === 'update' && decision.target_id) {
      return this.applyUpdate(id, sessionId, exploration.id, summary, decision, priorHit);
    }

    return this.applyCreate(id, sessionId, exploration.id, summary, decision);
  }

  /** Apply a pre-resolved agent decision (intent curator — no second agent call). */
  async applyAgentDecision(input: {
    sessionId: string;
    explorationId: string;
    summary: ExplorationSummary;
    decision: WikiAgentDecision;
    priorHit: WikiMatch | null;
    agentWroteDisk?: boolean;
    manifest?: WikiAgentManifest | null;
    skillOnly?: boolean;
  }): Promise<WikiMaintenanceResult> {
    const id = makeSessionScopedId(input.sessionId, input.explorationId);
    const { decision, summary, priorHit, agentWroteDisk, manifest, skillOnly } = input;

    if (decision.action === 'skip') {
      appendKnowledgeLog({ op: 'skip', reason: decision.reason ?? 'agent_skip' });
      return { result: { id, status: 'skipped', reason: decision.reason ?? 'agent_skip' } };
    }

    if (agentWroteDisk && manifest) {
      return this.finalizeAgentWrite(
        id,
        input.sessionId,
        input.explorationId,
        summary,
        decision,
        priorHit,
        manifest,
        skillOnly,
      );
    }

    if (skillOnly) {
      appendKnowledgeLog({ op: 'skip', reason: 'skill_failed' });
      return { result: { id, status: 'skipped', reason: 'skill_failed' } };
    }

    if (decision.action === 'update' && decision.target_id) {
      return this.applyUpdate(id, input.sessionId, input.explorationId, summary, decision, priorHit);
    }

    return this.applyCreate(id, input.sessionId, input.explorationId, summary, decision);
  }

  /** Agentic /llm-wiki wrote files — service post-process only. */
  private async finalizeAgentWrite(
    scopedId: SessionScopedId,
    sessionId: string,
    explorationId: string,
    summary: ExplorationSummary,
    decision: WikiAgentDecision,
    priorHit: WikiMatch | null,
    manifest: WikiAgentManifest,
    skillOnly = false,
  ): Promise<WikiMaintenanceResult> {
    const wikiRoot = resolveWikiRoot();
    const proof = await resolveAgentWriteProof(
      manifest,
      wikiRoot,
      this.knowledgeRepo,
      sessionId,
      explorationId,
      priorHit,
    );

    if (!proof.ok) {
      if (skillOnly) {
        appendKnowledgeLog({ op: 'skip', reason: 'skill_failed' });
        return { result: { id: scopedId, status: 'skipped', reason: 'skill_failed' } };
      }
      if (decision.action === 'update' && decision.target_id) {
        return this.applyUpdate(scopedId, sessionId, explorationId, summary, decision, priorHit);
      }
      return this.applyCreate(scopedId, sessionId, explorationId, summary, decision);
    }

    this.saveEvidence(sessionId, explorationId, summary);

    const targetId = proof.targetId
      ?? decision.target_id
      ?? priorHit?.entry.id;

    let entry = targetId ? await this.knowledgeRepo.findById(targetId) : null;
    if (!entry && decision.action === 'create') {
      entry = await this.knowledgeRepo.findBySource(sessionId, explorationId);
    }

    if (!entry) {
      if (skillOnly) {
        appendKnowledgeLog({ op: 'skip', reason: 'skill_failed' });
        return { result: { id: scopedId, status: 'skipped', reason: 'skill_failed' } };
      }
      if (decision.action === 'update' && decision.target_id) {
        return this.applyUpdate(scopedId, sessionId, explorationId, summary, decision, priorHit);
      }
      return this.applyCreate(scopedId, sessionId, explorationId, summary, decision);
    }

    const stampedContent = ensureKnowledgeSourceMetadata(entry.content, sessionId, explorationId);
    const scopedTags = ensureKnowledgeScopeTags(entry.tags);
    const tagsChanged = scopedTags.join('\n') !== (entry.tags || []).join('\n');
    if (stampedContent !== entry.content || tagsChanged) {
      const stamped = { ...entry, sessionId, explorationId, content: stampedContent, tags: scopedTags };
      await this.knowledgeRepo.save(stamped, { overwrite: true });
      entry = stamped;
    } else if (!entry.sessionId || !entry.explorationId) {
      const patched = { ...entry, sessionId, explorationId };
      await this.knowledgeRepo.save(patched, { overwrite: true });
      entry = patched;
    }

    await rebuildKnowledgeIndex(this.knowledgeRepo);
    await regenerateProgressPage(this.knowledgeRepo);

    const entryId = entry.id;
    const op = decision.action === 'update' ? 'update' : 'ingest';
    appendKnowledgeLog({
      op,
      id: entryId,
      reason: decision.reason || `agent_${decision.action}`,
    });

    const status = decision.action === 'update' ? 'updated' : 'saved';
    return {
      result: {
        id: scopedId,
        status,
        reason: `knowledge_${status}:${entryId}`,
      },
    };
  }

  private async applyUpdate(
    scopedId: SessionScopedId,
    sessionId: string,
    explorationId: string,
    summary: ExplorationSummary,
    decision: WikiAgentDecision,
    priorHit: WikiMatch | null,
  ): Promise<WikiMaintenanceResult> {
    const targetId = decision.target_id!;
    const existing = await this.knowledgeRepo.findById(targetId);
    if (!existing) {
      return this.applyCreate(scopedId, sessionId, explorationId, summary, {
        ...decision,
        action: 'create',
        target_id: undefined,
      });
    }

    const content = renderKnowledgeMarkdown({ decision, summary, existing });
    const updated: KnowledgeEntry = {
      ...existing,
      sessionId,
      explorationId,
      content,
      updatedAt: Date.now(),
      tags: ensureKnowledgeScopeTags(
        decision.tags.length > 0 ? decision.tags : existing.tags,
      ),
    };

    const saved = await this.knowledgeRepo.save(updated, { overwrite: true });
    if (!saved.success) {
      return {
        result: {
          id: scopedId,
          status: 'failed',
          reason: saved.reason,
        },
      };
    }

    this.saveEvidence(sessionId, explorationId, summary);
    await rebuildKnowledgeIndex(this.knowledgeRepo);
    await regenerateProgressPage(this.knowledgeRepo);
    appendKnowledgeLog({ op: 'update', id: targetId, reason: `knowledge_updated:${targetId}` });

    return {
      result: {
        id: scopedId,
        status: 'updated',
        reason: `knowledge_updated:${targetId}`,
        path: saved.path,
      },
    };
  }

  private async applyCreate(
    scopedId: SessionScopedId,
    sessionId: string,
    explorationId: string,
    summary: ExplorationSummary,
    decision: WikiAgentDecision,
  ): Promise<WikiMaintenanceResult> {
    const extracted = extractWikiEntry(summary);
    if (!extracted) {
      appendKnowledgeLog({ op: 'skip', reason: 'extract_failed' });
      return {
        result: { id: scopedId, status: 'skipped', reason: 'low_value' },
      };
    }

    let content = renderKnowledgeMarkdown({ decision, summary });
    content = content.replace(/^id: "PLACEHOLDER"/m, `id: "${extracted.id}"`);

    const knowledgeEntry: KnowledgeEntry = {
      id: extracted.id,
      slug: decision.slug || extracted.slug,
      sessionId,
      explorationId,
      type: decision.type,
      request: extracted.request,
      content,
      confidence: extracted.confidence,
      tags: ensureKnowledgeScopeTags(decision.tags),
      createdAt: Date.now(),
    };

    const dedup = await deduplicateKnowledge(knowledgeEntry, this.knowledgeRepo);
    if (dedup.action === 'skip') {
      appendKnowledgeLog({ op: 'skip', id: extracted.id, reason: dedup.reason });
      return {
        result: { id: scopedId, status: 'skipped', reason: dedup.reason || 'dedup_skip' },
      };
    }

    if (dedup.action === 'update' && dedup.targetId) {
      knowledgeEntry.id = dedup.targetId;
      const existing = await this.knowledgeRepo.findById(dedup.targetId);
      if (existing) {
        knowledgeEntry.content = renderKnowledgeMarkdown({
          decision: { ...decision, action: 'update', target_id: dedup.targetId },
          summary,
          existing,
        });
      }
    }

    const saved = await this.knowledgeRepo.save(
      knowledgeEntry,
      { overwrite: dedup.action === 'update' },
    );

    if (!saved.success) {
      return {
        result: { id: scopedId, status: 'skipped', reason: saved.reason },
      };
    }

    this.saveEvidence(sessionId, explorationId, summary, extracted.evidenceContent);
    await rebuildKnowledgeIndex(this.knowledgeRepo);
    await regenerateProgressPage(this.knowledgeRepo);
    const op = dedup.action === 'update' ? 'update' : 'ingest';
    appendKnowledgeLog({ op, id: knowledgeEntry.id, reason: op === 'update' ? 'dedup_update' : 'created' });

    return {
      result: {
        id: scopedId,
        status: dedup.action === 'update' ? 'updated' : 'saved',
        path: saved.path,
        reason: dedup.action === 'update' ? `knowledge_updated:${knowledgeEntry.id}` : undefined,
      },
      evidenceJson: extracted.evidenceContent,
    };
  }

  private saveEvidence(
    sessionId: string,
    explorationId: string,
    summary: ExplorationSummary,
    evidenceContent?: string,
  ): void {
    try {
      if (evidenceContent) {
        this.evidenceRepo.saveEvidence(
          sessionId,
          explorationId,
          JSON.parse(evidenceContent),
        );
        return;
      }
      const extracted = extractWikiEntry(summary);
      if (extracted?.evidenceContent) {
        this.evidenceRepo.saveEvidence(
          sessionId,
          explorationId,
          JSON.parse(extracted.evidenceContent),
        );
      }
    } catch {
      // evidence is best-effort
    }
  }
}

let defaultService: WikiMaintenanceService | null = null;

export function getWikiMaintenanceService(): WikiMaintenanceService {
  if (!defaultService) {
    defaultService = new WikiMaintenanceService();
  }
  return defaultService;
}
