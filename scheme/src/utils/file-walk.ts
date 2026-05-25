import * as fs from 'node:fs';
import * as path from 'node:path';

/** Recursively collect .md file paths under `dir`, skipping index.md. */
export function walkMarkdownFiles(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'index.md') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMarkdownFiles(full, out);
    } else if (entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
}
