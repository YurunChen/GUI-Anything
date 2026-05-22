/**
 * Claude Code project/session file discovery (data layer).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as child from 'node:child_process';
import { reportError } from '../../utils/observability';

function claudeHome(): string {
  const home = process.env.HOME;
  if (!home) throw new Error('HOME not set');
  return path.join(home, '.claude');
}

/**
 * Encode an absolute path into a Claude project directory name.
 */
export function encodePath(absPath: string): string {
  return absPath.replace(/\//g, '-').replace(/\./g, '-').replace(/_/g, '-');
}

export function resolveGitRoot(dir: string): string {
  try {
    const root = child.execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: dir, stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();
    return root || dir;
  } catch {
    return dir;
  }
}

export function projectDir(cwd: string): string {
  let resolved = cwd;
  try {
    resolved = fs.realpathSync(cwd);
  } catch {
    // use cwd as-is
  }
  resolved = resolveGitRoot(resolved);
  return path.join(claudeHome(), 'projects', encodePath(resolved));
}

export function listAllProjectDirs(): string[] {
  const dir = path.join(claudeHome(), 'projects');
  try {
    return fs.readdirSync(dir)
      .filter((name) => !name.startsWith('.'))
      .map((name) => path.join(dir, name));
  } catch {
    return [];
  }
}

interface SessionFile {
  path: string;
  mtimeMs: number;
  name: string;
}

function discoverSessions(projectDirPath: string): SessionFile[] {
  try {
    const entries = fs.readdirSync(projectDirPath, { withFileTypes: true });
    const sessions: SessionFile[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const name = entry.name;
      if (!name.endsWith('.jsonl')) continue;
      if (name.startsWith('agent_')) continue;
      const stat = fs.statSync(path.join(projectDirPath, name));
      sessions.push({ path: path.join(projectDirPath, name), mtimeMs: stat.mtimeMs, name });
    }
    return sessions.sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch {
    return [];
  }
}

export function findLatestSession(cwd: string): string | null {
  const sessionId = process.env.FLOW_SESSION_ID;

  if (sessionId) {
    const overrideDir = process.env.FLOW_PROJECT_DIR;
    const dirs: string[] = [];
    if (overrideDir) {
      try {
        const resolvedOverride = resolveGitRoot(fs.realpathSync(overrideDir));
        const encoded = encodePath(resolvedOverride);
        dirs.push(path.join(claudeHome(), 'projects', encoded));
      } catch (e) {
        reportError('io', 'failed to resolve FLOW_PROJECT_DIR override', {
          overrideDir,
          error: e instanceof Error ? e.message : String(e),
        });
        dirs.push(projectDir(cwd));
      }
    } else {
      dirs.push(projectDir(cwd));
    }
    const uniqueDirs = [...new Set(dirs)];
    for (const dir of uniqueDirs) {
      const sessionPath = path.join(dir, `${sessionId}.jsonl`);
      if (fs.existsSync(sessionPath)) return sessionPath;
    }
    return null;
  }

  const overrideDir = process.env.FLOW_PROJECT_DIR;
  if (overrideDir) {
    const resolvedOverride = resolveGitRoot(fs.realpathSync(overrideDir));
    const encoded = encodePath(resolvedOverride);
    const dir = path.join(claudeHome(), 'projects', encoded);
    const sessions = discoverSessions(dir);
    if (sessions.length > 0) return sessions[0].path;
  }

  const dir = projectDir(cwd);
  const sessions = discoverSessions(dir);
  if (sessions.length > 0) return sessions[0].path;

  return null;
}
