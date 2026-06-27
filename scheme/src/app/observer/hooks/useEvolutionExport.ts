import { useCallback, useEffect, useRef, useState } from 'react';
import * as fs from 'node:fs';

import { exportEvolutionToHtml } from '../../../export/evolution/export-evolution';
import { evolutionExportPath } from '../../../data/wiki/wiki-data-layout';
import { openPath } from '../../../services/flow/open-file';
import { getObserverMessages } from '../../ui/i18n/observer-messages';

/**
 * Project-evolution HTML export, orchestrated for the live observer.
 * `e` (force=false): open cached HTML if present, else generate (full AI) then open.
 * `Shift+E` (force=true): always regenerate, then open.
 */
export function useEvolutionExport(): {
  exportHtml: (force?: boolean) => void;
  lastExportStatus: string;
} {
  const [lastExportStatus, setLastExportStatus] = useState('');
  const inFlightRef = useRef(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messages = getObserverMessages();

  useEffect(() => () => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
  }, []);

  const flashStatus = useCallback((text: string) => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    setLastExportStatus(text);
    clearTimerRef.current = setTimeout(() => {
      setLastExportStatus('');
      clearTimerRef.current = null;
    }, 3000);
  }, []);

  const exportHtml = useCallback((force?: boolean) => {
    if (inFlightRef.current) return;
    const cachePath = evolutionExportPath();

    if (force !== true && fs.existsSync(cachePath)) {
      flashStatus(openPath(cachePath) ? messages.exportOpened : messages.exportFailed);
      return;
    }

    inFlightRef.current = true;
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    setLastExportStatus(messages.exportInProgress);

    exportEvolutionToHtml({ scope: 'project', outputPath: cachePath })
      .then(() => {
        flashStatus(openPath(cachePath) ? messages.exportDone : messages.exportFailed);
      })
      .catch(() => {
        flashStatus(messages.exportNoData);
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }, [flashStatus, messages]);

  return { exportHtml, lastExportStatus };
}
