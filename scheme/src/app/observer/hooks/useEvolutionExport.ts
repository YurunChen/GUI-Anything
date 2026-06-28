import { useCallback, useEffect, useRef, useState } from 'react';

import { exportAndOpenEvolutionHtml } from '../../../services/evolution/evolution-export-service';
import { getObserverMessages } from '../../ui/i18n/observer-messages';

/**
 * Project-evolution HTML export, orchestrated for the live observer.
 * `h` (force=false): regenerate deterministic HTML, then open.
 * `r` (force=true): regenerate with AI enrichment, then open.
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

    inFlightRef.current = true;
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    setLastExportStatus(messages.exportInProgress);

    exportAndOpenEvolutionHtml(force === true ? 'ai' : 'deterministic')
      .then((result) => {
        if (result.status === 'opened') {
          flashStatus(messages.exportDone);
          return;
        }
        flashStatus(result.error ? `${messages.exportFailed}: ${result.error}` : messages.exportFailed);
      })
      .catch((error) => {
        const reason = error instanceof Error ? error.message : String(error);
        flashStatus(`${messages.exportFailed}: ${reason}`);
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }, [flashStatus, messages]);

  return { exportHtml, lastExportStatus };
}
