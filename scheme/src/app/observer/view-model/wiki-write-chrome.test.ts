import { describe, expect, it } from 'bun:test';
import { resolveWikiWriteChrome } from './wiki-write-chrome';
import type { IntentBucketLedger } from '../../../data/protocol/observer-protocol';

function ledger(overrides: Partial<IntentBucketLedger> = {}): IntentBucketLedger {
  return {
    sessionId: 's1',
    openIntentKey: 'project_design',
    buckets: {
      project_design: {
        intentKey: 'project_design',
        nodeTitle: 'Analyze',
        explorationIds: ['exp_1', 'exp_2', 'exp_3'],
        anchorExplorationId: 'exp_3',
        curatedAt: 100,
        persistResult: {
          id: 's1:exp_3',
          status: 'updated',
          reason: 'knowledge_updated:C001',
        },
      },
    },
    updatedAt: 100,
    ...overrides,
  };
}

describe('resolveWikiWriteChrome', () => {
  it('shows badge only on anchor exploration', () => {
    const chrome = resolveWikiWriteChrome({
      explorationId: 'exp_3',
      ledger: ledger(),
    });
    expect(chrome.showWriteBadge).toBe(true);
    expect(chrome.status).toBe('updated');
    expect(chrome.targetId).toBe('C001');
    expect(chrome.turnCount).toBe(3);
  });

  it('hides badge on non-anchor explorations in same intent', () => {
    const chrome = resolveWikiWriteChrome({
      explorationId: 'exp_1',
      ledger: ledger(),
    });
    expect(chrome.showWriteBadge).toBe(false);
  });

  it('shows pending on in-flight curate', () => {
    const chrome = resolveWikiWriteChrome({
      explorationId: 'exp_3',
      ledger: {
        ...ledger(),
        buckets: {
          project_design: {
            intentKey: 'project_design',
            nodeTitle: 'Analyze',
            explorationIds: ['exp_1', 'exp_2', 'exp_3'],
          },
        },
      },
      inFlightIntentKey: 'project_design',
    });
    expect(chrome.showWriteBadge).toBe(true);
    expect(chrome.status).toBe('pending');
  });

  it('hides badge when intent is not wiki-eligible', () => {
    const chrome = resolveWikiWriteChrome({
      explorationId: 'exp_3',
      ledger: {
        sessionId: 's1',
        openIntentKey: 'debug',
        buckets: {
          explore: {
            intentKey: 'explore',
            nodeTitle: 'Read codebase',
            explorationIds: ['exp_1', 'exp_2', 'exp_3'],
            anchorExplorationId: 'exp_3',
            curatedAt: 100,
            persistResult: {
              id: 's1:exp_3',
              status: 'skipped',
              reason: 'intent_not_wiki_eligible',
            },
          },
        },
        updatedAt: 100,
      },
    });
    expect(chrome.showWriteBadge).toBe(false);
  });
});
