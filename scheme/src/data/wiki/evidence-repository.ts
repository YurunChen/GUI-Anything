/**
 * Evidence storage — backed by session bundle curation.evidence
 */

import type { SessionId, ExplorationId } from '../protocol/observer-protocol';
import { resolveWikiRoot } from '../env';
import {
  defaultSessionBundleRepository,
  type SessionBundleRepository,
} from './session-bundle-repository';
import type { BundleEvidenceEntry } from './session-bundle-types';
import { listSessionBundleIds } from './wiki-data-layout';

export interface EvidenceEntry {
  explorationId: string;
  request: string;
  summary: string;
  result: string;
  duration: number;
  tokens: number;
  commands: string[];
  files: string[];
  nodes: unknown[];
  persistMeta: unknown | null;
  savedAt: string;
  endedAt?: number;
}

export interface EvidenceData {
  sessionId: string;
  cachedAt: number;
  entries: Record<ExplorationId, EvidenceEntry>;
}

export class EvidenceRepository {
  private wikiRoot: string;
  private bundleRepo: SessionBundleRepository;

  constructor(wikiRoot?: string, bundleRepo?: SessionBundleRepository) {
    this.wikiRoot = wikiRoot || resolveWikiRoot();
    this.bundleRepo = bundleRepo ?? defaultSessionBundleRepository();
  }

  listSessions(): string[] {
    return listSessionBundleIds(this.wikiRoot);
  }

  loadEvidence(sessionId: SessionId): EvidenceData | null {
    const bundle = this.bundleRepo.load(sessionId);
    if (!bundle) return null;
    const entries: Record<ExplorationId, EvidenceEntry> = {};
    for (const [id, entry] of Object.entries(bundle.curation.evidence)) {
      entries[id] = { ...entry };
    }
    return {
      sessionId,
      cachedAt: bundle.meta.updatedAt,
      entries,
    };
  }

  saveEvidence(
    sessionId: SessionId,
    explorationId: ExplorationId,
    entry: Omit<EvidenceEntry, 'explorationId'>,
  ): void {
    this.bundleRepo.patch(sessionId, (bundle) => {
      const stored: BundleEvidenceEntry = {
        ...entry,
        explorationId,
      };
      bundle.curation.evidence[explorationId] = stored;
    });
  }

  deleteEvidence(sessionId: SessionId): void {
    this.bundleRepo.patch(sessionId, (bundle) => {
      bundle.curation.evidence = {};
    });
  }

  deleteExplorationEvidence(
    sessionId: SessionId,
    explorationId: ExplorationId,
  ): void {
    this.bundleRepo.patch(sessionId, (bundle) => {
      delete bundle.curation.evidence[explorationId];
    });
  }

  stats(): { totalSessions: number; totalExplorations: number } {
    const sessions = this.listSessions();
    let totalExplorations = 0;
    for (const sessionId of sessions) {
      const evidence = this.loadEvidence(sessionId);
      if (evidence) {
        totalExplorations += Object.keys(evidence.entries).length;
      }
    }
    return {
      totalSessions: sessions.length,
      totalExplorations,
    };
  }
}

let defaultRepo: EvidenceRepository | null = null;

export function getEvidenceRepository(): EvidenceRepository {
  if (!defaultRepo) {
    defaultRepo = new EvidenceRepository();
  }
  return defaultRepo;
}
