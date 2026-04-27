/**
 * Flow text injection backends
 * Supports tmux direct send and clipboard fallback
 * Contract: UI calls inject(), implementation handles backend selection
 */

import { execSync } from 'node:child_process';

export type InjectBackend = 'tmux' | 'clipboard' | 'none';

/**
 * Detect available inject backend based on environment
 * Priority: FLOW_INJECT_BACKEND env var > auto-detection
 */
export function detectInjectBackend(): InjectBackend {
  // Allow explicit override via environment variable
  const envBackend = process.env.FLOW_INJECT_BACKEND as InjectBackend | undefined;
  if (envBackend && ['tmux', 'clipboard', 'none'].includes(envBackend)) {
    // Validate the backend is actually available
    if (envBackend === 'tmux' && isTmuxAvailable()) return 'tmux';
    if (envBackend === 'clipboard' && isClipboardAvailable()) return 'clipboard';
    if (envBackend === 'none') return 'none';
  }
  
  // Check if we're in a tmux environment with FLOW_TMUX_SESSION
  const tmuxSession = process.env.FLOW_TMUX_SESSION;
  if (tmuxSession && isTmuxAvailable()) {
    return 'tmux';
  }
  
  // Check for clipboard availability (macOS pbcopy)
  if (isClipboardAvailable()) {
    return 'clipboard';
  }
  
  return 'none';
}

function isTmuxAvailable(): boolean {
  try {
    execSync('which tmux', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
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

/**
 * Inject text to Claude input using configured backend
 * @returns success status and method used
 */
export function injectToClaude(text: string, backend?: InjectBackend): { success: boolean; method: string } {
  const selectedBackend = backend || detectInjectBackend();
  
  switch (selectedBackend) {
    case 'tmux': {
      const tmuxSession = process.env.FLOW_TMUX_SESSION || 'flow-main';
      try {
        execSync(`tmux send-keys -t ${tmuxSession}:0.0 ${shellSingleQuote(text)} Enter`);
        return { success: true, method: 'tmux' };
      } catch {
        // Fall through to clipboard
      }
      // Tmux failed, try clipboard
      try {
        execSync(`echo ${shellSingleQuote(text)} | pbcopy`);
        return { success: true, method: 'clipboard (fallback)' };
      } catch {
        return { success: false, method: 'none' };
      }
    }
    
    case 'clipboard': {
      try {
        execSync(`echo ${shellSingleQuote(text)} | pbcopy`);
        return { success: true, method: 'clipboard' };
      } catch {
        return { success: false, method: 'none' };
      }
    }
    
    case 'none':
    default:
      return { success: false, method: 'none' };
  }
}

/**
 * Copy text to clipboard only (no injection)
 */
export function copyToClipboard(text: string): boolean {
  try {
    execSync(`echo ${shellSingleQuote(text)} | pbcopy`);
    return true;
  } catch {
    return false;
  }
}
