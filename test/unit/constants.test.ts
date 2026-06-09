import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/shared/constants';

describe('DEFAULTS', () => {
  it('allows master passwords with at least 6 characters', () => {
    expect(DEFAULTS.MIN_MASTER_PW_LEN).toBe(6);
  });
});
