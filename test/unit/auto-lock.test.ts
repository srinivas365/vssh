import { describe, expect, it } from 'vitest';
import { shouldIdleAutoLock } from '../../src/main/auto-lock';

describe('shouldIdleAutoLock', () => {
  it('locks after the configured idle minutes', () => {
    expect(shouldIdleAutoLock(15 * 60, 15)).toBe(true);
    expect(shouldIdleAutoLock(15 * 60 - 1, 15)).toBe(false);
  });

  it('respects longer configured timeouts when the display locks earlier', () => {
    expect(shouldIdleAutoLock(15 * 60, 240)).toBe(false);
    expect(shouldIdleAutoLock(240 * 60, 240)).toBe(true);
  });
});
