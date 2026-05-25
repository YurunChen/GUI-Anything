import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DefaultWikiPersistenceService } from './persistence-service';
import { WikiMaintenanceService } from './wiki-maintenance-service';
import { KnowledgeRepository } from '../../data/wiki/knowledge-repository';
import { makeSessionScopedId } from '../../data/protocol/observer-protocol';

describe('DefaultWikiPersistenceService', () => {
  let tmpDir: string;
  let originalWikiDir: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-persist-'));
    originalWikiDir = process.env.FLOW_WIKI_DIR;
    process.env.FLOW_WIKI_DIR = tmpDir;
  });

  afterEach(() => {
    if (originalWikiDir !== undefined) {
      process.env.FLOW_WIKI_DIR = originalWikiDir;
    } else {
      delete process.env.FLOW_WIKI_DIR;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('hydrates from sources block when sessionId fields are missing on entry', async () => {
    const contextsDir = path.join(tmpDir, 'knowledge', 'contexts');
    fs.mkdirSync(contextsDir, { recursive: true });
    fs.writeFileSync(path.join(contextsDir, 'C002-flow-observer.md'), `---
id: C002
slug: flow-observer
request: "分析项目"
type: context
source: flow-observer
sources:
  - session_id: "sess-hydrate"
    exploration_id: "exp_analyze"
---
## 摘要
body
`, 'utf-8');

    const service = new DefaultWikiPersistenceService(new KnowledgeRepository(tmpDir));
    const results = await service.hydratePersisted('sess-hydrate');
    const scopedId = makeSessionScopedId('sess-hydrate', 'exp_analyze');
    expect(results[scopedId]?.status).toBe('saved');
  });

  it('only persists requested exploration ids', async () => {
    let callCount = 0;
    const maintenance = {
      maintainExploration: async () => {
        callCount += 1;
        return { result: { id: 's:exp_b' as const, status: 'saved' as const } };
      },
    } as unknown as WikiMaintenanceService;

    const service = new DefaultWikiPersistenceService(
      new KnowledgeRepository(tmpDir),
      maintenance,
    );

    await service.persistCompleted({
      sessionId: 's',
      onlyExplorationIds: ['exp_b'],
      explorations: [
        {
          id: 'exp_a',
          question: 'a',
          status: 'complete',
          nodes: [],
          startedAt: 1,
          currentPhase: 'idle',
          phaseSeen: { explore: false, execute: false, verify: false },
          errorCounts: { tool: 0, system: 0, result: 0 },
        },
        {
          id: 'exp_b',
          question: 'b',
          status: 'complete',
          nodes: [],
          startedAt: 2,
          currentPhase: 'idle',
          phaseSeen: { explore: false, execute: false, verify: false },
          errorCounts: { tool: 0, system: 0, result: 0 },
        },
      ],
      summaries: {
        's:exp_a': {
          id: 's:exp_a',
          sessionId: 's',
          explorationId: 'exp_a',
          text: 'a',
          status: 'ready',
          source: 'ai',
          persistMeta: null,
        },
        's:exp_b': {
          id: 's:exp_b',
          sessionId: 's',
          explorationId: 'exp_b',
          text: 'b',
          status: 'ready',
          source: 'ai',
          persistMeta: null,
        },
      },
    });

    expect(callCount).toBe(1);
  });
});
