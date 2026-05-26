/**
 * Claude Code project/session file discovery (data layer).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as child from 'node:child_process';
import { reportError } from '../../utils/observability';

const PEEK_HEAD_BYTES = 8 * 1024;
const PEEK_TAIL_BYTES = 4 * 1024;

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

export function resolveProjectDirPath(cwd: string): string {
  const overrideDir = process.env.FLOW_PROJECT_DIR;
  if (overrideDir) {
    try {
      const resolvedOverride = resolveGitRoot(fs.realpathSync(overrideDir));
      return path.join(claudeHome(), 'projects', encodePath(resolvedOverride));
    } catch (e) {
      reportError('io', 'failed to resolve FLOW_PROJECT_DIR override', {
        overrideDir,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return projectDir(cwd);
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

export interface SessionFile {
  path: string;
  mtimeMs: number;
  name: string;
  sessionId: string;
}

export interface PeekSessionActivity {
  hasUserTurn: boolean;
  lineCount: number;
  sizeBytes: number;
}

export function sessionIdFromFilename(name: string): string {
  return name.replace(/\.jsonl$/, '');
}

/** Lightweight scan — first 8KB + tail 4KB only. */
export function peekSessionActivity(jsonlPath: string): PeekSessionActivity {
  let sizeBytes = 0;
  try {
    sizeBytes = fs.statSync(jsonlPath).size;
  } catch {
    return { hasUserTurn: false, lineCount: 0, sizeBytes: 0 };
  }
  if (sizeBytes === 0) {
    return { hasUserTurn: false, lineCount: 0, sizeBytes: 0 };
  }

  const chunks: string[] = [];
  const fd = fs.openSync(jsonlPath, 'r');
  try {
    const headLen = Math.min(PEEK_HEAD_BYTES, sizeBytes);
    const headBuf = new Uint8Array(headLen);
    fs.readSync(fd, headBuf, 0, headLen, 0);
    chunks.push(new TextDecoder().decode(headBuf));
    if (sizeBytes > PEEK_HEAD_BYTES) {
      const tailLen = Math.min(PEEK_TAIL_BYTES, sizeBytes);
      const tailBuf = new Uint8Array(tailLen);
      fs.readSync(fd, tailBuf, 0, tailLen, sizeBytes - tailLen);
      chunks.push(new TextDecoder().decode(tailBuf));
    }
  } finally {
    fs.closeSync(fd);
  }

  let lineCount = 0;
  let hasUserTurn = false;
  for (const chunk of chunks) {
    for (const line of chunk.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      lineCount += 1;
      try {
        const entry = JSON.parse(trimmed) as { type?: string };
        if (entry.type === 'user') {
          hasUserTurn = true;
        }
      } catch {
        // skip partial line fragments at chunk boundaries
      }
    }
  }
  return { hasUserTurn, lineCount, sizeBytes };
}

function discoverSessions(
  projectDirPath: string,
  options?: { includeEmpty?: boolean },
): SessionFile[] {
  const includeEmpty = options?.includeEmpty ?? false;
  try {
    const entries = fs.readdirSync(projectDirPath, { withFileTypes: true });
    const sessions: SessionFile[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const name = entry.name;
      if (!name.endsWith('.jsonl')) continue;
      if (name.startsWith('agent_')) continue;
      const fullPath = path.join(projectDirPath, name);
      if (!includeEmpty) {
        const activity = peekSessionActivity(fullPath);
        if (!activity.hasUserTurn) continue;
      }
      const stat = fs.statSync(fullPath);
      sessions.push({
        path: fullPath,
        mtimeMs: stat.mtimeMs,
        name,
        sessionId: sessionIdFromFilename(name),
      });
    }
    return sessions.sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch {
    return [];
  }
}

export function listSessionsForProject(cwd: string, options?: { includeEmpty?: boolean }): SessionFile[] {
  return discoverSessions(resolveProjectDirPath(cwd), options);
}

export function sessionExists(sessionId: string, cwd: string): boolean {
  const dir = resolveProjectDirPath(cwd);
  return fs.existsSync(path.join(dir, `${sessionId}.jsonl`));
}

export function sessionPathForId(sessionId: string, cwd: string): string | null {
  const fullPath = path.join(resolveProjectDirPath(cwd), `${sessionId}.jsonl`);
  return fs.existsSync(fullPath) ? fullPath : null;
}

export type SessionPrefixResolution =
  | { status: 'found'; sessionId: string; sessionPath: string }
  | { status: 'not_found' }
  | { status: 'ambiguous'; candidates: string[] };

export function resolveSessionByPrefix(prefix: string, cwd: string): SessionPrefixResolution {
  const normalized = prefix.trim().toLowerCase();
  if (!normalized) return { status: 'not_found' };
  const sessions = listSessionsForProject(cwd, { includeEmpty: true });
  const matches = sessions.filter((s) => s.sessionId.toLowerCase().startsWith(normalized));
  if (matches.length === 0) return { status: 'not_found' };
  if (matches.length > 1) {
    return { status: 'ambiguous', candidates: matches.map((m) => m.sessionId) };
  }
  return {
    status: 'found',
    sessionId: matches[0].sessionId,
    sessionPath: matches[0].path,
  };
}

export function snapshotSessionMtimes(cwd: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const session of listSessionsForProject(cwd)) {
    map.set(session.sessionId, session.mtimeMs);
  }
  return map;
}

export function findLatestSession(cwd: string): string | null {
  const sessionId = process.env.FLOW_SESSION_ID;

  if (sessionId) {
    const dirs: string[] = [];
    const overrideDir = process.env.FLOW_PROJECT_DIR;
    if (overrideDir) {
      try {
        const resolvedOverride = resolveGitRoot(fs.realpathSync(overrideDir));
        dirs.push(path.join(claudeHome(), 'projects', encodePath(resolvedOverride)));
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

  const sessions = discoverSessions(resolveProjectDirPath(cwd));
  if (sessions.length > 0) return sessions[0].path;

  return null;
}
