import { describe, expect, it } from 'vitest';
import { compareSemver, normalizeVersionTag } from '../../src/shared/version-compare';

describe('normalizeVersionTag', () => {
  it('strips a leading v', () => {
    expect(normalizeVersionTag('v0.2.8')).toBe('0.2.8');
    expect(normalizeVersionTag('V1.0.0')).toBe('1.0.0');
  });
});

describe('compareSemver', () => {
  it('orders numeric segments', () => {
    expect(compareSemver('0.2.9', '0.2.8')).toBe(1);
    expect(compareSemver('0.2.8', '0.2.8')).toBe(0);
    expect(compareSemver('0.2.7', '0.2.8')).toBe(-1);
    expect(compareSemver('v0.3.0', '0.2.8')).toBe(1);
  });
});
