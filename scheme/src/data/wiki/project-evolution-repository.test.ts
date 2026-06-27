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

function writeBundle(input: {
  sessionId: string;
  workspaceRoot: string;
  history: IntentTitleRevision[];
  summaries?: Record<string, string>;
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

  it('returns null for unknown session', () => {
    const repo = new FileProjectEvolutionRepository({ wikiRoot });
    expect(repo.loadSessionEvolution('nope')).toBeNull();
  });
});
