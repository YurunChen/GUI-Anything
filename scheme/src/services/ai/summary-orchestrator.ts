/**
 * Summary orchestrator — hydrate / generate scheduling outside React.
 */

import type {
  Exploration,
  SessionIntentState,
  SessionScopedId,
  SummaryItem,
} from '../../data/protocol/observer-protocol';
import { bundleSummaryFlags } from '../../data/wiki/session-bundle-mappers';
import type { SessionBindingIntent } from '../session/session-binding-policy';
import {
  countMissingSummaries,
  deriveSessionRuntime,
  hasMissingSummaries,
  type SessionRuntime,
} from '../session/session-runtime-policy';
import {
  DefaultExplorationSummaryService,
  type ExplorationSummaryService,
} from './exploration-summary-service';
import { getSessionBundleService } from '../session/session-bundle-service';

export { hasMissingSummaries };

export interface SummaryOrchestratorState {
  items: Record<SessionScopedId, SummaryItem>;
  pendingCount: number;
  summariesReadyKey: string;
  bundleSummaryByExplorationId: Record<string, boolean>;
}

export type SummaryGenerateDecision =
  | { action: 'idle'; pendingCount: number }
  | { action: 'pending'; pendingCount: number }
  | {
      action: 'run';
      pendingCount: number;
      existing: Record<SessionScopedId, SummaryItem>;
      priorBundleSummaryFlags: Record<string, boolean>;
    };

export interface SummaryGenerateFinishResult {
  generatedItems: Record<SessionScopedId, SummaryItem>;
  items: Record<SessionScopedId, SummaryItem>;
  bundleSummaryByExplorationId: Record<string, boolean>;
  pendingCount: number;
}

export class SummaryOrchestrator {
  constructor(private readonly summaryService: ExplorationSummaryService = new DefaultExplorationSummaryService()) {}

  get service(): ExplorationSummaryService {
    return this.summaryService;
  }

  resetSession(sessionId: string): SummaryOrchestratorState {
    this.summaryService.resetSession(sessionId);
    return {
      items: {},
      pendingCount: 0,
      summariesReadyKey: '',
      bundleSummaryByExplorationId: {},
    };
  }

  hydrate(sessionId: string, jsonlPath: string): SummaryOrchestratorState {
    const hydrateKey = `${sessionId}|${jsonlPath}`;
    const fromBundle = this.summaryService.hydrateFromBundle(sessionId, jsonlPath);
    const bundle = getSessionBundleService().load(sessionId);
    return {
      items: { ...fromBundle.items },
      pendingCount: 0,
      summariesReadyKey: hydrateKey,
      bundleSummaryByExplorationId: bundleSummaryFlags(bundle),
    };
  }

  deriveRuntime(input: {
    intent: SessionBindingIntent;
    sessionId: string;
    sessionBound: boolean;
    explorations: Exploration[];
    summaryItems: Record<SessionScopedId, SummaryItem>;
    wikiBundleHasData: boolean;
  }): SessionRuntime {
    return deriveSessionRuntime({
      intent: input.intent,
      sessionId: input.sessionId,
      sessionBound: input.sessionBound,
      explorations: input.explorations,
      summaryItems: input.summaryItems,
      wikiBundleHasData: input.wikiBundleHasData,
      explorationCount: input.explorations.length,
      summaryCount: Object.values(input.summaryItems).filter((i) => i.text?.trim()).length,
      flowchartHintCount: 0,
    });
  }

  shouldRunGenerate(input: {
    allowRegen: boolean;
    sessionId: string;
    summariesReadyKey: string;
    sessionPath: string;
    explorations: Exploration[];
    items: Record<SessionScopedId, SummaryItem>;
  }): boolean {
    if (!shouldGenerateMissingSummaries({
      allowRegen: input.allowRegen,
      sessionId: input.sessionId,
      summariesReadyKey: input.summariesReadyKey,
      sessionPath: input.sessionPath,
    })) {
      return false;
    }
    if (this.summaryService.pendingCount() > 0) return false;
    return hasMissingSummaries(input.sessionId, input.explorations, input.items);
  }

