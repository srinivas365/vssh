import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PTY_COLS,
  DEFAULT_PTY_ROWS,
  debounce,
  getPreferredPtySize,
  rememberPtySize,
} from '../../src/renderer/components/Terminal/terminal-fit';

describe('terminal-fit', () => {
  afterEach(() => {
    rememberPtySize(DEFAULT_PTY_COLS, DEFAULT_PTY_ROWS);
  });

  it('returns default PTY size before any terminal has fitted', () => {
    expect(getPreferredPtySize()).toEqual({ cols: DEFAULT_PTY_COLS, rows: DEFAULT_PTY_ROWS });
  });

  it('remembers the last fitted terminal size for new sessions', () => {
    rememberPtySize(142, 38);
    expect(getPreferredPtySize()).toEqual({ cols: 142, rows: 38 });
  });

  it('ignores invalid remembered sizes', () => {
    rememberPtySize(142, 38);
    rememberPtySize(0, 0);
    expect(getPreferredPtySize()).toEqual({ cols: 142, rows: 38 });
  });

  it('debounces rapid calls', async () => {
    let count = 0;
    const fn = debounce(() => { count += 1; }, 20);
    fn();
    fn();
    fn();
    await new Promise((resolve) => setTimeout(resolve, 35));
    expect(count).toBe(1);
  });
});
