/**
 * open-file.ts — open a local file with the OS default handler (browser for .html).
 */

import { execFileSync } from 'node:child_process';

export interface OpenCommand {
  command: string;
  args: string[];
}

/** Map platform → the command that opens a path with its default app. Pure (testable). */
export function resolveOpenCommand(platform: NodeJS.Platform, target: string): OpenCommand {
  if (platform === 'darwin') return { command: 'open', args: [target] };
  if (platform === 'win32') return { command: 'cmd', args: ['/c', 'start', '', target] };
  return { command: 'xdg-open', args: [target] };
}

/** Open `target` in the default OS handler. Returns false on failure (never throws). */
export function openPath(target: string): boolean {
  const { command, args } = resolveOpenCommand(process.platform, target);
  try {
    execFileSync(command, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
