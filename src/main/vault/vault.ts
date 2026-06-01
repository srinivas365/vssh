import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { encryptVault, decryptVault } from './crypto';
import { VaultEntry } from '@shared/types';

type VaultState = 'empty' | 'locked' | 'unlocked';
type VaultMap = Record<string, VaultEntry>;

export class Vault {
  private contents: VaultMap | null = null;
  private masterPassword: string | null = null;

  constructor(private readonly filePath: string) {}

  state(): VaultState {
    if (this.contents) return 'unlocked';
    if (existsSync(this.filePath)) return 'locked';
    return 'empty';
  }

  async init(masterPassword: string): Promise<void> {
    if (existsSync(this.filePath)) throw new Error('vault: already initialized');
    this.contents = {};
    this.masterPassword = masterPassword;
    await this.persist();
  }

  async unlock(masterPassword: string): Promise<void> {
    const blob = await fs.readFile(this.filePath);
    const plaintext = await decryptVault(blob, masterPassword);
    this.contents = JSON.parse(plaintext.toString('utf8')) as VaultMap;
    plaintext.fill(0);
    this.masterPassword = masterPassword;
  }

  async lock(): Promise<void> {
    this.contents = null;
    this.masterPassword = null;
  }

  getSecret(vaultRef: string): VaultEntry {
    if (!this.contents) throw new Error('vault: locked');
    return this.contents[vaultRef] ?? {};
  }

  async setSecret(vaultRef: string, entry: VaultEntry): Promise<void> {
    if (!this.contents || !this.masterPassword) throw new Error('vault: locked');
    this.contents[vaultRef] = entry;
    await this.persist();
  }

  async deleteSecret(vaultRef: string): Promise<void> {
    if (!this.contents || !this.masterPassword) throw new Error('vault: locked');
    delete this.contents[vaultRef];
    await this.persist();
  }

  private async persist(): Promise<void> {
    if (!this.contents || !this.masterPassword) throw new Error('vault: cannot persist while locked');
    const plaintext = Buffer.from(JSON.stringify(this.contents), 'utf8');
    const blob = await encryptVault(plaintext, this.masterPassword);
    plaintext.fill(0);
    await fs.writeFile(this.filePath, blob, { mode: 0o600 });
  }
}
