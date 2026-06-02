import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { Vm, VmInput, Folder } from '@shared/types';

interface VmRow {
  id: number;
  folder_id: number | null;
  label: string;
  host: string;
  port: number;
  username: string;
  auth_method: 'password' | 'key' | 'key+password';
  key_path: string | null;
  vault_ref: string;
  auto_copy_disabled: number;
  auto_submit_enabled: number;
  last_used_at: number | null;
  created_at: number;
}

interface FolderRow {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
}

function rowToVm(r: VmRow): Vm {
  return {
    id: r.id,
    folderId: r.folder_id,
    label: r.label,
    host: r.host,
    port: r.port,
    username: r.username,
    authMethod: r.auth_method,
    keyPath: r.key_path,
    vaultRef: r.vault_ref,
    autoCopyDisabled: r.auto_copy_disabled === 1,
    autoSubmitEnabled: r.auto_submit_enabled === 1,
    lastUsedAt: r.last_used_at,
    createdAt: r.created_at,
  };
}

function rowToFolder(r: FolderRow): Folder {
  return { id: r.id, name: r.name, parentId: r.parent_id, sortOrder: r.sort_order };
}

export class VmsRepo {
  constructor(private readonly db: Database) {}

  createVm(input: VmInput): Vm {
    const vaultRef = randomUUID();
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO vms (folder_id, label, host, port, username, auth_method, key_path, vault_ref, auto_submit_enabled, created_at)
      VALUES (@folderId, @label, @host, @port, @username, @authMethod, @keyPath, @vaultRef, @autoSubmitEnabled, @createdAt)
    `);
    const info = stmt.run({
      ...input,
      autoSubmitEnabled: input.autoSubmitEnabled ? 1 : 0,
      vaultRef,
      createdAt: now,
    });
    return this.getVm(Number(info.lastInsertRowid))!;
  }

  updateVm(id: number, input: VmInput): void {
    this.db
      .prepare(
        `
      UPDATE vms SET folder_id=@folderId, label=@label, host=@host, port=@port,
        username=@username, auth_method=@authMethod, key_path=@keyPath,
        auto_submit_enabled=@autoSubmitEnabled
      WHERE id=@id
    `,
      )
      .run({ ...input, autoSubmitEnabled: input.autoSubmitEnabled ? 1 : 0, id });
  }

  deleteVm(id: number): void {
    this.db.prepare('DELETE FROM vms WHERE id = ?').run(id);
  }

  getVm(id: number): Vm | null {
    const row = this.db.prepare('SELECT * FROM vms WHERE id = ?').get(id) as
      | VmRow
      | undefined;
    return row ? rowToVm(row) : null;
  }

  listVms(): Vm[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM vms ORDER BY (last_used_at IS NULL), last_used_at DESC, label ASC',
      )
      .all() as VmRow[];
    return rows.map(rowToVm);
  }

  touchUsed(id: number): void {
    this.db.prepare('UPDATE vms SET last_used_at = ? WHERE id = ?').run(Date.now(), id);
  }

  setAutoCopyDisabled(id: number, disabled: boolean): void {
    this.db
      .prepare('UPDATE vms SET auto_copy_disabled = ? WHERE id = ?')
      .run(disabled ? 1 : 0, id);
  }

  setAutoSubmitEnabled(id: number, enabled: boolean): void {
    this.db
      .prepare('UPDATE vms SET auto_submit_enabled = ? WHERE id = ?')
      .run(enabled ? 1 : 0, id);
  }

  createFolder(f: Omit<Folder, 'id'>): Folder {
    const info = this.db
      .prepare('INSERT INTO folders (name, parent_id, sort_order) VALUES (?, ?, ?)')
      .run(f.name, f.parentId, f.sortOrder);
    return { id: Number(info.lastInsertRowid), ...f };
  }

  renameFolder(id: number, name: string): void {
    this.db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, id);
  }

  reassignVmsFromFolder(fromId: number, toId: number): void {
    this.db
      .prepare('UPDATE vms SET folder_id = ? WHERE folder_id = ?')
      .run(toId, fromId);
  }

  listFolders(): Folder[] {
    const rows = this.db
      .prepare('SELECT * FROM folders ORDER BY sort_order ASC, name ASC')
      .all() as FolderRow[];
    return rows.map(rowToFolder);
  }

  deleteFolder(id: number): void {
    this.db.prepare('DELETE FROM folders WHERE id = ?').run(id);
  }
}
