/**
 * Shared JSON file I/O helpers used across data-layer repositories.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

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
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const payload = JSON.stringify(data, null, indent);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.tmp.${process.pid}`);
  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeFileSync(fd, payload, 'utf-8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, filePath);
}

export function deleteJsonFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  try {
    fs.rmSync(filePath, { force: true });
  } catch {
    // Ignore cleanup failures.
  }
}
