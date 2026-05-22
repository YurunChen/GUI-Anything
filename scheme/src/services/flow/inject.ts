/**
 * Flow text injection — clipboard-first (Zellij flow sessions).
 */

import { execSync } from 'node:child_process';

export type InjectBackend = 'clipboard' | 'none';

export function detectInjectBackend(): InjectBackend {
  const envBackend = process.env.FLOW_INJECT_BACKEND as InjectBackend | undefined;
  if (envBackend === 'none') return 'none';
  if (envBackend === 'clipboard' && isClipboardAvailable()) return 'clipboard';
  if (isClipboardAvailable()) return 'clipboard';
  return 'none';
}

function isClipboardAvailable(): boolean {
  try {
    execSync('which pbcopy', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function injectToClaude(text: string, backend?: InjectBackend): { success: boolean; method: string } {
  const selectedBackend = backend || detectInjectBackend();

  if (selectedBackend === 'clipboard') {
    try {
      execSync(`echo ${shellSingleQuote(text)} | pbcopy`);
      return { success: true, method: 'clipboard' };
    } catch {
      return { success: false, method: 'none' };
    }
  }

  return { success: false, method: 'none' };
}
