import { describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { maintenanceReportHasWork } from './wiki-maintenance-report';
import type { WikiMaintenanceReport } from './wiki-maintenance-report';
import { resolveWikiAgentAddDirs, resolveProjectRoot } from './wiki-claude-context';

describe('maintenanceReportHasWork', () => {
  const base: WikiMaintenanceReport = {
    generatedAt: '',
    wikiRoot: '/tmp/wiki',
    openAudits: [],
    lint: { issues: [], errorCount: 0, warnCount: 0 },
    flatContextFiles: [],
    intentBuckets: [],
    summaryText: '',
  };

  it('returns false when report is clean', () => {
    expect(maintenanceReportHasWork(base)).toBe(false);
  });

  it('returns true for open audits', () => {
    expect(maintenanceReportHasWork({
      ...base,
      openAudits: [{
        fileName: 'a.md',
        filePath: '/tmp/a.md',
        targetId: 'C001',
        severity: 'high',
        status: 'open',
      }],
    })).toBe(true);
  });

  it('returns true for lint errors', () => {
    expect(maintenanceReportHasWork({
      ...base,
      lint: { issues: [], errorCount: 1, warnCount: 0 },
    })).toBe(true);
  });
});

describe('resolveWikiAgentAddDirs', () => {
  it('includes project root for .claude/skills discovery', () => {
    const root = resolveProjectRoot();
    const dirs = resolveWikiAgentAddDirs(path.join(root, 'wiki'));
    expect(dirs).toContain(root);
    expect(
      fs.existsSync(path.join(root, '.claude', 'skills', 'llm-wiki'))
        || fs.existsSync(path.join(root, 'skills', 'llm-wiki', 'SKILL.md')),
    ).toBe(true);
  });
});
