import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/db/migrations';
import { IdentitiesRepo } from '../../src/main/db/identities-repo';

let repo: IdentitiesRepo;

beforeEach(() => {
  const db = new Database(':memory:');
  migrate(db);
  repo = new IdentitiesRepo(db);
});

describe('IdentitiesRepo', () => {
  it('creates an identity and returns it', () => {
    const identity = repo.createIdentity({ label: 'Prod admin', username: 'ubuntu' });
    expect(identity.id).toBeGreaterThan(0);
    expect(identity.label).toBe('Prod admin');
    expect(identity.username).toBe('ubuntu');
    expect(identity.vaultRef).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('lists identities ordered by label', () => {
    repo.createIdentity({ label: 'Zebra', username: 'z' });
    repo.createIdentity({ label: 'Alpha', username: 'a' });
    const list = repo.listIdentities();
    expect(list.map((i) => i.label)).toEqual(['Alpha', 'Zebra']);
  });

  it('updates an identity', () => {
    const identity = repo.createIdentity({ label: 'Old', username: 'u1' });
    repo.updateIdentity(identity.id, { label: 'New', username: 'u2' });
    const updated = repo.getIdentity(identity.id);
    expect(updated?.label).toBe('New');
    expect(updated?.username).toBe('u2');
    expect(updated?.vaultRef).toBe(identity.vaultRef);
  });

  it('deletes an identity', () => {
    const identity = repo.createIdentity({ label: 'Temp', username: 'u' });
    repo.deleteIdentity(identity.id);
    expect(repo.getIdentity(identity.id)).toBeNull();
  });
});
