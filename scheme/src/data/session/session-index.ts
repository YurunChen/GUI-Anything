/**
 * Session index — wiki/sessions/_index.json (continue pointer + registry)
 */

import * as path from 'node:path';

import type { SessionId } from '../protocol/observer-protocol';
import { readJsonFile, writeJsonFile } from './json-io';
import { findLatestSession, sessionExists, sessionIdFromFilename } from './claude-project';
import { resolveWorkspaceRootForCache, workspaceRootsMatch } from './workspace-root';
import { defaultSessionBundleRepository } from '../wiki/session-bundle-repository';
import type { SessionIndex } from '../wiki/session-bundle-types';
import { SESSION_INDEX_SCHEMA_VERSION } from '../wiki/session-bundle-types';
import {
  ensureDir,
  listSessionBundleIds,
  sessionIndexPath,
  wikiSessionsDir,
} from '../wiki/wiki-data-layout';

function resolveWorkspaceRoot(cwd: string): string {
  return resolveWorkspaceRootForCache(cwd);
}

export { workspaceRootsMatch } from './workspace-root';
export type { SessionIndex } from '../wiki/session-bundle-types';

export function readSessionIndex(wikiRoot?: string): SessionIndex | null {
  const raw = readJsonFile<SessionIndex>(sessionIndexPath(wikiRoot));
  if (!raw || raw === (Symbol.for('corrupted') as unknown as SessionIndex)) {
    return null;
  }
  if (raw.schemaVersion !== SESSION_INDEX_SCHEMA_VERSION) return null;
  if (!raw.workspaceRoot) return null;
  return raw;
}

export function writeSessionIndex(index: SessionIndex, wikiRoot?: string): void {
  ensureDir(wikiSessionsDir(wikiRoot));
  writeJsonFile(sessionIndexPath(wikiRoot), index);
}

export function touchLastSession(input: {
  sessionId: SessionId;
  cwd: string;
  jsonlMtime?: number;
  bundleUpdatedAt?: number;
  wikiRoot?: string;
}): SessionIndex {
  const workspaceRoot = resolveWorkspaceRoot(input.cwd);
  const now = Date.now();
  const existing = readSessionIndex(input.wikiRoot);
  const index: SessionIndex = existing && workspaceRootsMatch(existing.workspaceRoot, workspaceRoot)
    ? { ...existing }
    : {
        schemaVersion: SESSION_INDEX_SCHEMA_VERSION,
        workspaceRoot,
        lastSessionId: null,
        updatedAt: now,
        sessions: {},
      };

  index.workspaceRoot = workspaceRoot;
  index.lastSessionId = input.sessionId;
  index.updatedAt = now;
  index.sessions[input.sessionId] = {
    jsonlMtime: input.jsonlMtime ?? index.sessions[input.sessionId]?.jsonlMtime ?? 0,
    bundleUpdatedAt: input.bundleUpdatedAt ?? now,
  };
  writeSessionIndex(index, input.wikiRoot);
  return index;
}

export function matchIndexForWorkspace(
  workspaceCwd: string,
  wikiRoot?: string,
): SessionIndex | null {
  const index = readSessionIndex(wikiRoot);
  if (!index) return null;
  if (!workspaceRootsMatch(index.workspaceRoot, workspaceCwd)) {
    return null;
  }
  if (!index.lastSessionId) return null;
  if (!sessionExists(index.lastSessionId, workspaceCwd)) {
    return null;
  }
  return index;
}

export function resolveLastSessionId(
  workspaceCwd: string,
  wikiRoot?: string,
): SessionId | null {
  const index = matchIndexForWorkspace(workspaceCwd, wikiRoot);
  if (index?.lastSessionId) return index.lastSessionId;

  const workspaceRoot = resolveWorkspaceRoot(workspaceCwd);
  let best: { sessionId: SessionId; score: number } | null = null;
  const repo = defaultSessionBundleRepository();

  for (const sessionId of listSessionBundleIds(wikiRoot)) {
    const bundle = repo.load(sessionId);
    if (!bundle) continue;
    if (!workspaceRootsMatch(bundle.meta.workspaceRoot, workspaceRoot)) continue;
    if (!sessionExists(sessionId, workspaceCwd)) continue;
    const score = bundle.meta.updatedAt;
    if (!best || score > best.score) {
      best = { sessionId, score };
    }
  }

  if (best?.sessionId) return best.sessionId;

  const latestPath = findLatestSession(workspaceCwd);
  if (!latestPath) return null;
  const sessionId = sessionIdFromFilename(path.basename(latestPath));
  if (!sessionExists(sessionId, workspaceCwd)) return null;
  return sessionId;
}

/** @deprecated alias for matchIndexForWorkspace — used by session-discovery */
export function matchManifestForWorkspace(
  workspaceCwd: string,
  _flowDataDir?: string,
): { sessionId: SessionId; workspaceRoot: string } | null {
  void _flowDataDir;
  const index = matchIndexForWorkspace(workspaceCwd);
  if (!index?.lastSessionId) return null;
  return {
    sessionId: index.lastSessionId,
    workspaceRoot: index.workspaceRoot,
  };
}

export function writeManifest(input: {
  sessionId: SessionId;
  cwd: string;
  flowDataDir?: string;
  wikiRoot?: string;
}): SessionIndex {
  void input.flowDataDir;
  let jsonlMtime = 0;
  try {
    const bundle = defaultSessionBundleRepository().load(input.sessionId);
    jsonlMtime = bundle?.meta.jsonlMtime ?? 0;
  } catch {
    // ignore
  }
  return touchLastSession({
    sessionId: input.sessionId,
    cwd: input.cwd,
    jsonlMtime,
    wikiRoot: input.wikiRoot,
  });
}

export function readManifest(_flowDataDir?: string): null {
  void _flowDataDir;
  return null;
}

export function manifestPath(_flowDataDir?: string): string {
  void _flowDataDir;
  return sessionIndexPath();
}

export type LastSessionManifest = {
  schemaVersion: 1;
  sessionId: SessionId;
  workspaceRoot: string;
  projectEncoded: string;
  updatedAt: string;
};

export const LAST_SESSION_MANIFEST_VERSION = 1 as const;
