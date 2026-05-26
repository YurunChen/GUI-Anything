/**
 * Session bundle repository — wiki/sessions/{sessionId}/bundle.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ExplorationId, SessionId } from '../protocol/observer-protocol';
import { resolveWikiRoot } from '../env';
import { readJsonFile, writeJsonFile } from '../session/json-io';
import { resolveWorkspaceRootForCache, workspaceRootsMatch } from '../session/workspace-root';
import {
  createEmptyBundle,
  ensureExplorationRecord,
} from './session-bundle-mappers';
import type {
  BundleLoadResult,
  ExplorationCardRecord,
  SessionBundle,
} from './session-bundle-types';
import { SESSION_BUNDLE_SCHEMA_VERSION } from './session-bundle-types';
import {
  ensureDir,
  sessionBundlePath,
  sessionDir,
  wikiSessionsDir,
} from './wiki-data-layout';
import { createLogger } from '../../utils/logger';

const log = createLogger('bundle');

export interface SessionBundleRepository {
  load(sessionId: SessionId): SessionBundle | null;
  save(bundle: SessionBundle): void;
  patch(sessionId: SessionId, mutator: (bundle: SessionBundle) => void, jsonlPath?: string): SessionBundle;
  patchExploration(
    sessionId: SessionId,
    explorationId: ExplorationId,
    patch: Partial<ExplorationCardRecord> & { question?: string },
    jsonlPath?: string,
  ): SessionBundle;
  loadWithStatus(sessionId: SessionId, jsonlPath: string): BundleLoadResult;
  clear(sessionId: SessionId): void;
  ensure(sessionId: SessionId, jsonlPath: string): SessionBundle;
}

export interface SessionBundleRepositoryOptions {
  wikiRoot?: string;
}

const MAX_PATCH_RETRIES = 5;

function bundleFileMtime(bundlePath: string): number {
  return fs.existsSync(bundlePath) ? fs.statSync(bundlePath).mtimeMs : 0;
}

function normalizeBundle(raw: SessionBundle, sessionId: SessionId): SessionBundle | null {
  if (!raw || raw.schemaVersion !== SESSION_BUNDLE_SCHEMA_VERSION) return null;
  if (!raw.meta?.sessionId || raw.meta.sessionId !== sessionId) return null;
  if (!raw.session?.flow) return null;
  if (!raw.curation) {
    raw.curation = { openIntentKey: '', buckets: {}, evidence: {} };
  }
  if (!raw.explorations) raw.explorations = {};
  if (!raw.session.flow.flowchartHints) raw.session.flow.flowchartHints = {};
  if (!raw.session.flow.graphPatchLedger) raw.session.flow.graphPatchLedger = [];
  if (!raw.session.intent && raw.session.intent !== null) {
    raw.session.intent = null;
  }
  return raw;
}

export class FileSessionBundleRepository implements SessionBundleRepository {
  private readonly wikiRoot: string;

  constructor(options: SessionBundleRepositoryOptions = {}) {
    this.wikiRoot = options.wikiRoot ?? resolveWikiRoot();
  }

  private bundlePath(sessionId: SessionId): string {
    return sessionBundlePath(sessionId, this.wikiRoot);
  }

  load(sessionId: SessionId): SessionBundle | null {
    const raw = readJsonFile<SessionBundle>(this.bundlePath(sessionId));
    if (!raw || raw === (Symbol.for('corrupted') as unknown as SessionBundle)) {
      log.debug('bundle load failed', { sessionId, reason: 'missing_or_corrupted' });
      return null;
    }
    const bundle = normalizeBundle(raw, sessionId);
    if (!bundle) {
      log.warn('bundle load failed', { sessionId, reason: 'normalize_failed' });
    }
    return bundle;
  }

  save(bundle: SessionBundle): void {
    ensureDir(sessionDir(bundle.meta.sessionId, this.wikiRoot));
    bundle.meta.updatedAt = Date.now();
    writeJsonFile(this.bundlePath(bundle.meta.sessionId), bundle);
  }

  ensure(sessionId: SessionId, jsonlPath: string): SessionBundle {
    const existing = this.load(sessionId);
    if (existing) return existing;
    const jsonlMtime = fs.existsSync(jsonlPath) ? fs.statSync(jsonlPath).mtimeMs : Date.now();
    const bundle = createEmptyBundle({ sessionId, jsonlPath, jsonlMtime });
    this.save(bundle);
    return bundle;
  }

  patch(
    sessionId: SessionId,
    mutator: (bundle: SessionBundle) => void,
    jsonlPath?: string,
    attempt = 0,
  ): SessionBundle {
    const bundlePath = this.bundlePath(sessionId);
    const mtimeAtRead = bundleFileMtime(bundlePath);
    const path = jsonlPath || this.load(sessionId)?.meta.jsonlPath || '';
    const bundle = this.load(sessionId) ?? createEmptyBundle({
      sessionId,
      jsonlPath: path,
      jsonlMtime: path && fs.existsSync(path) ? fs.statSync(path).mtimeMs : Date.now(),
    });
    if (jsonlPath && fs.existsSync(jsonlPath)) {
      bundle.meta.jsonlPath = jsonlPath;
      bundle.meta.jsonlMtime = fs.statSync(jsonlPath).mtimeMs;
    }
    mutator(bundle);
    const mtimeBeforeSave = bundleFileMtime(bundlePath);
    if (mtimeBeforeSave > mtimeAtRead && attempt < MAX_PATCH_RETRIES) {
      return this.patch(sessionId, mutator, jsonlPath, attempt + 1);
    }
    this.save(bundle);
    log.debug('bundle patched', { sessionId, jsonlPath: path || undefined });
    return bundle;
  }

  patchExploration(
    sessionId: SessionId,
    explorationId: ExplorationId,
    patch: Partial<ExplorationCardRecord> & { question?: string },
    jsonlPath?: string,
  ): SessionBundle {
    return this.patch(sessionId, (bundle) => {
      const record = ensureExplorationRecord(
        bundle,
        explorationId,
        patch.question || bundle.explorations[explorationId]?.question || '',
      );
      if (patch.meta !== undefined) record.meta = patch.meta;
      if (patch.summary !== undefined) record.summary = patch.summary;
      if (patch.retrieval !== undefined) record.retrieval = patch.retrieval;
      if (patch.write !== undefined) record.write = patch.write;
      if (patch.question !== undefined) record.question = patch.question;
    }, jsonlPath);
  }

  loadWithStatus(sessionId: SessionId, jsonlPath: string): BundleLoadResult {
    const bundlePath = this.bundlePath(sessionId);
    const currentWorkspace = resolveWorkspaceRootForCache();

    if (!fs.existsSync(bundlePath)) {
      log.debug('bundle load status', { sessionId, status: 'miss', reason: 'bundle_not_found' });
      return { status: 'miss', bundle: null, reason: 'bundle_not_found' };
    }
    if (!fs.existsSync(jsonlPath)) {
      log.warn('bundle load status', { sessionId, status: 'miss', reason: 'jsonl_source_missing' });
      return { status: 'miss', bundle: null, reason: 'jsonl_source_missing' };
    }

    const currentJsonlMtime = fs.statSync(jsonlPath).mtimeMs;
    const raw = readJsonFile<SessionBundle>(bundlePath);
    if (!raw || raw === (Symbol.for('corrupted') as unknown as SessionBundle)) {
      log.warn('bundle load status', { sessionId, status: 'corrupted', reason: 'parse_error' });
      return { status: 'corrupted', bundle: null, reason: 'parse_error' };
    }

    const bundle = normalizeBundle(raw, sessionId);
    if (!bundle) {
      log.warn('bundle load status', { sessionId, status: 'corrupted', reason: 'schema_or_session_mismatch' });
      return { status: 'corrupted', bundle: null, reason: 'schema_or_session_mismatch' };
    }
    if (!bundle.meta.workspaceRoot) {
      log.warn('bundle load status', { sessionId, status: 'expired', reason: 'workspace_root_missing' });
      return { status: 'expired', bundle: null, reason: 'workspace_root_missing' };
    }
    if (!workspaceRootsMatch(bundle.meta.workspaceRoot, currentWorkspace)) {
      log.warn('bundle load status', { sessionId, status: 'corrupted', reason: 'workspace_mismatch' });
      return { status: 'corrupted', bundle: null, reason: 'workspace_mismatch' };
    }
    if (bundle.meta.jsonlMtime < currentJsonlMtime) {
      log.debug('bundle load status', { sessionId, status: 'stale', reason: 'jsonl_modified_since_bundle' });
      return {
        status: 'stale',
        bundle,
        reason: 'jsonl_modified_since_bundle',
      };
    }
    log.debug('bundle load status', {
      sessionId,
      status: 'hit',
      explorationCount: Object.keys(bundle.explorations).length,
    });
    return {
      status: 'hit',
      bundle,
      reason: `valid_bundle_${Object.keys(bundle.explorations).length}_explorations`,
    };
  }

  clear(sessionId: SessionId): void {
    const dir = sessionDir(sessionId, this.wikiRoot);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

let defaultRepo: FileSessionBundleRepository | null = null;

export function defaultSessionBundleRepository(): FileSessionBundleRepository {
  if (!defaultRepo) {
    defaultRepo = new FileSessionBundleRepository();
  }
  return defaultRepo;
}

export function clearAllSessionBundles(wikiRoot?: string): void {
  const dir = wikiSessionsDir(wikiRoot);
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name.startsWith('_')) continue;
    fs.rmSync(path.join(dir, ent.name), { recursive: true, force: true });
  }
}
