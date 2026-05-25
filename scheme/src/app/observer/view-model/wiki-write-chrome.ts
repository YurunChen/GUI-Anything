import type {
  ExplorationId,
  IntentBucketLedger,
  PersistResult,
} from '../../../data/protocol/observer-protocol';
import { shouldCurateWikiForIntent } from '../../../constants/session-intent-keys';
import type { WikiPersistStatus } from '../../../services/wiki/wiki-persist-policy';

export interface WikiWriteChromeInput {
  explorationId: ExplorationId;
  ledger: IntentBucketLedger | null;
  inFlightIntentKey?: string | null;
}

export interface WikiWriteChromeView {
  showWriteBadge: boolean;
  status?: WikiPersistStatus;
  result?: PersistResult;
  targetId?: string;
  turnCount?: number;
}

export function resolveWikiWriteChrome(input: WikiWriteChromeInput): WikiWriteChromeView {
  const { ledger, explorationId, inFlightIntentKey } = input;
  if (!ledger) return { showWriteBadge: false };

  for (const bucket of Object.values(ledger.buckets)) {
    const isAnchor = bucket.anchorExplorationId === explorationId
      || (inFlightIntentKey === bucket.intentKey
        && bucket.explorationIds[bucket.explorationIds.length - 1] === explorationId
        && !bucket.curatedAt);

    if (!isAnchor) continue;
    if (!shouldCurateWikiForIntent(bucket.intentKey)) {
      continue;
    }

    const turnCount = bucket.explorationIds.length;
    const targetId = parseTargetId(bucket.persistResult?.reason);

    if (inFlightIntentKey === bucket.intentKey && !bucket.curatedAt) {
      return {
        showWriteBadge: true,
        status: 'pending',
        turnCount,
      };
    }

    if (bucket.persistResult) {
      return {
        showWriteBadge: true,
        status: bucket.persistResult.status === 'failed' ? 'failed' : bucket.persistResult.status,
        result: bucket.persistResult,
        targetId,
        turnCount,
      };
    }
  }

  return { showWriteBadge: false };
}

function parseTargetId(reason?: string): string | undefined {
  if (!reason) return undefined;
  const match = reason.match(/(?:knowledge_(?:saved|updated)|loaded_from_wiki|loaded_from_evidence):([A-Z]\d+)/i)
    ?? reason.match(/:([CE]\d{3})\b/);
  return match?.[1];
}
