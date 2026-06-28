import { evolutionExportPath } from '../../data/wiki/wiki-data-layout';
import { exportEvolutionToHtml } from '../../export/evolution/export-evolution';
import type { ExportEvolutionOptions } from '../../export/evolution/types';
import { openPath } from '../flow/open-file';

export type EvolutionExportMode = 'deterministic' | 'ai';

export type EvolutionExportOpenResult = {
  status: 'opened' | 'failed';
  path: string;
  error?: string;
};

type ExportHtml = (options: ExportEvolutionOptions) => Promise<string>;
type OpenHtml = (path: string) => boolean;

interface EvolutionExportServiceDeps {
  exportHtml?: ExportHtml;
  exportPath?: () => string;
  openHtml?: OpenHtml;
}

export async function exportAndOpenEvolutionHtml(
  mode: EvolutionExportMode,
  deps: EvolutionExportServiceDeps = {}
): Promise<EvolutionExportOpenResult> {
  const outputPath = (deps.exportPath ?? evolutionExportPath)();
  const exportHtml = deps.exportHtml ?? exportEvolutionToHtml;
  const openHtml = deps.openHtml ?? openPath;

  try {
    await exportHtml({
      scope: 'project',
      outputPath,
      noAi: mode === 'deterministic',
    });
  } catch (error) {
    return {
      status: 'failed',
      path: outputPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (!openHtml(outputPath)) {
    return {
      status: 'failed',
      path: outputPath,
      error: 'Unable to open exported HTML',
    };
  }

  return { status: 'opened', path: outputPath };
}
