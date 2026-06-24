/**
 * Project evolution repository — reads intent history across all session bundles
 * for a workspace and lifts it into raw evolution records.
 *
 * Read-only aggregation over wiki/sessions/{id}/bundle.json. The synthesis of
 * "eras"/milestones lives in services/evolution; this layer only extracts.
 */

import type { SessionId } from '../protocol/observer-protocol';
import type {
  EvolutionRevision,
  ExplorationMetricsRaw,
  KnowledgeRetrievalRaw,
  KnowledgeWriteRaw,
  ProjectEvolutionRaw,
  SessionEvolutionRaw,
} from '../protocol/evolution-types';
import { resolveWorkspaceRootForCache, workspaceRootsMatch } from '../session/workspace-root';
import {
  FileSessionBundleRepository,
  type SessionBundleRepository,
} from './session-bundle-repository';
import type { SessionBundle } from './session-bundle-types';
import { listSessionBundleIds } from './wiki-data-layout';

export interface ProjectEvolutionRepository {
  loadProjectEvolution(opts?: { workspaceRoot?: string }): ProjectEvolutionRaw;
  loadSessionEvolution(sessionId: SessionId): SessionEvolutionRaw | null;
}

export interface ProjectEvolutionRepositoryOptions {
  wikiRoot?: string;
  bundleRepo?: SessionBundleRepository;
}

function extractSessionEvolution(bundle: SessionBundle): SessionEvolutionRaw | null {
  const intent = bundle.session.intent;
  const history = intent?.history ?? [];

  const revisions: EvolutionRevision[] = history
    .map((rev) => ({
      explorationId: rev.explorationId,
      at: rev.at,
      intentKey: rev.intentKey,
      nodeTitle: rev.nodeTitle,
      delta: rev.titleDelta,
      note: rev.titleDeltaNote,
    }))
    .sort((a, b) => a.at - b.at);

  if (revisions.length === 0) return null;

  const summaries: Record<string, string> = {};
  const metricsByExp: Record<string, ExplorationMetricsRaw> = {};
  const retrievals: KnowledgeRetrievalRaw[] = [];
  const writes: KnowledgeWriteRaw[] = [];
  for (const [explorationId, record] of Object.entries(bundle.explorations)) {
    const text = record.summary?.text?.trim();
    if (text) summaries[explorationId] = text;

    const meta = record.meta;
    const hasRetrieval = !!record.retrieval;
    const write = record.write;
    const hasWrite = !!write && (write.status === 'saved' || write.status === 'updated');
    if (meta || hasRetrieval || hasWrite) {
      metricsByExp[explorationId] = {
        toolCount: meta?.toolCount ?? 0,
        errorCount: meta?.errorCount ?? 0,
        interrupted: meta?.status === 'interrupted',
        tokens: meta?.tokens,
        files: meta?.files,
        durationMs: meta?.durationMs,
        retrieval: hasRetrieval,
        write: hasWrite,
      };
    }

    const ret = record.retrieval;
    if (ret) {
      retrievals.push({
        explorationId,
        request: ret.request ?? '',
        excerpt: ret.excerpt ?? '',
        tags: ret.tags ?? [],
        score: ret.score ?? 0,
        type: ret.type ?? 'context',
      });
    }
    if (hasWrite && write) {
      writes.push({
        explorationId,
        targetId: write.targetId,
        targetPath: write.targetPath,
        status: write.status,
      });
    }
  }

  const startedAt = revisions[0].at;
  const updatedAt = intent?.updatedAt ?? bundle.meta.updatedAt;
  const title = intent?.nodeTitle || revisions[revisions.length - 1].nodeTitle || bundle.meta.sessionId;

  return {
    sessionId: bundle.meta.sessionId,
    workspaceRoot: bundle.meta.workspaceRoot,
    startedAt,
    updatedAt,
    title,
    revisions,
    summaries,
    metricsByExp,
    retrievals,
    writes,
  };
}

export class FileProjectEvolutionRepository implements ProjectEvolutionRepository {
  private readonly wikiRoot?: string;
  private readonly bundleRepo: SessionBundleRepository;

  constructor(options: ProjectEvolutionRepositoryOptions = {}) {
    this.wikiRoot = options.wikiRoot;
    this.bundleRepo = options.bundleRepo ?? new FileSessionBundleRepository({ wikiRoot: options.wikiRoot });
  }

  loadProjectEvolution(opts: { workspaceRoot?: string } = {}): ProjectEvolutionRaw {
    const targetWorkspace = opts.workspaceRoot ?? resolveWorkspaceRootForCache();
    const sessions: SessionEvolutionRaw[] = [];

    for (const sessionId of listSessionBundleIds(this.wikiRoot)) {
      const bundle = this.bundleRepo.load(sessionId);
      if (!bundle) continue;
      if (!workspaceRootsMatch(bundle.meta.workspaceRoot, targetWorkspace)) continue;
      const evolution = extractSessionEvolution(bundle);
      if (evolution) sessions.push(evolution);
    }

    sessions.sort((a, b) => a.startedAt - b.startedAt);
    return { workspaceRoot: targetWorkspace, sessions };
  }

  loadSessionEvolution(sessionId: SessionId): SessionEvolutionRaw | null {
    const bundle = this.bundleRepo.load(sessionId);
    if (!bundle) return null;
    return extractSessionEvolution(bundle);
  }
}

export function defaultProjectEvolutionRepository(
  options?: ProjectEvolutionRepositoryOptions,
): FileProjectEvolutionRepository {
  return new FileProjectEvolutionRepository(options);
}
