// test/unit/memory.test.ts
import { describe, it, expect } from 'vitest';
import { zeroBuffer, withZeroedBuffer } from '../../src/main/vault/memory';

describe('memory', () => {
  it('zeros a buffer in place', () => {
    const buf = Buffer.from('secret');
    zeroBuffer(buf);
    expect(buf.every(b => b === 0)).toBe(true);
  });

  it('withZeroedBuffer zeros even when callback throws', async () => {
    const buf = Buffer.from('secret');
    await expect(withZeroedBuffer(buf, async () => { throw new Error('x'); })).rejects.toThrow('x');
    expect(buf.every(b => b === 0)).toBe(true);
  });
});
