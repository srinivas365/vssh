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
});
