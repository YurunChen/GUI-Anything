import { describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Exploration } from '../../data/protocol/observer-protocol';
import { FileSessionBundleRepository } from '../../data/wiki/session-bundle-repository';
import { wikiMatchToRetrievalSnapshot } from '../../data/wiki/session-bundle-mappers';
import {
  ensureExplorationRetrieval,
  extractWikiSearchQuery,
  filterPriorKnowledge,
  isExplorationRetrievalResolved,
  isSameTurnKnowledge,
} from './wiki-retrieval-policy';
import type { KnowledgeEntry } from '../../data/wiki/knowledge-repository';

function makeExploration(question: string, nodes: Exploration['nodes'] = []): Exploration {
  return {
    id: 'exp_1',
    question,
    startedAt: 100,
    endedAt: 200,
    status: 'complete',
    currentPhase: 'idle',
    phaseSeen: { explore: false, execute: false, verify: false },
    errorCounts: { tool: 0, system: 0, result: 0 },
    nodes,
  };
}

describe('extractWikiSearchQuery', () => {
  it('returns question when long enough', () => {
    expect(extractWikiSearchQuery(makeExploration('分析当前项目结构'))).toBe('分析当前项目结构');
  });

  it('falls back to response node text', () => {
    const exploration = makeExploration('', [
      { id: 'n1', type: 'response', label: 'resp', status: 'ok', rawText: '这是一段足够长的回复文本用于匹配', timestamp: 100 },
    ]);
    expect(extractWikiSearchQuery(exploration)).toBe('这是一段足够长的回复文本用于匹配');
  });

  it('returns null for short or missing query', () => {
    expect(extractWikiSearchQuery(undefined)).toBeNull();
    expect(extractWikiSearchQuery(makeExploration('hi'))).toBeNull();
    expect(extractWikiSearchQuery(makeExploration(''))).toBeNull();
  });
});

function entry(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id: 'C001',
    slug: 'x',
    sessionId: 's1',
    explorationId: 'exp_2',
    type: 'context',
    request: 'q',
    content: 'c',
    confidence: 1,
    tags: [],
    createdAt: 0,
    ...overrides,
  };
}

describe('wiki-retrieval-policy', () => {
  it('excludes same session+exploration turn', () => {
    expect(isSameTurnKnowledge(entry(), { sessionId: 's1', explorationId: 'exp_2' })).toBe(true);
    expect(isSameTurnKnowledge(entry({ explorationId: 'exp_1' }), { sessionId: 's1', explorationId: 'exp_2' })).toBe(false);
  });

  it('filterPriorKnowledge keeps other turns', () => {
    const prior = entry({ explorationId: 'exp_1' });
    const current = entry({ explorationId: 'exp_2' });
    const filtered = filterPriorKnowledge([prior, current], { sessionId: 's1', explorationId: 'exp_2' });
    expect(filtered).toEqual([prior]);
  });

  it('treats undefined retrieval as unresolved and null as resolved no-hit', () => {
    expect(isExplorationRetrievalResolved(undefined)).toBe(false);
    expect(isExplorationRetrievalResolved({
      explorationId: 'exp_1',
      question: 'q',
      summary: null,
      write: null,
    })).toBe(false);
    expect(isExplorationRetrievalResolved({
      explorationId: 'exp_1',
      question: 'q',
      summary: null,
      retrieval: null,
      write: null,
    })).toBe(true);
  });

  it('ensureExplorationRetrieval persists no-hit before summary path uses bundle', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-retrieval-'));
    const wikiRoot = path.join(tmpDir, 'wiki');
    const jsonlPath = path.join(tmpDir, 'session.jsonl');
    fs.writeFileSync(jsonlPath, '{}');
    process.env.FLOW_WIKI_DIR = wikiRoot;

    const repo = new FileSessionBundleRepository({ wikiRoot });
    const sessionId = 'session-retrieval';
    repo.ensure(sessionId, jsonlPath);

    const match = ensureExplorationRetrieval({
      sessionId,
      exploration: makeExploration('分析下当前的项目架构', [
        { id: 'n1', type: 'tool', label: 'bash', status: 'ok', timestamp: 1 },
      ]),
      jsonlPath,
      allowLiveSearch: true,
      bundleRepository: repo,
    });

    expect(match).toBeNull();
    expect(repo.load(sessionId)?.explorations.exp_1?.retrieval).toBeNull();

    delete process.env.FLOW_WIKI_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ensureExplorationRetrieval reads stored snapshot without live search', () => {
    const snapshot = wikiMatchToRetrievalSnapshot({
      entry: entry({ relativePath: 'contexts/demo/C001-demo.md' }),
      score: 0.9,
      matchedKeywords: ['demo'],
    });
    const repo = {
      load: () => ({
        schemaVersion: 1 as const,
        meta: {
          sessionId: 's1',
          workspaceRoot: '/tmp',
          jsonlPath: '/tmp/s.jsonl',
          jsonlMtime: 1,
          updatedAt: 1,
        },
        session: {
          intent: null,
          flow: {
            revision: 0,
            fingerprint: '',
            flowGraph: { nodes: [], edges: [], updatedAt: 1 },
            flowchartHints: {},
            graphPatchLedger: [],
          },
        },
        curation: { openIntentKey: '', buckets: {}, evidence: {} },
        explorations: {
          exp_1: {
            explorationId: 'exp_1',
            question: 'demo question here',
            summary: null,
            retrieval: snapshot,
            write: null,
          },
        },
      }),
      patchExploration: () => {
        throw new Error('should not patch when bundle already resolved');
      },
    };

    const match = ensureExplorationRetrieval({
      sessionId: 's1',
      exploration: makeExploration('demo question here'),
      jsonlPath: '/tmp/s.jsonl',
      allowLiveSearch: false,
      bundleRepository: repo as unknown as FileSessionBundleRepository,
    });

    expect(match?.entry.id).toBe('C001');
  });
});
