import { describe, expect, it, beforeEach, afterEach, spyOn } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { KnowledgeRepository } from '../../data/wiki/knowledge-repository';
import { resolveProjectTag } from '../../data/env';
import { WikiMaintenanceService } from './wiki-maintenance-service';
import type { Exploration } from '../../data/protocol/observer-protocol';
import { makeSessionScopedId } from '../../data/protocol/observer-protocol';
import * as wikiAgentRun from './wiki-agent/run';
import {
  ensureKnowledgeSourceMetadata,
  mergeKnowledgeContent,
  reconcileWikiDecision,
} from './wiki-agent/run';
import type { WikiAgentDecision } from './wiki-agent/schema';
import { validateWikiAgentDecision } from './wiki-agent/validate';

function writeC001(wikiRoot: string): void {
  const projTag = resolveProjectTag();
  const dir = path.join(wikiRoot, 'knowledge', 'contexts');
  fs.mkdirSync(dir, { recursive: true });
  const content = `---
id: "C001"
slug: "project-analysis"
request: "分析下当前的项目"
created: "2026-01-01T00:00:00.000Z"
updated: "2026-01-01T00:00:00.000Z"
version: 1
type: "context"
category: "contexts"
tags:
  - "${projTag}"
related: []
aliases: []
source:
  session_id: "old-session"
  exploration_id: "exp_old"
extraction_confidence: 0.8
status: "draft"
---
## 问题
分析下当前的项目

## 摘要
Initial overview.

## 解决方案
First pass analysis.
`;
  fs.writeFileSync(path.join(dir, 'C001-project-analysis.md'), content, 'utf-8');
}

describe('reconcileWikiDecision', () => {
  it('forces update when prior hit but agent said create', () => {
    const decision: WikiAgentDecision = {
      action: 'create',
      type: 'context',
      slug: 'dup',
      sections: { summary: 'a', solution: 'b' },
      related_ids: [],
      tags: [],
      reason: 'mistake',
    };
    const reconciled = reconcileWikiDecision(decision, {
      entry: {
        id: 'C001',
        slug: 'x',
        sessionId: 's',
        explorationId: 'e',
        type: 'context',
        request: 'q',
        content: '',
        confidence: 0.8,
        tags: [],
        createdAt: 0,
      },
      score: 0.9,
      matchedKeywords: [],
    });
    expect(reconciled.action).toBe('update');
    expect(reconciled.target_id).toBe('C001');
  });
});

