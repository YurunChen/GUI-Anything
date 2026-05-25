/**
 * Shared JSON file I/O helpers used across data-layer repositories.
 */

import * as fs from 'node:fs';

export function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    // Corrupt file — caller decides cleanup.
    return Symbol.for('corrupted') as unknown as T;
  }
}

export function writeJsonFile(
  filePath: string,
  data: unknown,
  indent: number | string = 2,
): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, indent), 'utf-8');
}

export function deleteJsonFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  try {
    fs.rmSync(filePath, { force: true });
  } catch {
    // Ignore cleanup failures.
  }
}
