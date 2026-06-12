import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { Identity, IdentityInput } from '@shared/types';

interface IdentityRow {
  id: number;
  label: string;
  username: string;
  vault_ref: string;
  created_at: number;
}

function rowToIdentity(r: IdentityRow): Identity {
  return {
    id: r.id,
    label: r.label,
    username: r.username,
    vaultRef: r.vault_ref,
    createdAt: r.created_at,
  };
}

export class IdentitiesRepo {
  constructor(private readonly db: Database) {}

  createIdentity(input: IdentityInput): Identity {
    const vaultRef = randomUUID();
    const now = Date.now();
    const info = this.db
      .prepare(
        `INSERT INTO identities (label, username, vault_ref, created_at)
         VALUES (@label, @username, @vaultRef, @createdAt)`,
      )
      .run({ ...input, vaultRef, createdAt: now });
    return this.getIdentity(Number(info.lastInsertRowid))!;
  }

  updateIdentity(id: number, input: IdentityInput): void {
    this.db
      .prepare('UPDATE identities SET label = @label, username = @username WHERE id = @id')
      .run({ ...input, id });
  }

  deleteIdentity(id: number): void {
    this.db.prepare('DELETE FROM identities WHERE id = ?').run(id);
  }

  getIdentity(id: number): Identity | null {
    const row = this.db.prepare('SELECT * FROM identities WHERE id = ?').get(id) as IdentityRow | undefined;
    return row ? rowToIdentity(row) : null;
  }

  listIdentities(): Identity[] {
    const rows = this.db
      .prepare('SELECT * FROM identities ORDER BY label ASC')
      .all() as IdentityRow[];
    return rows.map(rowToIdentity);
  }
}
