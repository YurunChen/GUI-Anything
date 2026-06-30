import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractWikiEntry, type ExplorationSummary } from './auto-extractor';

describe('auto-extractor slug generation', () => {
  let tempDir: string;
  let originalFlowProjectDir: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-extractor-test-'));
    fs.mkdirSync(path.join(tempDir, 'wiki', 'knowledge'), { recursive: true });
    originalFlowProjectDir = process.env.FLOW_PROJECT_DIR;
    process.env.FLOW_PROJECT_DIR = tempDir;
  });

  afterEach(() => {
    if (originalFlowProjectDir !== undefined) {
      process.env.FLOW_PROJECT_DIR = originalFlowProjectDir;
    } else {
      delete process.env.FLOW_PROJECT_DIR;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('uses document basename and intent instead of absolute path for slug', () => {
    const planPath = path.join(tempDir, 'scheme', 'POCKETFLOW_INTEGRATION_PLAN.md');
    const summary: ExplorationSummary = {
      id: 'exp_1',
      request: `'${planPath}'看下这个方案可行吗`,
      summary: '评审 Pocket Flow 极简集成计划，确认方案方向可行并记录架构决策。',
      commands: [],
      files: [],
      result: 'success',
      duration: 0,
      tokens: 0,
      sessionId: 'session-a',
      persistMeta: {
        should_persist: true,
        type: 'decision',
        confidence: 0.85,
        tags: ['Pocket Flow', 'Pipeline', '架构决策'],
      },
    };

    const entry = extractWikiEntry(summary);

    expect(entry?.type).toBe('context');
    expect(entry?.facet).toBe('protocol');
    expect(String(entry?.content)).toContain('category: "contexts"');
    expect(entry?.slug).toBe('pocketflow-integration-plan-review');
    expect(entry?.slug).not.toContain(path.basename(tempDir).replace(/[^a-z0-9]/gi, '').toLowerCase());
  });

  it('includes proj tag in generated wiki frontmatter', () => {
    const summary: ExplorationSummary = {
      id: 'exp_2',
      request: '分析下当前的项目',
      summary: '项目概览摘要：双终端 Flow Observer 用于观察 Claude Code 会话流程。',
      commands: [],
      files: ['README.md'],
      result: 'success',
      duration: 0,
      tokens: 0,
      sessionId: 'session-b',
      persistMeta: {
        should_persist: true,
        type: 'context',
        confidence: 0.85,
        tags: ['project-overview'],
      },
    };

    const entry = extractWikiEntry(summary);
    expect(entry).not.toBeNull();
    expect(String(entry?.content)).toContain('proj:');
    expect(String(entry?.content)).toContain('project-overview');
  });

  it('allocates next id when entries live in type subdirectories', () => {
    const contextsDir = path.join(tempDir, 'wiki', 'knowledge', 'contexts');
    fs.mkdirSync(contextsDir, { recursive: true });
    fs.writeFileSync(
      path.join(contextsDir, 'C001-existing-entry.md'),
      '---\nid: C001\n---\n',
      'utf-8',
    );

    const summary: ExplorationSummary = {
      id: 'exp_3',
      request: '分析 codewhale 项目',
      summary: 'CodeWhale 是一个 Rust TUI 编码代理，采用多 crate workspace 架构。',
      commands: ['ls'],
      files: ['Cargo.toml'],
      result: 'success',
      duration: 0,
      tokens: 0,
      sessionId: 'session-c',
      persistMeta: {
        should_persist: true,
        type: 'context',
        confidence: 0.9,
        tags: ['codewhale'],
      },
    };

    const entry = extractWikiEntry(summary);
    expect(entry?.id).toBe('C002');
  });
});
