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
    fs.mkdirSync(path.join(tempDir, 'wiki', 'knowledge-base'), { recursive: true });
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
    const summary: ExplorationSummary = {
      id: 'exp_1',
      request: "'/Users/yurunchen/project/Method/GUI-Anything/scheme/POCKETFLOW_INTEGRATION_PLAN.md'看下这个方案可行吗",
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

    expect(entry?.slug).toBe('pocketflow-integration-plan-review');
    expect(entry?.slug).not.toContain('usersyurunchen');
    expect(entry?.slug).not.toContain('projectmethod');
  });
});
