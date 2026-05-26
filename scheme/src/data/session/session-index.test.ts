import { afterEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { FileSessionBundleRepository } from '../wiki/session-bundle-repository';
import { createEmptyBundle } from '../wiki/session-bundle-mappers';
import { projectDir } from './claude-project';
import { resolveWorkspaceRootForCache } from './workspace-root';
import {
  matchIndexForWorkspace,
  readSessionIndex,
  resolveLastSessionId,
  touchLastSession,
} from './session-index';
import { workspaceRootsMatch } from './workspace-root';
import { sessionBundlePath, sessionIndexPath, wikiSessionsDir } from '../wiki/wiki-data-layout';

describe('session-index', () => {
  let tmpDir = '';

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = '';
    }
    delete process.env.FLOW_ROOT_DIR;
    delete process.env.FLOW_WIKI_DIR;
    delete process.env.FLOW_PROJECT_DIR;
    if (process.env.HOME?.includes(os.tmpdir())) {
      delete process.env.HOME;
    }
  });

  it('writes and reads index for workspace', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-index-'));
    process.env.FLOW_WIKI_DIR = path.join(tmpDir, 'wiki');
    const workspace = path.join(tmpDir, 'repo');
    fs.mkdirSync(workspace, { recursive: true });
    fs.mkdirSync(path.join(workspace, '.git'));

    touchLastSession({ sessionId: 'abc-123', cwd: workspace });
    expect(fs.existsSync(sessionIndexPath())).toBe(true);

    const loaded = readSessionIndex();
    expect(loaded?.lastSessionId).toBe('abc-123');
    expect(workspaceRootsMatch(loaded!.workspaceRoot, workspace)).toBe(true);
  });

  it('matchIndexForWorkspace returns null when session jsonl missing', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-index-'));
    process.env.FLOW_WIKI_DIR = path.join(tmpDir, 'wiki');
    const workspace = path.join(tmpDir, 'repo');
    fs.mkdirSync(workspace, { recursive: true });
    fs.mkdirSync(path.join(workspace, '.git'));

    touchLastSession({ sessionId: 'missing-id', cwd: workspace });
    expect(matchIndexForWorkspace(workspace)).toBeNull();
  });

  it('resolveLastSessionId falls back to latest Claude jsonl when no index or bundle', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-index-jsonl-'));
    const home = path.join(tmpDir, 'home');
    fs.mkdirSync(home, { recursive: true });
    const prevHome = process.env.HOME;
    process.env.HOME = home;
    process.env.FLOW_WIKI_DIR = path.join(tmpDir, 'wiki');
    process.env.FLOW_PROJECT_DIR = path.join(tmpDir, 'repo');
    const workspace = process.env.FLOW_PROJECT_DIR;
    fs.mkdirSync(workspace, { recursive: true });
    fs.mkdirSync(path.join(workspace, '.git'));

    const sessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const dir = projectDir(workspace);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${sessionId}.jsonl`),
      '{"type":"user","message":{"content":"hello"}}\n',
    );

    expect(resolveLastSessionId(workspace)).toBe(sessionId);

    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
  });
});

describe('session-bundle-repository', () => {
  let tmpDir = '';

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = '';
    }
    delete process.env.FLOW_ROOT_DIR;
    delete process.env.FLOW_WIKI_DIR;
  });

  it('patchExploration persists summary', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-bundle-'));
    process.env.FLOW_WIKI_DIR = path.join(tmpDir, 'wiki');
    const wikiRoot = path.join(tmpDir, 'wiki');
    fs.mkdirSync(wikiRoot, { recursive: true });
    const jsonlPath = path.join(tmpDir, 'session.jsonl');
    fs.writeFileSync(jsonlPath, '{}');

    const repo = new FileSessionBundleRepository({ wikiRoot });
    repo.patchExploration('sess-1', 'exp-1', {
      question: 'test question',
      summary: {
        text: 'hello',
        source: 'ai',
        status: 'ready',
        savedAt: Date.now(),
      },
    }, jsonlPath);

    const loaded = repo.load('sess-1');
    expect(loaded?.explorations['exp-1']?.summary?.text).toBe('hello');
    expect(fs.existsSync(sessionBundlePath('sess-1', wikiRoot))).toBe(true);
  });

  it('loadWithStatus returns stale when jsonl mtime grows', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-bundle-'));
    process.env.FLOW_WIKI_DIR = path.join(tmpDir, 'wiki');
    process.env.FLOW_ROOT_DIR = tmpDir;
    fs.mkdirSync(path.join(tmpDir, '.git'));
    const wikiRoot = path.join(tmpDir, 'wiki');
    fs.mkdirSync(wikiRoot, { recursive: true });
    const jsonlPath = path.join(tmpDir, 'session.jsonl');
    fs.writeFileSync(jsonlPath, '{}');

    const repo = new FileSessionBundleRepository({ wikiRoot });
    const bundle = createEmptyBundle({
      sessionId: 'sess-1',
      jsonlPath,
      jsonlMtime: 100,
      workspaceRoot: resolveWorkspaceRootForCache(tmpDir),
    });
    bundle.explorations['exp-1'] = {
      explorationId: 'exp-1',
      question: 'q',
      summary: { text: 'cached', source: 'ai', status: 'ready', savedAt: 1 },
      retrieval: null,
      write: null,
    };
    repo.save(bundle);

    fs.utimesSync(jsonlPath, new Date(200), new Date(200));
    const result = repo.loadWithStatus('sess-1', jsonlPath);
    expect(result.status).toBe('stale');
    expect(result.bundle?.explorations['exp-1']?.summary?.text).toBe('cached');
  });

  it('persists retrieval snapshot with origin retrieved', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-bundle-retrieval-'));
    process.env.FLOW_WIKI_DIR = path.join(tmpDir, 'wiki');
    const wikiRoot = path.join(tmpDir, 'wiki');
    fs.mkdirSync(wikiRoot, { recursive: true });
    const jsonlPath = path.join(tmpDir, 'session.jsonl');
    fs.writeFileSync(jsonlPath, '{}');

    const repo = new FileSessionBundleRepository({ wikiRoot });
    repo.patchExploration('sess-1', 'exp-1', {
      question: 'test question',
      retrieval: {
        origin: 'retrieved',
        entryId: 'C001',
        relativePath: 'knowledge/contexts/project_design/C001-slug.md',
        type: 'context',
        slug: 'slug',
        request: 'q',
        excerpt: 'prior knowledge',
        tags: [],
        score: 1,
        matchedKeywords: ['design'],
        capturedAt: Date.now(),
      },
    }, jsonlPath);

    const loaded = repo.load('sess-1');
    expect(loaded?.explorations['exp-1']?.retrieval?.origin).toBe('retrieved');
    expect(loaded?.explorations['exp-1']?.retrieval?.excerpt).toBe('prior knowledge');
  });

  it('sequential patches keep all exploration cards', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-bundle-seq-'));
    process.env.FLOW_WIKI_DIR = path.join(tmpDir, 'wiki');
    const wikiRoot = path.join(tmpDir, 'wiki');
    fs.mkdirSync(wikiRoot, { recursive: true });
    const jsonlPath = path.join(tmpDir, 'session.jsonl');
    fs.writeFileSync(jsonlPath, '{}');

    const repo = new FileSessionBundleRepository({ wikiRoot });
    const card = { text: 'x', source: 'ai' as const, status: 'ready' as const, savedAt: 1 };
    repo.patchExploration('sess-1', 'exp-a', { question: 'a', summary: { ...card, text: 'a' } }, jsonlPath);
    repo.patchExploration('sess-1', 'exp-b', { question: 'b', summary: { ...card, text: 'b' } }, jsonlPath);

    const loaded = repo.load('sess-1');
    expect(loaded?.explorations['exp-a']?.summary?.text).toBe('a');
    expect(loaded?.explorations['exp-b']?.summary?.text).toBe('b');
  });
});
