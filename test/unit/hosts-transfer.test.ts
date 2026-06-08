import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/db/migrations';
import { VmsRepo } from '../../src/main/db/vms-repo';
import { Vault } from '../../src/main/vault/vault';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  buildExportPayload,
  decryptExportFile,
  encryptExportPayload,
  importHostsPayload,
  parseExportFile,
} from '../../src/main/export/hosts-transfer';

let repo: VmsRepo;
let vault: Vault;
let vaultPath: string;

beforeEach(async () => {
  const db = new Database(':memory:');
  migrate(db);
  repo = new VmsRepo(db);
  vaultPath = join(tmpdir(), `vssh-export-test-${randomUUID()}.enc`);
  vault = new Vault(vaultPath);
  await vault.init('master-password-12chars');
});

describe('hosts export/import', () => {
  it('round-trips hosts through an export key', async () => {
    const folder = repo.createFolder({ name: 'Production', parentId: null, sortOrder: 0 });
    const vm = repo.createVm({
      folderId: folder.id,
      label: 'web-01',
      host: '10.0.0.5',
      port: 22,
      username: 'admin',
      authMethod: 'password',
      keyPath: null,
      autoSubmitEnabled: true,
    });
    await vault.setSecret(vm.vaultRef, { password: 'secret-pass', sudoPassword: 'sudo-pass' });

    const exportKey = 'export-key-123';
    const payload = buildExportPayload(repo, vault);
    expect(payload.hosts).toHaveLength(1);
    expect(payload.hosts[0].secret.password).toBe('secret-pass');

    const file = await encryptExportPayload(payload, exportKey);
    const raw = JSON.stringify(file);
    const parsed = parseExportFile(raw);
    const decrypted = await decryptExportFile(parsed, exportKey);

    const emptyDb = new Database(':memory:');
    migrate(emptyDb);
    const importRepo = new VmsRepo(emptyDb);
    const importVault = new Vault(join(tmpdir(), `vssh-export-import-${randomUUID()}.enc`));
    await importVault.init('other-master-password');
    importRepo.createFolder({ name: 'Default', parentId: null, sortOrder: 0 });

    const summary = await importHostsPayload(importRepo, importVault, decrypted);
    expect(summary.importedHosts).toBe(1);
    expect(summary.createdFolders).toBe(1);

    const imported = importRepo.listVms()[0];
    expect(imported.label).toBe('web-01');
    expect(imported.host).toBe('10.0.0.5');
    expect(importVault.getSecret(imported.vaultRef).password).toBe('secret-pass');
  });

  it('exports only selected workspaces', async () => {
    const prod = repo.createFolder({ name: 'Production', parentId: null, sortOrder: 0 });
    const staging = repo.createFolder({ name: 'Staging', parentId: null, sortOrder: 1 });
    const prodVm = repo.createVm({
      folderId: prod.id,
      label: 'prod',
      host: '10.0.0.1',
      port: 22,
      username: 'u',
      authMethod: 'password',
      keyPath: null,
      autoSubmitEnabled: true,
    });
    repo.createVm({
      folderId: staging.id,
      label: 'stage',
      host: '10.0.0.2',
      port: 22,
      username: 'u',
      authMethod: 'password',
      keyPath: null,
      autoSubmitEnabled: true,
    });
    await vault.setSecret(prodVm.vaultRef, { password: 'x' });

    const payload = buildExportPayload(repo, vault, { folderIds: [prod.id], includeUnassigned: false });
    expect(payload.hosts).toHaveLength(1);
    expect(payload.hosts[0].label).toBe('prod');
    expect(payload.folders).toHaveLength(1);
    expect(payload.folders[0].name).toBe('Production');
  });

  it('fails decrypt with the wrong export key', async () => {
    const vm = repo.createVm({
      folderId: null,
      label: 'a',
      host: 'h',
      port: 22,
      username: 'u',
      authMethod: 'password',
      keyPath: null,
      autoSubmitEnabled: true,
    });
    await vault.setSecret(vm.vaultRef, { password: 'x' });

    const file = await encryptExportPayload(buildExportPayload(repo, vault), 'correct-key');
    await expect(decryptExportFile(file, 'wrong-key')).rejects.toThrow();
  });
});
