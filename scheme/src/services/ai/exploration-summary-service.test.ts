import { describe, expect, it } from 'bun:test';
import { DefaultExplorationSummaryService } from './exploration-summary-service';
import type { Exploration } from '../../data/protocol/observer-protocol';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { FileSessionBundleRepository } from '../../data/wiki/session-bundle-repository';

describe('DefaultExplorationSummaryService', () => {
  it('does not generate when a session-scoped wiki summary already exists', async () => {
    const service = new DefaultExplorationSummaryService();
    const exploration: Exploration = {
      id: 'exp_1',
      question: 'why is summary mismatched?',
      startedAt: Date.now(),
      status: 'complete',
      currentPhase: 'idle',
      phaseSeen: { explore: true, execute: false, verify: false },
      errorCounts: { tool: 0, system: 0, result: 0 },
      nodes: [{
        id: 'n1',
        timestamp: Date.now(),
        type: 'response',
        label: 'done',
      }],
    };

    await expect(service.generateMissing({
      sessionId: 'session-a',
      explorations: [exploration],
      jsonlPath: '/tmp/test-session.jsonl',
      existing: {
        'session-a:exp_1': {
          id: 'session-a:exp_1',
          sessionId: 'session-a',
          explorationId: 'exp_1',
          text: 'from wiki',
          source: 'wiki',
          status: 'ready',
          persistMeta: null,
        },
      },
    })).resolves.toEqual({});
  });

  it('generates summaries sequentially and passes prior session summaries in history', async () => {
    const attempts: Record<string, number> = {};
    let active = 0;
    let maxActive = 0;
    const historyByQuestion: Record<string, Array<{ summary?: string }>> = {};

    const service = new DefaultExplorationSummaryService({
      maxAttempts: 2,
      generateSummary: async (question, _nodes, history, _model, sessionIntent) => {
        attempts[question] = (attempts[question] || 0) + 1;
        active += 1;
        maxActive = Math.max(maxActive, active);
        historyByQuestion[question] = history;
        if (question === 'normal-b' && sessionIntent) {
          expect(sessionIntent.intentKey).toBe(`intent_${'normal-a'}`);
        }
        try {
          if (question === 'retry-me' && attempts[question] === 1) {
            throw new Error('transient');
          }
          return {
            displaySummary: `summary:${question}`,
            persist: null,
            flowchart: {
              nodeId: `intent_${question}`,
              nodeTitle: `intent ${question}`,
              parentId: null,
              branchType: 'trunk',
              importance: 'high',
              dropFromChart: false,
              intentKey: `intent_${question}`,
              titleDelta: 'pivot',
            },
          };
        } finally {
          active -= 1;
        }
      },
      bundleRepository: {
        load: () => null,
        ensure: () => ({ session: { intent: null }, explorations: {} }) as never,
        patch: () => ({ session: { intent: null } }) as never,
        patchExploration: () => ({}) as never,
      } as never,
    });

    const explorations = [
      makeExploration('exp_1', 'retry-me'),
      makeExploration('exp_2', 'normal-a'),
      makeExploration('exp_3', 'normal-b'),
    ];

    const generated = await service.generateMissing({
      sessionId: 'session-b',
      explorations,
      jsonlPath: '/tmp/test-session-b.jsonl',
      existing: {},
    });

    expect(Object.keys(generated)).toHaveLength(3);
    expect(maxActive).toBe(1);
    expect(attempts['retry-me']).toBe(2);
    expect(generated['session-b:exp_1']?.status).toBe('ready');
    expect(generated['session-b:exp_1']?.flowchart?.nodeId).toBe('intent_retry-me');
    expect(historyByQuestion['retry-me']).toEqual([]);
    expect(historyByQuestion['normal-a']?.[0]?.summary).toBe('summary:retry-me');
    expect(historyByQuestion['normal-b']?.map((h) => h.summary)).toEqual([
      'summary:retry-me',
      'summary:normal-a',
    ]);
    expect(service.getRuntimeStats().retried).toBe(1);
  });

  it('falls back to failed summary after retry budget exhausted', async () => {
    const service = new DefaultExplorationSummaryService({
      maxConcurrency: 1,
      maxAttempts: 2,
      generateSummary: async () => {
        throw new Error('always-fail');
      },
      bundleRepository: {
        load: () => null,
        ensure: () => ({ session: { intent: null }, explorations: {} }) as never,
        patch: () => ({ session: { intent: null } }) as never,
        patchExploration: () => ({}) as never,
      } as never,
    });

    const generated = await service.generateMissing({
      sessionId: 'session-c',
      explorations: [makeExploration('exp_1', 'will-fail')],
      jsonlPath: '/tmp/test-session-c.jsonl',
      existing: {},
    });

    const failed = generated['session-c:exp_1'];
    expect(failed).toBeDefined();
    expect(failed?.status).toBe('ready');
    expect(failed?.source).toBe('fallback');
    expect(failed?.reason).toBe('always-fail');
    expect(service.getRuntimeStats().completed).toBe(1);
    expect(service.getRuntimeStats().failed).toBe(0);
    expect(service.getRuntimeStats().retried).toBe(1);
  });

  it('returns cache status details even when cache data is missing', () => {
    const tempDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-summary-service-'));
    process.env.FLOW_WIKI_DIR = path.join(tempDir, 'wiki');
    process.env.FLOW_ROOT_DIR = tempDir;
    fs.mkdirSync(path.join(tempDir, '.git'));
    const jsonlPath = path.join(tempDir, 'session.jsonl');
    fs.writeFileSync(jsonlPath, '', 'utf-8');

    const service = new DefaultExplorationSummaryService({
      bundleRepository: new FileSessionBundleRepository({ wikiRoot: path.join(tempDir, 'wiki') }),
    });
    const result = service.hydrateFromBundle('session-miss', jsonlPath);
    expect(result.cacheStatus).toBe('miss');
    expect(result.items).toEqual({});

    delete process.env.FLOW_WIKI_DIR;
    delete process.env.FLOW_ROOT_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});

function makeExploration(id: string, question: string): Exploration {
  return {
    id,
    question,
    startedAt: Date.now(),
    status: 'complete',
    currentPhase: 'idle',
    phaseSeen: { explore: true, execute: false, verify: false },
    errorCounts: { tool: 0, system: 0, result: 0 },
    nodes: [{
      id: `${id}_n1`,
      timestamp: Date.now(),
      type: 'response',
      label: 'done',
    }],
  };
}
