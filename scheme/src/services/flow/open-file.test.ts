import { describe, expect, test } from 'bun:test';
import { resolveOpenCommand } from './open-file';

describe('resolveOpenCommand', () => {
  test('darwin uses open', () => {
    expect(resolveOpenCommand('darwin', '/tmp/x.html')).toEqual({
      command: 'open',
      args: ['/tmp/x.html'],
    });
  });

  test('win32 uses cmd start with empty title arg', () => {
    expect(resolveOpenCommand('win32', 'C:\\x.html')).toEqual({
      command: 'cmd',
      args: ['/c', 'start', '', 'C:\\x.html'],
    });
  });

  test('linux/other falls back to xdg-open', () => {
    expect(resolveOpenCommand('linux', '/tmp/x.html')).toEqual({
      command: 'xdg-open',
      args: ['/tmp/x.html'],
    });
  });
});
