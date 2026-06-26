import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { FileWorkspaceTreeRepository } from './workspace-tree-repository';

describe('FileWorkspaceTreeRepository', () => {
  let tmpDir = '';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-workspace-tree-'));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('builds a bounded project tree snapshot', () => {
    fs.mkdirSync(path.join(tmpDir, 'scheme', 'src', 'app'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# readme');
    fs.writeFileSync(path.join(tmpDir, 'scheme', 'src', 'app', 'main.ts'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'pkg', 'index.js'), 'x');

    const snapshot = new FileWorkspaceTreeRepository().scan(tmpDir, {
      maxDepth: 3,
      maxNodes: 20,
    });

    expect(snapshot.rootPath).toBe(fs.realpathSync(tmpDir));
    expect(snapshot.nodes.map((node) => node.path)).toContain('README.md');
    expect(snapshot.nodes.map((node) => node.path)).toContain('scheme/src');
    expect(snapshot.nodes.map((node) => node.path)).not.toContain('scheme/src/app/main.ts');
    expect(snapshot.nodes.some((node) => node.path.startsWith('node_modules'))).toBe(false);
  });

  it('applies simple root gitignore rules', () => {
    fs.mkdirSync(path.join(tmpDir, 'logs'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'logs/\nsecret.txt\n');
    fs.writeFileSync(path.join(tmpDir, 'logs', 'app.log'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'secret.txt'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'src', 'ok.ts'), 'x');

    const snapshot = new FileWorkspaceTreeRepository().scan(tmpDir);
    const paths = snapshot.nodes.map((node) => node.path);

    expect(paths).toContain('src/ok.ts');
    expect(paths).not.toContain('logs');
    expect(paths).not.toContain('secret.txt');
  });
});

