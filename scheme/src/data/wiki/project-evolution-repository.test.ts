import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { IntentTitleRevision, SessionIntentState } from '../protocol/observer-protocol';
import { FileSessionBundleRepository } from './session-bundle-repository';
import { createEmptyBundle } from './session-bundle-mappers';
import { FileProjectEvolutionRepository } from './project-evolution-repository';

let wikiRoot: string;
let workspaceA: string;
let workspaceB: string;

beforeEach(() => {
  wikiRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evo-wiki-'));
  workspaceA = fs.mkdtempSync(path.join(os.tmpdir(), 'evo-wsA-'));
  workspaceB = fs.mkdtempSync(path.join(os.tmpdir(), 'evo-wsB-'));
});

afterEach(() => {
  for (const dir of [wikiRoot, workspaceA, workspaceB]) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function rev(
  explorationId: string,
  at: number,
  nodeTitle: string,
  titleDelta: IntentTitleRevision['titleDelta'],
  note?: string,
): IntentTitleRevision {
  return { explorationId, at, intentKey: 'explore', nodeTitle, titleDelta, titleDeltaNote: note };
}

function makeIntent(sessionId: string, history: IntentTitleRevision[]): SessionIntentState {
  const last = history[history.length - 1];
  return {
    sessionId,
    revision: history.length,
    intentKey: last?.intentKey ?? 'explore',
    nodeTitle: last?.nodeTitle ?? '',
    parentIntentKey: null,
    phase: 'active',
    history,
    updatedAt: last?.at ?? 0,
  };
}

interface ExpFixture {
  meta?: { status?: 'complete' | 'interrupted'; toolCount?: number; errorCount?: number; tokens?: number; files?: string[]; durationMs?: number };
  retrieval?: boolean;
  write?: 'saved' | 'updated' | 'skipped' | 'failed';
}

function writeBundle(input: {
  sessionId: string;
  workspaceRoot: string;
  history: IntentTitleRevision[];
  summaries?: Record<string, string>;
  explorations?: Record<string, ExpFixture>;
}): void {
  const repo = new FileSessionBundleRepository({ wikiRoot });
  const bundle = createEmptyBundle({
    sessionId: input.sessionId,
    jsonlPath: '/tmp/x.jsonl',
    jsonlMtime: 1,
    workspaceRoot: input.workspaceRoot,
  });
  bundle.session.intent = input.history.length ? makeIntent(input.sessionId, input.history) : null;
  for (const [explorationId, text] of Object.entries(input.summaries ?? {})) {
    bundle.explorations[explorationId] = {
      explorationId,
      question: 'q',
      summary: { text, source: 'ai', status: 'ready', savedAt: 1 },
    };
  }
  for (const [explorationId, fixture] of Object.entries(input.explorations ?? {})) {
    const existing = bundle.explorations[explorationId] ?? { explorationId, question: 'q' };
    if (fixture.meta) {
      existing.meta = {
        status: fixture.meta.status ?? 'complete',
        toolCount: fixture.meta.toolCount ?? 0,
        errorCount: fixture.meta.errorCount ?? 0,
        tokens: fixture.meta.tokens,
        files: fixture.meta.files,
        durationMs: fixture.meta.durationMs,
      };
    }
    if (fixture.retrieval) {
      existing.retrieval = {
        origin: 'retrieved', entryId: 'k1', relativePath: 'k1.md', type: 'context', slug: 'k1',
        request: 'r', excerpt: 'e', tags: [], score: 1, matchedKeywords: [], capturedAt: 1,
      };
    }
    if (fixture.write) {
      existing.write = { origin: 'saved', status: fixture.write, completedAt: 1 };
    }
    bundle.explorations[explorationId] = existing;
  }
  repo.save(bundle);
}

describe('FileProjectEvolutionRepository', () => {
  it('merges sessions across the workspace sorted by startedAt asc', () => {
    writeBundle({
      sessionId: 's-late',
      workspaceRoot: workspaceA,
      history: [rev('exp_1', 200, '后做的功能', 'pivot')],
    });
    writeBundle({
      sessionId: 's-early',
      workspaceRoot: workspaceA,
      history: [
        rev('exp_2', 50, '先做的功能', 'pivot'),
        rev('exp_1', 10, '更早的一步', 'pivot'),
      ],
    });

    const repo = new FileProjectEvolutionRepository({ wikiRoot });
    const project = repo.loadProjectEvolution({ workspaceRoot: workspaceA });

    expect(project.sessions.map((s) => s.sessionId)).toEqual(['s-early', 's-late']);
    // revisions sorted by `at` asc within a session
    expect(project.sessions[0].revisions.map((r) => r.at)).toEqual([10, 50]);
    expect(project.sessions[0].startedAt).toBe(10);
  });

  it('filters out sessions from a different workspace', () => {
    writeBundle({ sessionId: 's-a', workspaceRoot: workspaceA, history: [rev('e', 1, 'A', 'pivot')] });
    writeBundle({ sessionId: 's-b', workspaceRoot: workspaceB, history: [rev('e', 1, 'B', 'pivot')] });

    const repo = new FileProjectEvolutionRepository({ wikiRoot });
    const project = repo.loadProjectEvolution({ workspaceRoot: workspaceA });

    expect(project.sessions.map((s) => s.sessionId)).toEqual(['s-a']);
  });

  it('skips bundles with no intent history', () => {
    writeBundle({ sessionId: 's-empty', workspaceRoot: workspaceA, history: [] });
    writeBundle({ sessionId: 's-real', workspaceRoot: workspaceA, history: [rev('e', 1, 'X', 'pivot')] });

    const repo = new FileProjectEvolutionRepository({ wikiRoot });
    const project = repo.loadProjectEvolution({ workspaceRoot: workspaceA });

    expect(project.sessions.map((s) => s.sessionId)).toEqual(['s-real']);
  });

  it('extracts summaries and maps revision fields', () => {
    writeBundle({
      sessionId: 's1',
      workspaceRoot: workspaceA,
      history: [rev('exp_1', 1, '标题', 'refine', '一句话摘要')],
      summaries: { exp_1: '摘要正文' },
    });

    const repo = new FileProjectEvolutionRepository({ wikiRoot });
    const single = repo.loadSessionEvolution('s1');

    expect(single).not.toBeNull();
    expect(single!.revisions[0]).toMatchObject({
      explorationId: 'exp_1',
      nodeTitle: '标题',
      delta: 'refine',
      note: '一句话摘要',
    });
    expect(single!.summaries.exp_1).toBe('摘要正文');
    expect(single!.title).toBe('标题');
  });

  it('extracts per-exploration metrics (meta + retrieval/write) into metricsByExp', () => {
    writeBundle({
      sessionId: 's-metrics',
      workspaceRoot: workspaceA,
      history: [rev('exp_1', 1, '标题', 'pivot')],
      explorations: {
        exp_1: {
          meta: { status: 'interrupted', toolCount: 7, errorCount: 2, tokens: 120, files: ['a.ts', 'b.ts'], durationMs: 5000 },
          retrieval: true,
          write: 'saved',
        },
        // skipped write should NOT count as a write
        exp_2: { meta: { toolCount: 1 }, write: 'skipped' },
      },
    });

    const repo = new FileProjectEvolutionRepository({ wikiRoot });
    const single = repo.loadSessionEvolution('s-metrics');

    expect(single).not.toBeNull();
    const m1 = single!.metricsByExp.exp_1;
    expect(m1).toMatchObject({
      toolCount: 7, errorCount: 2, interrupted: true, tokens: 120, durationMs: 5000, retrieval: true, write: true,
    });
    expect(m1.files?.sort()).toEqual(['a.ts', 'b.ts']);
    expect(single!.metricsByExp.exp_2).toMatchObject({ toolCount: 1, write: false, retrieval: false });

    // P3: detailed knowledge inflow/outflow. exp_1 retrieved + saved; exp_2 skipped write excluded.
    expect(single!.retrievals).toHaveLength(1);
    expect(single!.retrievals[0]).toMatchObject({ explorationId: 'exp_1', type: 'context' });
    expect(single!.writes).toHaveLength(1);
    expect(single!.writes[0]).toMatchObject({ explorationId: 'exp_1', status: 'saved' });
  });

  it('returns null for unknown session', () => {
    const repo = new FileProjectEvolutionRepository({ wikiRoot });
    expect(repo.loadSessionEvolution('nope')).toBeNull();
  });
});
