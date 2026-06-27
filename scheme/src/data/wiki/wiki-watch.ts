/**
 * Filesystem watch over wiki/sessions/ — fires a debounced callback whenever a
 * bundle is written/updated, so callers (e.g. the evolution HTML export) can
 * re-render on live capture. File IO stays in data/** per the layering red line.
 */

import * as fs from 'node:fs';

import { ensureDir, wikiSessionsDir } from './wiki-data-layout';

export interface WatchHandle {
  close(): void;
}

export function watchSessionsDir(
  onChange: () => void,
  opts: { wikiRoot?: string; debounceMs?: number } = {},
): WatchHandle {
  const dir = wikiSessionsDir(opts.wikiRoot);
  ensureDir(dir);
  const debounceMs = opts.debounceMs ?? 800;

  let timer: ReturnType<typeof setTimeout> | null = null;
  const fire = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, debounceMs);
  };

  const watcher = fs.watch(dir, { recursive: true }, () => fire());

  return {
    close() {
      if (timer) clearTimeout(timer);
      watcher.close();
    },
  };
}
