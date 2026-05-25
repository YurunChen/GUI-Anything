import {
  makeSessionScopedId,
  type Exploration,
  type ExplorationId,
  type PersistResult,
  type SessionScopedId,
  type SummaryItem,
} from '../../data/protocol/observer-protocol';
import {
  KnowledgeRepository,
  knowledgeEntryWikiPath,
} from '../../data/wiki/knowledge-repository';
import { EvidenceRepository } from '../../data/wiki/evidence-repository';
import {
  WikiMaintenanceService,
  getWikiMaintenanceService,
} from './wiki-maintenance-service';
import { isSummaryReadyForWiki } from './wiki-persist-policy';

export interface WikiPersistenceService {
  persistCompleted(input: {
    sessionId: string;
    explorations: Exploration[];
    summaries: Record<SessionScopedId, SummaryItem>;
    onlyExplorationIds?: ExplorationId[];
  }): Promise<Record<SessionScopedId, PersistResult>>;
  hydratePersisted(sessionId: string): Promise<Record<SessionScopedId, PersistResult>>;
  resetSession(sessionId: string): void;
  markPersisted(scopedId: SessionScopedId): void;
}

export class DefaultWikiPersistenceService implements WikiPersistenceService {
  private persisted = new Set<SessionScopedId>();
  private inFlight = new Set<SessionScopedId>();
  private sessionId = '';
  private knowledgeRepo: KnowledgeRepository;
  private evidenceRepo: EvidenceRepository;
  private maintenance: WikiMaintenanceService;

  constructor(
    knowledgeRepo?: KnowledgeRepository,
    maintenance?: WikiMaintenanceService,
    evidenceRepo?: EvidenceRepository,
  ) {
    this.knowledgeRepo = knowledgeRepo || new KnowledgeRepository();
    this.evidenceRepo = evidenceRepo || new EvidenceRepository();
    this.maintenance = maintenance || getWikiMaintenanceService();
  }

  resetSession(sessionId: string): void {
    if (sessionId === this.sessionId) return;
    this.sessionId = sessionId;
    this.persisted.clear();
    this.inFlight.clear();
  }

  markPersisted(scopedId: SessionScopedId): void {
    this.persisted.add(scopedId);
  }

  async hydratePersisted(sessionId: string): Promise<Record<SessionScopedId, PersistResult>> {
    this.resetSession(sessionId);
    const results: Record<SessionScopedId, PersistResult> = {};

    const all = await this.knowledgeRepo.listAll();
    for (const entry of all) {
      const scopedId = resolveHydratedScopedId(sessionId, entry);
      if (!scopedId || results[scopedId]) continue;
      this.persisted.add(scopedId);
      results[scopedId] = {
        id: scopedId,
        status: 'saved',
        reason: `loaded_from_wiki:${entry.slug || entry.id}`,
        path: knowledgeEntryWikiPath(entry),
      };
    }

    const evidence = this.evidenceRepo.loadEvidence(sessionId);
    if (evidence?.entries) {
      for (const explorationId of Object.keys(evidence.entries)) {
        const scopedId = makeSessionScopedId(sessionId, explorationId);
        if (results[scopedId]) continue;
        const entry = await this.knowledgeRepo.findBySource(sessionId, explorationId);
        if (!entry) continue;
        this.persisted.add(scopedId);
        results[scopedId] = {
          id: scopedId,
          status: 'saved',
          reason: `loaded_from_evidence:${entry.slug || entry.id}`,
          path: knowledgeEntryWikiPath(entry),
        };
      }
    }

    return results;
  }

  async persistCompleted(input: {
    sessionId: string;
    explorations: Exploration[];
    summaries: Record<SessionScopedId, SummaryItem>;
    onlyExplorationIds?: ExplorationId[];
  }): Promise<Record<SessionScopedId, PersistResult>> {
    if (input.sessionId !== this.sessionId) {
      this.sessionId = input.sessionId;
      this.persisted.clear();
      this.inFlight.clear();
    }

    const only = input.onlyExplorationIds
      ? new Set(input.onlyExplorationIds)
      : null;
    const results: Record<SessionScopedId, PersistResult> = {};

    for (const exploration of input.explorations) {
      if (exploration.status !== 'complete') continue;
      if (only && !only.has(exploration.id)) continue;

      const id = makeSessionScopedId(input.sessionId, exploration.id);
      if (this.persisted.has(id) || this.inFlight.has(id)) continue;

      const item = input.summaries[id];
      if (!isSummaryReadyForWiki(item)) continue;

      this.inFlight.add(id);
      try {
        const { result } = await this.maintenance.maintainExploration({
          sessionId: input.sessionId,
          exploration,
          summaryItem: item ?? { text: '', status: 'pending' },
        });

        if (result.status === 'saved' || result.status === 'updated' || result.status === 'skipped') {
          this.persisted.add(id);
        }
        results[id] = result;
      } catch (error) {
        results[id] = {
          id,
          status: 'failed',
          reason: error instanceof Error ? error.message : String(error),
        };
      } finally {
        this.inFlight.delete(id);
      }
    }

    return results;
  }
}

function resolveHydratedScopedId(
  sessionId: string,
  entry: Awaited<ReturnType<KnowledgeRepository['listAll']>>[number],
): SessionScopedId | null {
  if (entry.sessionId === sessionId && entry.explorationId) {
    return makeSessionScopedId(sessionId, entry.explorationId);
  }
  const sourceBlock = entry.content.match(/source:\s*\n([\s\S]*?)(?=\n\w+:|$)/)?.[1] ?? '';
  const sourceSession = sourceBlock.match(/session_id:\s*"?([^"\n]+)"?/)?.[1]?.trim();
  const sourceExploration = sourceBlock.match(/exploration_id:\s*"?([^"\n]+)"?/)?.[1]?.trim();
  if (sourceSession === sessionId && sourceExploration) {
    return makeSessionScopedId(sessionId, sourceExploration);
  }
  const sourcesMatch = entry.content.match(
    new RegExp(`session_id:\\s*"${escapeRegExp(sessionId)}"[\\s\\S]*?exploration_id:\\s*"([^"]+)"`, 'm'),
  );
  if (sourcesMatch?.[1]) {
    return makeSessionScopedId(sessionId, sourcesMatch[1]);
  }
  if (entry.sessionId === sessionId && !entry.explorationId) {
    const fromSources = entry.content.match(/exploration_id:\s*"([^"]+)"/)?.[1];
    if (fromSources) return makeSessionScopedId(sessionId, fromSources);
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
