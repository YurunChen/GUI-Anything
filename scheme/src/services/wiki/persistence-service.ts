import {
  makeSessionScopedId,
  type Exploration,
  type ExplorationNode,
  type PersistResult,
  type SessionScopedId,
  type SummaryItem,
} from '../../data/protocol/observer-protocol';
import {
  extractWikiEntry,
  type ExplorationSummary,
} from './auto-extractor';
import {
  KnowledgeRepository,
  type KnowledgeEntry,
} from '../../data/wiki/knowledge-repository';
import { EvidenceRepository } from '../../data/wiki/evidence-repository';
import { deduplicateKnowledge } from '../../data/management/data-governance';

export interface WikiPersistenceService {
  persistCompleted(input: {
    sessionId: string;
    explorations: Exploration[];
    summaries: Record<SessionScopedId, SummaryItem>;
  }): Promise<Record<SessionScopedId, PersistResult>>;
  hydratePersisted(sessionId: string): Promise<Record<SessionScopedId, PersistResult>>;
  resetSession(sessionId: string): void;
}

export class DefaultWikiPersistenceService implements WikiPersistenceService {
  private persisted = new Set<SessionScopedId>();
  private sessionId = '';
  private knowledgeRepo: KnowledgeRepository;
  private evidenceRepo: EvidenceRepository;

  constructor(knowledgeRepo?: KnowledgeRepository) {
    this.knowledgeRepo = knowledgeRepo || new KnowledgeRepository();
    this.evidenceRepo = new EvidenceRepository();
  }

  resetSession(sessionId: string): void {
    if (sessionId === this.sessionId) return;
    this.sessionId = sessionId;
    this.persisted.clear();
  }

  async hydratePersisted(sessionId: string): Promise<Record<SessionScopedId, PersistResult>> {
    this.resetSession(sessionId);
    const hasKnowledge = await this.knowledgeRepo.hasAnyFromSession(sessionId);
    const results: Record<SessionScopedId, PersistResult> = {};

    if (hasKnowledge) {
      // 标记该 session 所有 exploration 为已保存
      const all = await this.knowledgeRepo.listAll();
      for (const entry of all) {
        if (entry.sessionId === sessionId) {
          const id = makeSessionScopedId(sessionId, entry.explorationId);
          this.persisted.add(id);
          results[id] = {
            id,
            status: 'saved',
            reason: `loaded_from_wiki:${entry.slug || entry.id}`,
            path: `wiki/knowledge-base/${entry.type}/${entry.slug || entry.id}.md`,
          };
        }
      }
    }

    return results;
  }

  async persistCompleted(input: {
    sessionId: string;
    explorations: Exploration[];
    summaries: Record<SessionScopedId, SummaryItem>;
  }): Promise<Record<SessionScopedId, PersistResult>> {
    this.resetSession(input.sessionId);
    const results: Record<SessionScopedId, PersistResult> = {};

    for (const exploration of input.explorations) {
      if (exploration.status !== 'complete') continue;
      const id = makeSessionScopedId(input.sessionId, exploration.id);
      if (this.persisted.has(id)) continue;

      const item = input.summaries[id];
      if (!item?.text?.trim()) {
        results[id] = { id, status: 'skipped', reason: 'missing_summary' };
        continue;
      }
      if (item.persistMeta?.should_persist === false) {
        this.persisted.add(id);
        results[id] = { id, status: 'skipped', reason: 'model_opt_out' };
        continue;
      }

      const summary = toExplorationSummary(input.sessionId, exploration, item);
      if (isLowValue(summary)) {
        this.persisted.add(id);
        results[id] = { id, status: 'skipped', reason: 'low_value' };
        continue;
      }

      const entry = extractWikiEntry(summary);
      if (!entry) {
        this.persisted.add(id);
        results[id] = { id, status: 'skipped', reason: 'low_value' };
        continue;
      }

      try {
        if (entry.evidenceContent) {
          this.evidenceRepo.saveEvidence(
            input.sessionId,
            exploration.id,
            JSON.parse(entry.evidenceContent)
          );
        }

        const knowledgeEntry: KnowledgeEntry = {
          id: entry.id,
          slug: entry.slug,
          sessionId: input.sessionId,
          explorationId: exploration.id,
          type: entry.type,
          request: entry.request,
          content: entry.content,
          confidence: entry.confidence,
          tags: [],
          createdAt: Date.now(),
        };

        const dedup = await deduplicateKnowledge(knowledgeEntry, this.knowledgeRepo);
        if (dedup.action === 'skip') {
          this.persisted.add(id);
          results[id] = {
            id,
            status: 'skipped',
            reason: dedup.reason || 'dedup_skip',
          };
          continue;
        }

        if (dedup.action === 'update' && dedup.targetId) {
          knowledgeEntry.id = dedup.targetId;
        }

        const saved = await this.knowledgeRepo.save(
          knowledgeEntry,
          { overwrite: dedup.action === 'update' },
        );

        if (saved.success) {
          this.persisted.add(id);
          results[id] = { id, status: 'saved', path: saved.path };
        } else {
          results[id] = { id, status: 'skipped', reason: saved.reason };
        }
      } catch (error) {
        results[id] = {
          id,
          status: 'failed',
          reason: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return results;
  }
}

function toExplorationSummary(
  sessionId: string,
  exploration: Exploration,
  item: SummaryItem,
): ExplorationSummary {
  return {
    id: exploration.id,
    request: exploration.question,
    summary: item.text,
    commands: extractCommandsFromNodes(exploration.nodes),
    files: extractPathsFromNodes(exploration.nodes),
    nodes: exploration.nodes.map((node: ExplorationNode) => ({
      timestamp: node.timestamp,
      type: node.type,
      label: node.rawText || node.label,
      status: node.status,
      phase: node.phase,
      rawCommand: node.rawCommand,
    })),
    result: 'success',
    duration: 0,
    tokens: 0,
    sessionId,
    persistMeta: item.persistMeta,
  };
}

function extractCommandsFromNodes(nodes: ExplorationNode[]): string[] {
  const values = nodes
    .filter((node) => node.type === 'tool')
    .map((node) => {
      if (typeof node.rawCommand === 'string' && node.rawCommand.trim().length > 0) {
        return node.rawCommand.trim();
      }
      return typeof node.label === 'string' ? node.label.trim() : '';
    })
    .filter((value) => value.length > 0);
  return [...new Set(values)].slice(0, 5);
}

function extractPathsFromNodes(nodes: ExplorationNode[]): string[] {
  const paths = new Set<string>();
  for (const node of nodes) {
    if (!node.label) continue;
    const matches = node.label.match(/([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)/g);
    if (!matches) continue;
    for (const item of matches) paths.add(item);
  }
  return [...paths].slice(0, 8);
}

function isLowValue(summary: ExplorationSummary): boolean {
  const request = (summary.request || '').trim().toLowerCase();
  const summaryText = (summary.summary || '').trim().toLowerCase();
  const hasWork = summary.commands.length > 0 || summary.files.length > 0;
  if (hasWork || request.length > 24) return false;
  return ['hello', 'hi', 'hey', '你好', '您好', '在吗', 'test', 'ping']
    .some((word) => request === word || summaryText.includes(word));
}
