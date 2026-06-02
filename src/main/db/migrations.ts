import type { Database } from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function hasColumn(db: Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

export function migrate(db: Database): void {
  const sql = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(sql);

  if (!hasColumn(db, 'vms', 'auto_submit_enabled')) {
    db.exec('ALTER TABLE vms ADD COLUMN auto_submit_enabled INTEGER NOT NULL DEFAULT 1;');
  }
}
