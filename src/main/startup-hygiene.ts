import type Database from 'better-sqlite3';
import { VmsRepo } from './db/vms-repo';

/**
 * Runs on every app launch. If the DB has no folders yet, creates a
 * "Default" folder and reassigns any NULL-folder VMs to it.
 *
 * Idempotent — once at least one folder exists, this is a no-op.
 */
export function ensureDefaultWorkspace(
  db: Database.Database,
  repo: VmsRepo,
): void {
  if (repo.listFolders().length > 0) return;
  const def = repo.createFolder({
    name: 'Default',
    parentId: null,
    sortOrder: 0,
  });
  db.prepare('UPDATE vms SET folder_id = ? WHERE folder_id IS NULL').run(def.id);
}
