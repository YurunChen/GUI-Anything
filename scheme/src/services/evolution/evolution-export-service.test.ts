import { describe, expect, it } from 'bun:test';

import type { ExportEvolutionOptions } from '../../export/evolution/types';
import { exportAndOpenEvolutionHtml } from './evolution-export-service';

describe('exportAndOpenEvolutionHtml', () => {
  it('regenerates deterministic HTML before opening', async () => {
    const calls: string[] = [];
    const optionsSeen: ExportEvolutionOptions[] = [];

    const result = await exportAndOpenEvolutionHtml('deterministic', {
      exportPath: () => '/tmp/evolution.html',
      exportHtml: async (options) => {
        calls.push('export');
        optionsSeen.push(options);
        return options.outputPath ?? '';
      },
      openHtml: (path) => {
        calls.push(`open:${path}`);
        return true;
      },
    });

    expect(result).toEqual({ status: 'opened', path: '/tmp/evolution.html' });
    expect(calls).toEqual(['export', 'open:/tmp/evolution.html']);
    expect(optionsSeen).toEqual([
      { scope: 'project', outputPath: '/tmp/evolution.html', noAi: true },
    ]);
  });

  it('uses AI export for explicit regeneration', async () => {
    let noAi: boolean | undefined;

    await exportAndOpenEvolutionHtml('ai', {
      exportPath: () => '/tmp/evolution.html',
      exportHtml: async (options) => {
        noAi = options.noAi;
        return options.outputPath ?? '';
      },
      openHtml: () => true,
    });

    expect(noAi).toBe(false);
  });

  it('returns export errors without trying to open the file', async () => {
    let opened = false;

    const result = await exportAndOpenEvolutionHtml('deterministic', {
      exportPath: () => '/tmp/evolution.html',
      exportHtml: async () => {
        throw new Error('disk full');
      },
      openHtml: () => {
        opened = true;
        return true;
      },
    });

    expect(result).toEqual({
      status: 'failed',
      path: '/tmp/evolution.html',
      error: 'disk full',
    });
    expect(opened).toBe(false);
  });
});