describe('WikiMaintenanceService', () => {
  let tmpDir: string;
  let originalWikiDir: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-maint-'));
    originalWikiDir = process.env.FLOW_WIKI_DIR;
    process.env.FLOW_WIKI_DIR = tmpDir;
    writeC001(tmpDir);
  });

  afterEach(() => {
    if (originalWikiDir !== undefined) {
      process.env.FLOW_WIKI_DIR = originalWikiDir;
    } else {
      delete process.env.FLOW_WIKI_DIR;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns saved when agent wrote create on disk (no false dedup skip)', async () => {
    const repo = new KnowledgeRepository(tmpDir);
    const contextsDir = path.join(tmpDir, 'knowledge', 'contexts');
    fs.mkdirSync(contextsDir, { recursive: true });
    const agentFile = path.join(contextsDir, 'C002-flow-observer-architecture.md');
    fs.writeFileSync(agentFile, `---
id: C002
slug: flow-observer-architecture
request: "分析当前项目"
type: context
---
## 摘要
Agent wrote this on disk.
`, 'utf-8');

    const resolveSpy = spyOn(wikiAgentRun, 'resolveWikiDecisionAsync').mockResolvedValue({
      decision: {
        action: 'create',
        type: 'context',
        slug: 'flow-observer-architecture',
        sections: { summary: 'Agent summary', solution: 'Agent solution' },
        related_ids: [],
        tags: [],
        reason: 'agent_create',
      },
      source: 'skill',
      manifest: {
        action: 'create',
        files_written: ['knowledge/contexts/C002-flow-observer-architecture.md'],
        reason: 'agent_create',
      },
      agentWroteDisk: true,
    });

    const service = new WikiMaintenanceService(repo);
    const exploration = {
      id: 'exp_analyze',
      question: 'Record Flow Observer architecture note',
      status: 'complete' as const,
      nodes: [{ id: 'node_1', type: 'tool' as const, label: 'Read', timestamp: 1, status: 'ok' as const, phase: 'execute' as const, rawText: '', rawCommand: 'Read' }],
      startedAt: Date.now(),
      currentPhase: 'idle' as const,
      phaseSeen: { explore: true, execute: true, verify: false },
      errorCounts: { tool: 0, system: 0, result: 0 },
    } satisfies Exploration;

    const { result } = await service.maintainExploration({
      sessionId: 'session-flow',
      exploration,
      summaryItem: {
        id: 'session-flow:exp_analyze' as const,
        sessionId: 'session-flow',
        explorationId: 'exp_analyze',
        text: 'Flow Observer architecture summary.',
        status: 'ready' as const,
        source: 'ai' as const,
        persistMeta: { should_persist: true, type: 'context', confidence: 0.9 },
      },
    });

    expect(result.status).toBe('saved');
    expect(result.reason).toContain('C002');
    expect(fs.readFileSync(agentFile, 'utf-8')).toContain(`- "${resolveProjectTag()}"`);
    resolveSpy.mockRestore();
  });

  it('falls back to applyUpdate when agent claims write but disk unverified', async () => {
    const repo = new KnowledgeRepository(tmpDir);
    const saveSpy = spyOn(repo, 'save');
    const resolveSpy = spyOn(wikiAgentRun, 'resolveWikiDecisionAsync').mockResolvedValue({
      decision: {
        action: 'update',
        target_id: 'C001',
        type: 'context',
        slug: 'project-analysis',
        sections: { summary: 'Agent summary', solution: 'Agent solution' },
        related_ids: [],
        tags: [],
        reason: 'agent_update',
      },
      source: 'skill',
      manifest: {
        action: 'update',
        target_id: 'C001',
        files_written: ['knowledge/contexts/C001-ghost.md'],
        reason: 'phantom',
      },
      agentWroteDisk: false,
    });

    const service = new WikiMaintenanceService(repo);
    const exploration = {
      id: 'exp_agent',
      question: '分析下当前的项目',
      status: 'complete' as const,
      nodes: [],
      startedAt: Date.now(),
      currentPhase: 'idle' as const,
      phaseSeen: { explore: true, execute: false, verify: false },
      errorCounts: { tool: 0, system: 0, result: 0 },
    } satisfies Exploration;

    const { result } = await service.maintainExploration({
      sessionId: 'session-agent',
      exploration,
      summaryItem: {
        id: 'session-agent:exp_agent' as const,
        sessionId: 'session-agent',
        explorationId: 'exp_agent',
        text: 'Fallback path should merge into C001.',
        status: 'ready' as const,
        source: 'ai' as const,
        persistMeta: { should_persist: true, type: 'context', confidence: 0.9 },
      },
    });

    expect(result.status).toBe('updated');
    expect(saveSpy).toHaveBeenCalled();
    resolveSpy.mockRestore();
    saveSpy.mockRestore();
  });

  it('updates existing entry on prior hit instead of creating C002', async () => {
    const repo = new KnowledgeRepository(tmpDir);
    const service = new WikiMaintenanceService(repo);
    const resolveSpy = spyOn(wikiAgentRun, 'resolveWikiDecisionAsync').mockResolvedValue({
      decision: {
        action: 'update',
        target_id: 'C001',
        type: 'context',
        slug: 'project-analysis',
        sections: {
          summary: 'Second session adds Flow Observer wiki agent details.',
          solution: 'Wiki Agent maintains knowledge asynchronously.',
        },
        related_ids: [],
        tags: [],
        reason: 'prior_hit',
      },
      source: 'skill',
      manifest: null,
      agentWroteDisk: false,
    });

    const exploration = {
      id: 'exp_new',
      question: '分析下当前的项目',
      status: 'complete' as const,
      nodes: [],
      startedAt: Date.now(),
      currentPhase: 'idle' as const,
      phaseSeen: { explore: true, execute: false, verify: false },
      errorCounts: { tool: 0, system: 0, result: 0 },
    } satisfies Exploration;
    const summaryItem = {
      id: 'session-new:exp_new' as const,
      sessionId: 'session-new',
      explorationId: 'exp_new',
      text: 'Second session adds Flow Observer wiki agent details.',
      status: 'ready' as const,
      source: 'ai' as const,
      persistMeta: {
        should_persist: true,
        type: 'context' as const,
        confidence: 0.85,
        solution_detail: 'Wiki Agent maintains knowledge asynchronously.',
      },
    };

    const priorHit = service.findPriorHit(exploration, 'session-new');
    expect(priorHit?.entry.id).toBe('C001');

    const { result } = await service.maintainExploration({
      sessionId: 'session-new',
      exploration,
      summaryItem,
    });

    expect(result.status).toBe('updated');
    expect(result.reason).toContain('C001');

    const all = await repo.listAll();
    expect(all.length).toBe(1);
    expect(all[0].id).toBe('C001');
    expect(all[0].content).toContain('Wiki Agent');
    expect(all[0].content).toMatch(/version:\s*2/m);
    resolveSpy.mockRestore();
  });
});

describe('mergeKnowledgeContent', () => {
  it('increments version and appends solution section', () => {
    const existing = `---
id: "C001"
version: 1
updated: "2026-01-01T00:00:00.000Z"
---
## 解决方案
Old content.
`;
    const decision: WikiAgentDecision = {
      action: 'update',
      target_id: 'C001',
      type: 'context',
      slug: 'project-analysis',
      sections: { summary: 'New summary', solution: 'New facts' },
      related_ids: [],
      tags: [],
      reason: 'test',
    };
    const summary = {
      id: 'exp_2',
      request: '分析下当前的项目',
      summary: 'New summary',
      commands: [],
      files: [],
      nodes: [],
      result: 'success' as const,
      duration: 0,
      tokens: 0,
      sessionId: 's2',
    };
    const merged = mergeKnowledgeContent(existing, decision, summary);
    expect(merged).toMatch(/version:\s*2/m);
    expect(merged).toContain('New summary');
    expect(merged).toContain('exp_2');
    expect(merged).toContain(`- "${resolveProjectTag()}"`);
  });
});

describe('ensureKnowledgeSourceMetadata', () => {
  it('adds source and project scope to agent-written markdown', () => {
    const stamped = ensureKnowledgeSourceMetadata(`---
id: C002
slug: agent-page
request: "Agent page"
type: context
tags:
  []
---
## 摘要
Agent body.
`, 'session-1', 'exp-1');

    expect(stamped).toContain('session_id: "session-1"');
    expect(stamped).toContain('exploration_id: "exp-1"');
    expect(stamped).toContain(`- "${resolveProjectTag()}"`);
  });
});

describe('prior hit persist idempotency', () => {
  it('scoped id marks updated explorations', () => {
    const id = makeSessionScopedId('sess', 'exp_1');
    expect(id).toBe('sess:exp_1');
  });
});
