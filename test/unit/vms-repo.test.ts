import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/db/migrations';
import { VmsRepo } from '../../src/main/db/vms-repo';

let repo: VmsRepo;
beforeEach(() => {
  const db = new Database(':memory:');
  migrate(db);
  repo = new VmsRepo(db);
});

describe('VmsRepo', () => {
  it('creates a VM and returns it', () => {
    const vm = repo.createVm({
      folderId: null,
      label: 'prod-db-01',
      host: '10.0.0.1',
      port: 22,
      username: 'admin',
      authMethod: 'password',
      keyPath: null,
    });
    expect(vm.id).toBeGreaterThan(0);
    expect(vm.label).toBe('prod-db-01');
    expect(vm.vaultRef).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('lists VMs ordered by last_used desc then label', () => {
    const a = repo.createVm({ folderId: null, label: 'a', host: 'h', port: 22, username: 'u', authMethod: 'password', keyPath: null });
    const b = repo.createVm({ folderId: null, label: 'b', host: 'h', port: 22, username: 'u', authMethod: 'password', keyPath: null });
    repo.touchUsed(b.id);
    const list = repo.listVms();
    expect(list[0].id).toBe(b.id);
    expect(list[1].id).toBe(a.id);
  });

  it('updates a VM', () => {
    const vm = repo.createVm({ folderId: null, label: 'a', host: 'h', port: 22, username: 'u', authMethod: 'password', keyPath: null });
    repo.updateVm(vm.id, { ...vm, label: 'renamed', host: vm.host, port: vm.port, username: vm.username, authMethod: vm.authMethod, keyPath: vm.keyPath, folderId: vm.folderId });
    expect(repo.getVm(vm.id)?.label).toBe('renamed');
  });

  it('deletes a VM', () => {
    const vm = repo.createVm({ folderId: null, label: 'a', host: 'h', port: 22, username: 'u', authMethod: 'password', keyPath: null });
    repo.deleteVm(vm.id);
    expect(repo.getVm(vm.id)).toBeNull();
  });

  it('creates and lists folders', () => {
    const f = repo.createFolder({ name: 'Production', parentId: null, sortOrder: 0 });
    expect(repo.listFolders()).toHaveLength(1);
    expect(repo.listFolders()[0].name).toBe('Production');
  });

  it('sets auto_copy_disabled', () => {
    const vm = repo.createVm({ folderId: null, label: 'a', host: 'h', port: 22, username: 'u', authMethod: 'password', keyPath: null });
    repo.setAutoCopyDisabled(vm.id, true);
    expect(repo.getVm(vm.id)?.autoCopyDisabled).toBe(true);
  });

  it('renames a folder', () => {
    const f = repo.createFolder({ name: 'old-name', parentId: null, sortOrder: 0 });
    repo.renameFolder(f.id, 'new-name');
    expect(repo.listFolders().find((x) => x.id === f.id)?.name).toBe('new-name');
  });

  it('reassigns vms from one folder to another', () => {
    const from = repo.createFolder({ name: 'from', parentId: null, sortOrder: 0 });
    const to   = repo.createFolder({ name: 'to',   parentId: null, sortOrder: 0 });
    const a = repo.createVm({ folderId: from.id, label: 'a', host: 'h', port: 22, username: 'u', authMethod: 'password', keyPath: null });
    const b = repo.createVm({ folderId: from.id, label: 'b', host: 'h', port: 22, username: 'u', authMethod: 'password', keyPath: null });
    const c = repo.createVm({ folderId: to.id,   label: 'c', host: 'h', port: 22, username: 'u', authMethod: 'password', keyPath: null });

    repo.reassignVmsFromFolder(from.id, to.id);

    expect(repo.getVm(a.id)?.folderId).toBe(to.id);
    expect(repo.getVm(b.id)?.folderId).toBe(to.id);
    expect(repo.getVm(c.id)?.folderId).toBe(to.id);
  });
});
