import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/db/migrations';

describe('migrate', () => {
  it('creates vms and folders tables', () => {
    const db = new Database(':memory:');
    migrate(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r: any) => r.name);
    expect(tables).toContain('vms');
    expect(tables).toContain('folders');
  });

  it('is idempotent', () => {
    const db = new Database(':memory:');
    migrate(db);
    expect(() => migrate(db)).not.toThrow();
  });

  it('adds auto_submit_enabled to existing vms tables', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE vms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_id INTEGER,
        label TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL DEFAULT 22,
        username TEXT NOT NULL,
        auth_method TEXT NOT NULL,
        key_path TEXT,
        vault_ref TEXT NOT NULL UNIQUE,
        auto_copy_disabled INTEGER NOT NULL DEFAULT 0,
        last_used_at INTEGER,
        created_at INTEGER NOT NULL
      );
    `);

    migrate(db);

    const columns = db.prepare('PRAGMA table_info(vms)').all().map((r: any) => r.name);
    expect(columns).toContain('auto_submit_enabled');
  });
});
