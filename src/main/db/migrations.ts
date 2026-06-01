import type { Database } from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export function migrate(db: Database): void {
  const sql = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(sql);
}
