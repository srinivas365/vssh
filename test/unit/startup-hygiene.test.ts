import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/db/migrations';
import { VmsRepo } from '../../src/main/db/vms-repo';
import { ensureDefaultWorkspace } from '../../src/main/startup-hygiene';

let db: Database.Database;
let repo: VmsRepo;
beforeEach(() => {
  db = new Database(':memory:');
  migrate(db);
  repo = new VmsRepo(db);
});

describe('ensureDefaultWorkspace', () => {
  it('creates a "Default" folder when none exist', () => {
    ensureDefaultWorkspace(db, repo);
    const folders = repo.listFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0].name).toBe('Default');
  });

  it('reassigns NULL-folder VMs to the new Default', () => {
    const vm = repo.createVm({
      folderId: null,
      label: 'orphan',
      host: 'h',
      port: 22,
      username: 'u',
      authMethod: 'password',
      keyPath: null,
    });
    ensureDefaultWorkspace(db, repo);
    const def = repo.listFolders()[0];
    expect(repo.getVm(vm.id)?.folderId).toBe(def.id);
  });

  it('is idempotent — no duplicate Default created', () => {
    ensureDefaultWorkspace(db, repo);
    ensureDefaultWorkspace(db, repo);
    ensureDefaultWorkspace(db, repo);
    expect(repo.listFolders()).toHaveLength(1);
  });

  it('does nothing when a folder already exists', () => {
    repo.createFolder({ name: 'Production', parentId: null, sortOrder: 0 });
    ensureDefaultWorkspace(db, repo);
    const folders = repo.listFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0].name).toBe('Production');
  });

  it('leaves VMs alone when a folder already exists', () => {
    const f = repo.createFolder({ name: 'Existing', parentId: null, sortOrder: 0 });
    const vm = repo.createVm({
      folderId: null,
      label: 'orphan',
      host: 'h',
      port: 22,
      username: 'u',
      authMethod: 'password',
      keyPath: null,
    });
    ensureDefaultWorkspace(db, repo);
    expect(repo.getVm(vm.id)?.folderId).toBeNull();
    expect(repo.listFolders()).toHaveLength(1);
    expect(repo.listFolders()[0].id).toBe(f.id);
  });
});
