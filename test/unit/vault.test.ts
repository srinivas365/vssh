// test/unit/vault.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Vault } from '../../src/main/vault/vault';

let dir: string;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'vault-')); });

describe('Vault', () => {
  it('initializes with a master password and saves an empty vault', async () => {
    const v = new Vault(path.join(dir, 'vault.enc'));
    await v.init('correct horse battery staple');
    expect(v.state()).toBe('unlocked');
  });

  it('unlocks with the correct password and rejects wrong ones', async () => {
    const v1 = new Vault(path.join(dir, 'vault.enc'));
    await v1.init('right-master-pw');
    await v1.lock();

    const v2 = new Vault(path.join(dir, 'vault.enc'));
    await expect(v2.unlock('wrong')).rejects.toThrow();
    await v2.unlock('right-master-pw');
    expect(v2.state()).toBe('unlocked');
  });

  it('verifyPassword returns true only for the correct master password', async () => {
    const file = path.join(dir, 'vault.enc');
    const v = new Vault(file);
    await v.init('right-master-pw');
    await expect(v.verifyPassword('wrong')).resolves.toBe(false);
    await expect(v.verifyPassword('right-master-pw')).resolves.toBe(true);
  });

  it('stores and retrieves secrets per vault_ref', async () => {
    const v = new Vault(path.join(dir, 'vault.enc'));
    await v.init('master-pw-12345');
    await v.setSecret('uuid-a', { password: 'p1', sudoPassword: 's1' });
    expect(v.getSecret('uuid-a')).toEqual({ password: 'p1', sudoPassword: 's1' });
  });

  it('persists secrets across lock/unlock', async () => {
    const file = path.join(dir, 'vault.enc');
    const v1 = new Vault(file);
    await v1.init('master-pw-12345');
    await v1.setSecret('uuid-b', { password: 'persisted' });
    await v1.lock();

    const v2 = new Vault(file);
    await v2.unlock('master-pw-12345');
    expect(v2.getSecret('uuid-b')).toEqual({ password: 'persisted' });
  });

  it('throws on getSecret when locked', () => {
    const v = new Vault(path.join(dir, 'vault.enc'));
    expect(() => v.getSecret('any')).toThrow(/locked/);
  });
});