  planGenerate(input: {
    allowRegen: boolean;
    sessionId: string;
    summariesReadyKey: string;
    sessionPath: string;
    explorations: Exploration[];
    items: Record<SessionScopedId, SummaryItem>;
    bundleSummaryByExplorationId: Record<string, boolean>;
  }): SummaryGenerateDecision {
    if (!shouldGenerateMissingSummaries({
      allowRegen: input.allowRegen,
      sessionId: input.sessionId,
      summariesReadyKey: input.summariesReadyKey,
      sessionPath: input.sessionPath,
    })) {
      return { action: 'idle', pendingCount: 0 };
    }

    const pendingCount = this.summaryService.pendingCount();
    if (pendingCount > 0) {
      return { action: 'pending', pendingCount };
    }

    const missingCount = countMissingSummaries(input.sessionId, input.explorations, input.items);
    if (missingCount === 0) {
      return { action: 'idle', pendingCount: 0 };
    }

    return {
      action: 'run',
      pendingCount: missingCount,
      existing: { ...input.items },
      priorBundleSummaryFlags: { ...input.bundleSummaryByExplorationId },
    };
  }

  async generateAndFinish(input: {
    sessionId: string;
    sessionPath: string;
    explorations: Exploration[];
    existing: Record<SessionScopedId, SummaryItem>;
    priorBundleSummaryFlags: Record<string, boolean>;
    summaryModel?: string;
  }): Promise<SummaryGenerateFinishResult> {
    const generatedItems = await this.summaryService.generateMissing({
      sessionId: input.sessionId,
      explorations: input.explorations,
      jsonlPath: input.sessionPath,
      existing: input.existing,
      summaryModel: input.summaryModel,
    });
    const finished = await this.finishGenerate({
      sessionId: input.sessionId,
      sessionPath: input.sessionPath,
      existing: input.existing,
      generatedItems,
      priorBundleSummaryFlags: input.priorBundleSummaryFlags,
    });
    return {
      generatedItems,
      ...finished,
    };
  }

  async finishGenerate(input: {
    sessionId: string;
    sessionPath: string;
    existing: Record<SessionScopedId, SummaryItem>;
    generatedItems: Record<SessionScopedId, SummaryItem>;
    priorBundleSummaryFlags: Record<string, boolean>;
  }): Promise<{
    items: Record<SessionScopedId, SummaryItem>;
    bundleSummaryByExplorationId: Record<string, boolean>;
    pendingCount: number;
  }> {
    let items = { ...input.existing, ...input.generatedItems };
    let bundleSummaryByExplorationId = { ...input.priorBundleSummaryFlags };
    const pendingCount = this.summaryService.pendingCount();

    if (pendingCount === 0) {
      if (Object.keys(input.generatedItems).length === 0) {
        const fromBundle = this.summaryService.hydrateFromBundle(input.sessionId, input.sessionPath);
        items = { ...items, ...fromBundle.items };
        bundleSummaryByExplorationId = bundleSummaryFlags(
          getSessionBundleService().load(input.sessionId),
        );
      } else {
        for (const item of Object.values(input.generatedItems)) {
          if (item.text?.trim()) {
            bundleSummaryByExplorationId[item.explorationId] = true;
          }
        }
      }
    }

    return { items, bundleSummaryByExplorationId, pendingCount };
  }

  getSessionIntent(sessionId: string): SessionIntentState | null {
    if (!sessionId.trim()) return null;
    return getSessionBundleService().getSessionIntent(sessionId);
  }
}

let defaultOrchestrator: SummaryOrchestrator | null = null;

export function getSummaryOrchestrator(): SummaryOrchestrator {
  if (!defaultOrchestrator) {
    defaultOrchestrator = new SummaryOrchestrator();
  }
  return defaultOrchestrator;
}

export function buildGenerateTriggerKey(explorations: Exploration[]): string {
  return explorations
    .filter((e) => e.status === 'complete' && e.nodes.length > 0)
    .map((e) => e.id)
    .join(',');
}

export function shouldGenerateMissingSummaries(input: {
  allowRegen: boolean;
  sessionId: string;
  summariesReadyKey: string;
  sessionPath: string;
}): boolean {
  if (!input.allowRegen) return false;
  if (!input.sessionId || !input.sessionPath) return false;
  return input.summariesReadyKey === `${input.sessionId}|${input.sessionPath}`;
}
