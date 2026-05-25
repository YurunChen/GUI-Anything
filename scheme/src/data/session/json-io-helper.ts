import * as fs from 'node:fs';

/** Attempt to read and parse a JSON file. Returns null if missing or corrupt. */
export function readJsonSafe<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}
