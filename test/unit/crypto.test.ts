// test/unit/crypto.test.ts
import { describe, it, expect } from 'vitest';
import { encryptVault, decryptVault, deriveKey } from '../../src/main/vault/crypto';

describe('crypto', () => {
  it('round-trips a plaintext payload', async () => {
    const password = 'correct horse battery staple';
    const plaintext = Buffer.from(JSON.stringify({ hello: 'world' }), 'utf8');
    const blob = await encryptVault(plaintext, password);
    const decrypted = await decryptVault(blob, password);
    expect(decrypted.toString('utf8')).toBe('{"hello":"world"}');
  });

  it('fails with the wrong password', async () => {
    const blob = await encryptVault(Buffer.from('x'), 'right');
    await expect(decryptVault(blob, 'wrong')).rejects.toThrow();
  });

  it('derives a 32-byte key', async () => {
    const salt = Buffer.alloc(16, 1);
    const key = await deriveKey('pw', salt);
    expect(key.length).toBe(32);
  });
});
