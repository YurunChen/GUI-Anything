import { describe, expect, test } from 'bun:test';
import {
  OBSERVER_MIN_TERMINAL_COLS,
  OBSERVER_MIN_TERMINAL_ROWS,
  isObserverTerminalTooSmall,
} from './flow-constants';

describe('isObserverTerminalTooSmall', () => {
  test('allows unknown terminal dimensions during startup', () => {
    expect(isObserverTerminalTooSmall(0, OBSERVER_MIN_TERMINAL_ROWS)).toBe(false);
    expect(isObserverTerminalTooSmall(OBSERVER_MIN_TERMINAL_COLS, 0)).toBe(false);
  });

  test('requires the observer minimum width and height', () => {
    expect(isObserverTerminalTooSmall(OBSERVER_MIN_TERMINAL_COLS, OBSERVER_MIN_TERMINAL_ROWS))
      .toBe(false);
    expect(isObserverTerminalTooSmall(OBSERVER_MIN_TERMINAL_COLS - 1, OBSERVER_MIN_TERMINAL_ROWS))
      .toBe(true);
    expect(isObserverTerminalTooSmall(OBSERVER_MIN_TERMINAL_COLS, OBSERVER_MIN_TERMINAL_ROWS - 1))
      .toBe(true);
  });
});
