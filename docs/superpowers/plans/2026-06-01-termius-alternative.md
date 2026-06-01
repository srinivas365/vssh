# Termius Alternative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Electron SSH client that saves VM credentials and auto-copies passwords to the clipboard with a toast when SSH prompts for a password.

**Architecture:** Two-process Electron app. Main process owns the SQLite VM database, the encrypted credential vault (AES-256-GCM + Argon2id), the SSH session manager (node-pty spawning system `ssh`), and the prompt detector that watches PTY output. Renderer (React + xterm.js) renders the UI but never touches plaintext secrets — secrets flow main → clipboard via a typed IPC surface.

**Tech Stack:** Electron, TypeScript, React, xterm.js, node-pty, better-sqlite3, argon2, Vitest, Playwright, electron-builder.

**Spec:** `docs/superpowers/specs/2026-06-01-termius-alternative-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/main/index.ts` | Electron app lifecycle, window creation |
| `src/main/ipc.ts` | Typed IPC channel registration |
| `src/main/db/schema.sql` | SQLite schema |
| `src/main/db/migrations.ts` | Schema bootstrap & migrations |
| `src/main/db/vms-repo.ts` | CRUD on `vms` and `folders` |
| `src/main/vault/crypto.ts` | Argon2id + AES-256-GCM primitives |
| `src/main/vault/memory.ts` | Buffer zeroing, lock helpers |
| `src/main/vault/vault.ts` | Load/unlock/lock/save lifecycle |
| `src/main/ssh/session.ts` | One PTY + one ssh process |
| `src/main/ssh/session-manager.ts` | Tracks all active sessions |
| `src/main/ssh/prompt-detector.ts` | Regex matrix on PTY output |
| `src/main/clipboard.ts` | Write + auto-clear timer |
| `src/main/logger.ts` | Redaction-aware logger |
| `src/preload/preload.ts` | Exposes typed `window.api` |
| `src/renderer/App.tsx` | Top-level routing (Unlock vs Main) |
| `src/renderer/screens/Unlock.tsx` | Master password screen |
| `src/renderer/screens/Main.tsx` | Sidebar + tabs layout |
| `src/renderer/components/Sidebar/*` | Folder tree, search, drag-drop |
| `src/renderer/components/TabBar/*` | Tab bar + state dots |
| `src/renderer/components/Terminal/*` | xterm.js wrapper |
| `src/renderer/components/Toast/*` | Toast overlay |
| `src/renderer/components/VmEditForm/*` | VM create/edit modal |
| `src/renderer/components/QuickConnect/*` | ⌘K picker |
| `src/renderer/state/*` | Zustand stores |
| `src/shared/types.ts` | Cross-process types |
| `src/shared/constants.ts` | IPC channel names, timeouts |
| `test/unit/*` | Vitest unit tests |
| `test/e2e/*` | Playwright Electron E2E |

---

## Phase 1 — Scaffolding

### Task 1: Initialize project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.main.json`, `tsconfig.renderer.json`, `.gitignore`, `vite.config.ts`, `vitest.config.ts`, `electron-builder.yml`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "termius-alt",
  "version": "0.0.1",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "concurrently -k \"vite\" \"wait-on tcp:5173 && tsc -p tsconfig.main.json -w\" \"wait-on dist/main/index.js && electron .\"",
    "build:main": "tsc -p tsconfig.main.json && tsc -p tsconfig.preload.json",
    "build:renderer": "vite build",
    "build": "npm run build:main && npm run build:renderer",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "dist": "npm run build && electron-builder",
    "typecheck": "tsc -p tsconfig.main.json --noEmit && tsc -p tsconfig.renderer.json --noEmit"
  },
  "dependencies": {
    "argon2": "^0.31.2",
    "better-sqlite3": "^11.5.0",
    "electron-store": "^10.0.0",
    "node-pty": "^1.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "xterm": "^5.5.0",
    "xterm-addon-fit": "^0.10.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "concurrently": "^9.0.0",
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0",
    "wait-on": "^8.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json` (root)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": { "@shared/*": ["src/shared/*"] }
  }
}
```

- [ ] **Step 3: Create `tsconfig.main.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "target": "ES2022",
    "outDir": "dist/main",
    "rootDir": "src"
  },
  "include": ["src/main/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 4: Create `tsconfig.preload.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "dist/preload",
    "rootDir": "src"
  },
  "include": ["src/preload/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 5: Create `tsconfig.renderer.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist/renderer",
    "rootDir": "src"
  },
  "include": ["src/renderer/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 6: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: 'src/renderer',
  base: './',
  build: { outDir: '../../dist/renderer', emptyOutDir: true },
  plugins: [react()],
  resolve: { alias: { '@shared': path.resolve(__dirname, 'src/shared') } },
  server: { port: 5173 },
});
```

- [ ] **Step 7: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
  },
  resolve: { alias: { '@shared': path.resolve(__dirname, 'src/shared') } },
});
```

- [ ] **Step 8: Create `.gitignore`**

```
node_modules/
dist/
out/
release/
.vite/
*.log
.DS_Store
test/e2e/.tmp/
```

- [ ] **Step 9: Create `electron-builder.yml`**

```yaml
appId: dev.local.termius-alt
productName: Termius-Alt
directories:
  output: release
files:
  - dist/**/*
  - package.json
mac:
  category: public.app-category.developer-tools
  target: dmg
```

- [ ] **Step 10: Install dependencies**

Run: `npm install`
Expected: completes with native module builds for `better-sqlite3`, `node-pty`, `argon2`.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig*.json vite.config.ts vitest.config.ts .gitignore electron-builder.yml
git commit -m "chore: scaffold electron + typescript + vite project"
```

---

### Task 2: Shared types and constants

**Files:**
- Create: `src/shared/types.ts`, `src/shared/constants.ts`

- [ ] **Step 1: Write `src/shared/types.ts`**

```ts
export type AuthMethod = 'password' | 'key' | 'key+password';

export interface Folder {
  id: number;
  name: string;
  parentId: number | null;
  sortOrder: number;
}

export interface Vm {
  id: number;
  folderId: number | null;
  label: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  keyPath: string | null;
  vaultRef: string;
  autoCopyDisabled: boolean;
  lastUsedAt: number | null;
  createdAt: number;
}

export interface VmInput {
  folderId: number | null;
  label: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  keyPath: string | null;
}

export interface VaultEntry {
  password?: string;
  sudoPassword?: string;
  keyPassphrase?: string;
}

export type PromptType = 'login' | 'sudo' | 'key-passphrase' | 'generic';

export interface ToastPayload {
  sessionId: string;
  vmId: number;
  promptType: PromptType;
  hasSecret: boolean;
}

export interface SessionState {
  sessionId: string;
  vmId: number;
  status: 'connecting' | 'connected' | 'closed' | 'error';
  latencyMs: number | null;
  startedAt: number;
}
```

- [ ] **Step 2: Write `src/shared/constants.ts`**

```ts
export const IPC = {
  // vault
  VAULT_STATE: 'vault:state',
  VAULT_INIT: 'vault:init',
  VAULT_UNLOCK: 'vault:unlock',
  VAULT_LOCK: 'vault:lock',
  VAULT_SET_SECRET: 'vault:set-secret',
  // vms
  VMS_LIST: 'vms:list',
  VMS_CREATE: 'vms:create',
  VMS_UPDATE: 'vms:update',
  VMS_DELETE: 'vms:delete',
  VMS_TOUCH_USED: 'vms:touch-used',
  // folders
  FOLDERS_LIST: 'folders:list',
  FOLDERS_CREATE: 'folders:create',
  FOLDERS_DELETE: 'folders:delete',
  // sessions
  SESSION_START: 'session:start',
  SESSION_INPUT: 'session:input',
  SESSION_RESIZE: 'session:resize',
  SESSION_CLOSE: 'session:close',
  SESSION_OUTPUT: 'session:output',           // main → renderer
  SESSION_STATE: 'session:state',             // main → renderer
  SESSION_TOAST: 'session:toast',             // main → renderer
  // misc
  PASTE_PASSWORD: 'session:paste-password',   // ⌘⇧P manual fallback
  VAULT_STATE_CHANGED: 'vault:state-changed', // main → renderer broadcast
} as const;

export const DEFAULTS = {
  CLIPBOARD_CLEAR_MS: 30_000,
  AUTO_LOCK_MS: 15 * 60_000,
  PROMPT_DEBOUNCE_MS: 2_000,
  PTY_BUFFER_BYTES: 512,
  LOGIN_PROMPT_WINDOW_MS: 5_000,
  WRONG_PASSWORD_DELAY_MS: 1_000,
  MIN_MASTER_PW_LEN: 12,
} as const;
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/
git commit -m "feat: shared types and IPC constants"
```

---

## Phase 2 — Vault (crypto + lifecycle)

### Task 3: Crypto primitives — Argon2id key derivation + AES-GCM

**Files:**
- Create: `src/main/vault/crypto.ts`, `test/unit/crypto.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/crypto.test.ts
import { describe, it, expect } from 'vitest';
import { encryptVault, decryptVault, deriveKey } from '../../src/main/vault/crypto';

describe('crypto', () => {
  it('round-trips a plaintext payload', async () => {
    const password = 'correct horse battery staple';
    const plaintext = Buffer.from(JSON.stringify({ hello: 'world' }), 'utf8');
    const blob = await encryptVault(plaintext, password);
    const decrypted = await decryptVault(blob, password);
    expect(decrypted.toString('utf8')).toBe('{"hello":"world"}');
  });

  it('fails with the wrong password', async () => {
    const blob = await encryptVault(Buffer.from('x'), 'right');
    await expect(decryptVault(blob, 'wrong')).rejects.toThrow();
  });

  it('derives a 32-byte key', async () => {
    const salt = Buffer.alloc(16, 1);
    const key = await deriveKey('pw', salt);
    expect(key.length).toBe(32);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx vitest run test/unit/crypto.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/main/vault/crypto.ts`**

```ts
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import argon2 from 'argon2';

const SALT_LEN = 16;
const NONCE_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

export async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    salt,
    memoryCost: 64 * 1024,
    timeCost: 3,
    parallelism: 1,
    hashLength: KEY_LEN,
    raw: true,
  }) as Buffer;
}

export async function encryptVault(plaintext: Buffer, password: string): Promise<Buffer> {
  const salt = randomBytes(SALT_LEN);
  const nonce = randomBytes(NONCE_LEN);
  const key = await deriveKey(password, salt);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  key.fill(0);
  return Buffer.concat([salt, nonce, ct, tag]);
}

export async function decryptVault(blob: Buffer, password: string): Promise<Buffer> {
  if (blob.length < SALT_LEN + NONCE_LEN + TAG_LEN) throw new Error('vault: malformed blob');
  const salt = blob.subarray(0, SALT_LEN);
  const nonce = blob.subarray(SALT_LEN, SALT_LEN + NONCE_LEN);
  const tag = blob.subarray(blob.length - TAG_LEN);
  const ct = blob.subarray(SALT_LEN + NONCE_LEN, blob.length - TAG_LEN);
  const key = await deriveKey(password, salt);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  } finally {
    key.fill(0);
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npx vitest run test/unit/crypto.test.ts`
Expected: 3 PASS. (Argon2id derivation may take 1–2s per test.)

- [ ] **Step 5: Commit**

```bash
git add src/main/vault/crypto.ts test/unit/crypto.test.ts
git commit -m "feat(vault): argon2id + aes-gcm primitives with round-trip tests"
```

---

### Task 4: Memory helpers — buffer zeroing

**Files:**
- Create: `src/main/vault/memory.ts`, `test/unit/memory.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/memory.test.ts
import { describe, it, expect } from 'vitest';
import { zeroBuffer, withZeroedBuffer } from '../../src/main/vault/memory';

describe('memory', () => {
  it('zeros a buffer in place', () => {
    const buf = Buffer.from('secret');
    zeroBuffer(buf);
    expect(buf.every(b => b === 0)).toBe(true);
  });

  it('withZeroedBuffer zeros even when callback throws', async () => {
    const buf = Buffer.from('secret');
    await expect(withZeroedBuffer(buf, async () => { throw new Error('x'); })).rejects.toThrow('x');
    expect(buf.every(b => b === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx vitest run test/unit/memory.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/main/vault/memory.ts`**

```ts
export function zeroBuffer(buf: Buffer): void {
  buf.fill(0);
}

export async function withZeroedBuffer<T>(buf: Buffer, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } finally {
    zeroBuffer(buf);
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npx vitest run test/unit/memory.test.ts`
Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/vault/memory.ts test/unit/memory.test.ts
git commit -m "feat(vault): buffer zeroing helpers"
```

---

### Task 5: Vault lifecycle (init, unlock, lock, secret CRUD)

**Files:**
- Create: `src/main/vault/vault.ts`, `test/unit/vault.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/vault.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Vault } from '../../src/main/vault/vault';

let dir: string;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'vault-')); });

describe('Vault', () => {
  it('initializes with a master password and saves an empty vault', async () => {
    const v = new Vault(path.join(dir, 'vault.enc'));
    await v.init('correct horse battery staple');
    expect(v.state()).toBe('unlocked');
  });

  it('unlocks with the correct password and rejects wrong ones', async () => {
    const v1 = new Vault(path.join(dir, 'vault.enc'));
    await v1.init('right-master-pw');
    await v1.lock();

    const v2 = new Vault(path.join(dir, 'vault.enc'));
    await expect(v2.unlock('wrong')).rejects.toThrow();
    await v2.unlock('right-master-pw');
    expect(v2.state()).toBe('unlocked');
  });

  it('stores and retrieves secrets per vault_ref', async () => {
    const v = new Vault(path.join(dir, 'vault.enc'));
    await v.init('master-pw-12345');
    await v.setSecret('uuid-a', { password: 'p1', sudoPassword: 's1' });
    expect(v.getSecret('uuid-a')).toEqual({ password: 'p1', sudoPassword: 's1' });
  });

  it('persists secrets across lock/unlock', async () => {
    const file = path.join(dir, 'vault.enc');
    const v1 = new Vault(file);
    await v1.init('master-pw-12345');
    await v1.setSecret('uuid-b', { password: 'persisted' });
    await v1.lock();

    const v2 = new Vault(file);
    await v2.unlock('master-pw-12345');
    expect(v2.getSecret('uuid-b')).toEqual({ password: 'persisted' });
  });

  it('throws on getSecret when locked', () => {
    const v = new Vault(path.join(dir, 'vault.enc'));
    expect(() => v.getSecret('any')).toThrow(/locked/);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx vitest run test/unit/vault.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/main/vault/vault.ts`**

```ts
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { encryptVault, decryptVault } from './crypto';
import { VaultEntry } from '@shared/types';

type VaultState = 'empty' | 'locked' | 'unlocked';
type VaultMap = Record<string, VaultEntry>;

export class Vault {
  private contents: VaultMap | null = null;
  private masterPassword: string | null = null;

  constructor(private readonly filePath: string) {}

  state(): VaultState {
    if (this.contents) return 'unlocked';
    if (existsSync(this.filePath)) return 'locked';
    return 'empty';
  }

  async init(masterPassword: string): Promise<void> {
    if (existsSync(this.filePath)) throw new Error('vault: already initialized');
    this.contents = {};
    this.masterPassword = masterPassword;
    await this.persist();
  }

  async unlock(masterPassword: string): Promise<void> {
    const blob = await fs.readFile(this.filePath);
    const plaintext = await decryptVault(blob, masterPassword);
    this.contents = JSON.parse(plaintext.toString('utf8')) as VaultMap;
    plaintext.fill(0);
    this.masterPassword = masterPassword;
  }

  async lock(): Promise<void> {
    this.contents = null;
    this.masterPassword = null;
  }

  getSecret(vaultRef: string): VaultEntry {
    if (!this.contents) throw new Error('vault: locked');
    return this.contents[vaultRef] ?? {};
  }

  async setSecret(vaultRef: string, entry: VaultEntry): Promise<void> {
    if (!this.contents || !this.masterPassword) throw new Error('vault: locked');
    this.contents[vaultRef] = entry;
    await this.persist();
  }

  async deleteSecret(vaultRef: string): Promise<void> {
    if (!this.contents || !this.masterPassword) throw new Error('vault: locked');
    delete this.contents[vaultRef];
    await this.persist();
  }

  private async persist(): Promise<void> {
    if (!this.contents || !this.masterPassword) throw new Error('vault: cannot persist while locked');
    const plaintext = Buffer.from(JSON.stringify(this.contents), 'utf8');
    const blob = await encryptVault(plaintext, this.masterPassword);
    plaintext.fill(0);
    await fs.writeFile(this.filePath, blob, { mode: 0o600 });
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npx vitest run test/unit/vault.test.ts`
Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/vault/vault.ts test/unit/vault.test.ts
git commit -m "feat(vault): init/unlock/lock lifecycle with persistent secret storage"
```

---

## Phase 3 — VM database

### Task 6: SQLite schema and migrations

**Files:**
- Create: `src/main/db/schema.sql`, `src/main/db/migrations.ts`, `test/unit/migrations.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/migrations.test.ts
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/db/migrations';

describe('migrate', () => {
  it('creates vms and folders tables', () => {
    const db = new Database(':memory:');
    migrate(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    expect(tables).toContain('vms');
    expect(tables).toContain('folders');
  });

  it('is idempotent', () => {
    const db = new Database(':memory:');
    migrate(db);
    expect(() => migrate(db)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx vitest run test/unit/migrations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/main/db/schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS folders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  parent_id   INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vms (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  folder_id           INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  label               TEXT NOT NULL,
  host                TEXT NOT NULL,
  port                INTEGER NOT NULL DEFAULT 22,
  username            TEXT NOT NULL,
  auth_method         TEXT NOT NULL CHECK (auth_method IN ('password','key','key+password')),
  key_path            TEXT,
  vault_ref           TEXT NOT NULL UNIQUE,
  auto_copy_disabled  INTEGER NOT NULL DEFAULT 0,
  last_used_at        INTEGER,
  created_at          INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vms_folder ON vms(folder_id);
CREATE INDEX IF NOT EXISTS idx_vms_last_used ON vms(last_used_at DESC);
```

- [ ] **Step 4: Implement `src/main/db/migrations.ts`**

```ts
import type { Database } from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export function migrate(db: Database): void {
  const sql = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(sql);
}
```

- [ ] **Step 5: Update `vitest.config.ts` to copy schema.sql for tests**

Update `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});
```

(Schema is read via `__dirname` from the source location, so tests pick it up directly. No copy needed if the source path resolves — confirm by running the test.)

- [ ] **Step 6: Run tests and verify they pass**

Run: `npx vitest run test/unit/migrations.test.ts`
Expected: 2 PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main/db/schema.sql src/main/db/migrations.ts test/unit/migrations.test.ts
git commit -m "feat(db): sqlite schema and migration bootstrap"
```

---

### Task 7: VM repository (CRUD + folders)

**Files:**
- Create: `src/main/db/vms-repo.ts`, `test/unit/vms-repo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/vms-repo.test.ts
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
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx vitest run test/unit/vms-repo.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/main/db/vms-repo.ts`**

```ts
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
      INSERT INTO vms (folder_id, label, host, port, username, auth_method, key_path, vault_ref, created_at)
      VALUES (@folderId, @label, @host, @port, @username, @authMethod, @keyPath, @vaultRef, @createdAt)
    `);
    const info = stmt.run({ ...input, vaultRef, createdAt: now });
    return this.getVm(Number(info.lastInsertRowid))!;
  }

  updateVm(id: number, input: VmInput): void {
    this.db.prepare(`
      UPDATE vms SET folder_id=@folderId, label=@label, host=@host, port=@port,
        username=@username, auth_method=@authMethod, key_path=@keyPath
      WHERE id=@id
    `).run({ ...input, id });
  }

  deleteVm(id: number): void {
    this.db.prepare('DELETE FROM vms WHERE id = ?').run(id);
  }

  getVm(id: number): Vm | null {
    const row = this.db.prepare('SELECT * FROM vms WHERE id = ?').get(id) as VmRow | undefined;
    return row ? rowToVm(row) : null;
  }

  listVms(): Vm[] {
    const rows = this.db.prepare(
      'SELECT * FROM vms ORDER BY (last_used_at IS NULL), last_used_at DESC, label ASC'
    ).all() as VmRow[];
    return rows.map(rowToVm);
  }

  touchUsed(id: number): void {
    this.db.prepare('UPDATE vms SET last_used_at = ? WHERE id = ?').run(Date.now(), id);
  }

  setAutoCopyDisabled(id: number, disabled: boolean): void {
    this.db.prepare('UPDATE vms SET auto_copy_disabled = ? WHERE id = ?').run(disabled ? 1 : 0, id);
  }

  createFolder(f: Omit<Folder, 'id'>): Folder {
    const info = this.db.prepare(
      'INSERT INTO folders (name, parent_id, sort_order) VALUES (?, ?, ?)'
    ).run(f.name, f.parentId, f.sortOrder);
    return { id: Number(info.lastInsertRowid), ...f };
  }

  listFolders(): Folder[] {
    const rows = this.db.prepare('SELECT * FROM folders ORDER BY sort_order ASC, name ASC').all() as FolderRow[];
    return rows.map(rowToFolder);
  }

  deleteFolder(id: number): void {
    this.db.prepare('DELETE FROM folders WHERE id = ?').run(id);
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npx vitest run test/unit/vms-repo.test.ts`
Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/db/vms-repo.ts test/unit/vms-repo.test.ts
git commit -m "feat(db): VM and folder repository"
```

---

## Phase 4 — SSH session + prompt detector

### Task 8: Prompt detector (the core feature)

**Files:**
- Create: `src/main/ssh/prompt-detector.ts`, `test/unit/prompt-detector.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/prompt-detector.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PromptDetector } from '../../src/main/ssh/prompt-detector';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('PromptDetector', () => {
  it('detects ssh login prompt within first 5s', () => {
    const onMatch = vi.fn();
    const d = new PromptDetector(onMatch);
    d.feed("admin@10.0.0.1's password: ");
    expect(onMatch).toHaveBeenCalledWith('login');
  });

  it('detects bare "password:" within first 5s as login', () => {
    const onMatch = vi.fn();
    const d = new PromptDetector(onMatch);
    d.feed('password: ');
    expect(onMatch).toHaveBeenCalledWith('login');
  });

  it('treats bare "Password:" after 5s as sudo', () => {
    const onMatch = vi.fn();
    const d = new PromptDetector(onMatch);
    vi.advanceTimersByTime(6_000);
    d.feed('Password: ');
    expect(onMatch).toHaveBeenCalledWith('sudo');
  });

  it('detects sudo prompt with username', () => {
    const onMatch = vi.fn();
    const d = new PromptDetector(onMatch);
    vi.advanceTimersByTime(6_000);
    d.feed('[sudo] password for admin: ');
    expect(onMatch).toHaveBeenCalledWith('sudo');
  });

  it('detects key passphrase prompt', () => {
    const onMatch = vi.fn();
    const d = new PromptDetector(onMatch);
    d.feed("Enter passphrase for key '/home/u/.ssh/id_rsa': ");
    expect(onMatch).toHaveBeenCalledWith('key-passphrase');
  });

  it('does NOT fire on "password:" mid-line in a log', () => {
    const onMatch = vi.fn();
    const d = new PromptDetector(onMatch);
    d.feed('error: invalid password: format on line 42\n');
    expect(onMatch).not.toHaveBeenCalled();
  });

  it('debounces repeated prompts within 2s', () => {
    const onMatch = vi.fn();
    const d = new PromptDetector(onMatch);
    d.feed("admin@host's password: ");
    d.feed("admin@host's password: ");
    expect(onMatch).toHaveBeenCalledTimes(1);
  });

  it('fires again after debounce window', () => {
    const onMatch = vi.fn();
    const d = new PromptDetector(onMatch);
    d.feed("admin@host's password: ");
    vi.advanceTimersByTime(2_100);
    d.feed("admin@host's password: ");
    expect(onMatch).toHaveBeenCalledTimes(2);
  });

  it('reassembles a prompt split across chunks', () => {
    const onMatch = vi.fn();
    const d = new PromptDetector(onMatch);
    d.feed("admin@host's pass");
    d.feed('word: ');
    expect(onMatch).toHaveBeenCalledWith('login');
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx vitest run test/unit/prompt-detector.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/main/ssh/prompt-detector.ts`**

```ts
import { PromptType } from '@shared/types';
import { DEFAULTS } from '@shared/constants';

const PATTERNS: Array<{ type: PromptType; re: RegExp; phase: 'login' | 'any' }> = [
  { type: 'key-passphrase', re: /Enter passphrase for key '[^']*':\s*$/i, phase: 'any' },
  { type: 'login', re: /\S+@\S+'s password:\s*$/i, phase: 'any' },
  { type: 'sudo', re: /\[sudo\] password for \S+:\s*$/i, phase: 'any' },
  { type: 'login', re: /password:\s*$/i, phase: 'login' },
  { type: 'sudo', re: /password:\s*$/i, phase: 'any' },
];

export class PromptDetector {
  private buffer = '';
  private startedAt = Date.now();
  private lastFireAt = 0;

  constructor(
    private readonly onMatch: (type: PromptType) => void,
    private readonly bufferBytes: number = DEFAULTS.PTY_BUFFER_BYTES,
    private readonly debounceMs: number = DEFAULTS.PROMPT_DEBOUNCE_MS,
    private readonly loginWindowMs: number = DEFAULTS.LOGIN_PROMPT_WINDOW_MS,
  ) {}

  feed(chunk: string): void {
    this.buffer = (this.buffer + chunk).slice(-this.bufferBytes);
    const now = Date.now();
    if (now - this.lastFireAt < this.debounceMs) return;

    const inLoginWindow = now - this.startedAt < this.loginWindowMs;
    const tail = this.lastLine(this.buffer);

    for (const { type, re, phase } of PATTERNS) {
      if (phase === 'login' && !inLoginWindow) continue;
      if (re.test(tail)) {
        this.lastFireAt = now;
        this.onMatch(type);
        return;
      }
    }
  }

  reset(): void {
    this.buffer = '';
    this.startedAt = Date.now();
    this.lastFireAt = 0;
  }

  private lastLine(s: string): string {
    const idx = Math.max(s.lastIndexOf('\n'), s.lastIndexOf('\r'));
    return idx >= 0 ? s.slice(idx + 1) : s;
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npx vitest run test/unit/prompt-detector.test.ts`
Expected: 9 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/ssh/prompt-detector.ts test/unit/prompt-detector.test.ts
git commit -m "feat(ssh): prompt detector with login/sudo/key-passphrase patterns"
```

---

### Task 9: SSH session (one PTY per session)

**Files:**
- Create: `src/main/ssh/session.ts`

- [ ] **Step 1: Write `src/main/ssh/session.ts`**

This module is thin glue over node-pty. We don't unit-test it directly — it's covered by integration in Task 10 and E2E later.

```ts
import { randomUUID } from 'node:crypto';
import { spawn, IPty } from 'node-pty';
import { EventEmitter } from 'node:events';
import { Vm, PromptType, SessionState } from '@shared/types';
import { PromptDetector } from './prompt-detector';

export interface SessionEvents {
  data: (chunk: string) => void;
  state: (state: SessionState) => void;
  promptDetected: (type: PromptType) => void;
  exit: (code: number) => void;
}

export class SshSession extends EventEmitter {
  readonly id: string = randomUUID();
  readonly vmId: number;
  private readonly pty: IPty;
  private readonly detector: PromptDetector;
  private state: SessionState;

  constructor(vm: Vm, cols = 80, rows = 24) {
    super();
    this.vmId = vm.id;
    this.state = { sessionId: this.id, vmId: vm.id, status: 'connecting', latencyMs: null, startedAt: Date.now() };

    const args: string[] = ['-p', String(vm.port)];
    if (vm.keyPath) args.push('-i', vm.keyPath);
    args.push('-o', 'StrictHostKeyChecking=accept-new');
    args.push(`${vm.username}@${vm.host}`);

    this.pty = spawn('ssh', args, {
      name: 'xterm-256color',
      cols,
      rows,
      env: process.env as Record<string, string>,
    });

    this.detector = new PromptDetector((type) => this.emit('promptDetected', type));

    this.pty.onData((chunk) => {
      this.detector.feed(chunk);
      this.emit('data', chunk);
      if (this.state.status === 'connecting' && /[$#]\s/.test(chunk)) {
        this.state = { ...this.state, status: 'connected' };
        this.emit('state', this.state);
      }
    });

    this.pty.onExit(({ exitCode }) => {
      this.state = { ...this.state, status: 'closed' };
      this.emit('state', this.state);
      this.emit('exit', exitCode);
    });
  }

  write(data: string): void {
    this.pty.write(data);
  }

  resize(cols: number, rows: number): void {
    this.pty.resize(cols, rows);
  }

  getState(): SessionState {
    return this.state;
  }

  kill(): void {
    this.pty.kill();
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -p tsconfig.main.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/ssh/session.ts
git commit -m "feat(ssh): one PTY per session with prompt detection wired in"
```

---

### Task 10: Session manager

**Files:**
- Create: `src/main/ssh/session-manager.ts`, `test/unit/session-manager.test.ts`

- [ ] **Step 1: Write the failing test (uses a fake session)**

```ts
// test/unit/session-manager.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { SessionManager } from '../../src/main/ssh/session-manager';

class FakeSession extends EventEmitter {
  id = 'fake-' + Math.random();
  vmId = 1;
  killed = false;
  written: string[] = [];
  write(s: string) { this.written.push(s); }
  resize() {}
  getState() { return { sessionId: this.id, vmId: 1, status: 'connecting' as const, latencyMs: null, startedAt: 0 }; }
  kill() { this.killed = true; this.emit('exit', 0); }
}

describe('SessionManager', () => {
  it('tracks sessions and removes them on exit', () => {
    const m = new SessionManager();
    const s = new FakeSession();
    m.register(s as any);
    expect(m.list()).toHaveLength(1);
    s.emit('exit', 0);
    expect(m.list()).toHaveLength(0);
  });

  it('routes input to the right session', () => {
    const m = new SessionManager();
    const s = new FakeSession();
    m.register(s as any);
    m.write(s.id, 'hello');
    expect(s.written).toEqual(['hello']);
  });

  it('kills a session on close()', () => {
    const m = new SessionManager();
    const s = new FakeSession();
    m.register(s as any);
    m.close(s.id);
    expect(s.killed).toBe(true);
  });

  it('write on unknown session is a no-op', () => {
    const m = new SessionManager();
    expect(() => m.write('nonexistent', 'x')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx vitest run test/unit/session-manager.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/main/ssh/session-manager.ts`**

```ts
import { SshSession } from './session';

export class SessionManager {
  private readonly sessions = new Map<string, SshSession>();

  register(session: SshSession): void {
    this.sessions.set(session.id, session);
    session.on('exit', () => this.sessions.delete(session.id));
  }

  get(sessionId: string): SshSession | undefined {
    return this.sessions.get(sessionId);
  }

  list(): SshSession[] {
    return Array.from(this.sessions.values());
  }

  write(sessionId: string, data: string): void {
    this.sessions.get(sessionId)?.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.sessions.get(sessionId)?.resize(cols, rows);
  }

  close(sessionId: string): void {
    this.sessions.get(sessionId)?.kill();
  }

  closeAll(): void {
    for (const s of this.sessions.values()) s.kill();
    this.sessions.clear();
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npx vitest run test/unit/session-manager.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/ssh/session-manager.ts test/unit/session-manager.test.ts
git commit -m "feat(ssh): session manager with lifecycle tracking"
```

---

## Phase 5 — Clipboard + logger

### Task 11: Clipboard with auto-clear

**Files:**
- Create: `src/main/clipboard.ts`, `test/unit/clipboard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/clipboard.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClipboardService } from '../../src/main/clipboard';

const fakeClipboard = {
  text: '',
  writeText(t: string) { this.text = t; },
  clear() { this.text = ''; },
};

beforeEach(() => { vi.useFakeTimers(); fakeClipboard.text = ''; });
afterEach(() => { vi.useRealTimers(); });

describe('ClipboardService', () => {
  it('writes the secret', () => {
    const c = new ClipboardService(fakeClipboard as any, 1000);
    c.copySecret('hunter2');
    expect(fakeClipboard.text).toBe('hunter2');
  });

  it('clears after the configured TTL', () => {
    const c = new ClipboardService(fakeClipboard as any, 1000);
    c.copySecret('hunter2');
    vi.advanceTimersByTime(999);
    expect(fakeClipboard.text).toBe('hunter2');
    vi.advanceTimersByTime(1);
    expect(fakeClipboard.text).toBe('');
  });

  it('resets the timer when a second copy happens', () => {
    const c = new ClipboardService(fakeClipboard as any, 1000);
    c.copySecret('first');
    vi.advanceTimersByTime(500);
    c.copySecret('second');
    vi.advanceTimersByTime(800);
    expect(fakeClipboard.text).toBe('second');
    vi.advanceTimersByTime(300);
    expect(fakeClipboard.text).toBe('');
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx vitest run test/unit/clipboard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/main/clipboard.ts`**

```ts
import { DEFAULTS } from '@shared/constants';

export interface ClipboardLike {
  writeText(text: string): void;
  clear(): void;
}

export class ClipboardService {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly clipboard: ClipboardLike,
    private readonly ttlMs: number = DEFAULTS.CLIPBOARD_CLEAR_MS,
  ) {}

  copySecret(secret: string): void {
    this.clipboard.writeText(secret);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.clipboard.clear();
      this.timer = null;
    }, this.ttlMs);
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npx vitest run test/unit/clipboard.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/clipboard.ts test/unit/clipboard.test.ts
git commit -m "feat(main): clipboard service with auto-clear timer"
```

---

### Task 12: Redaction-aware logger

**Files:**
- Create: `src/main/logger.ts`

- [ ] **Step 1: Write `src/main/logger.ts`**

```ts
type Level = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private readonly redactions = new Set<string>();

  registerSecret(secret: string): void {
    if (secret.length >= 4) this.redactions.add(secret);
  }

  unregisterSecret(secret: string): void {
    this.redactions.delete(secret);
  }

  log(level: Level, msg: string, meta?: Record<string, unknown>): void {
    let safe = msg;
    for (const s of this.redactions) safe = safe.split(s).join('[REDACTED]');
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](`[${level}]`, safe, meta ?? '');
  }
}

export const logger = new Logger();
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -p tsconfig.main.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/logger.ts
git commit -m "feat(main): redaction-aware logger"
```

---

## Phase 6 — Electron shell + IPC

### Task 13: Preload script (typed IPC bridge)

**Files:**
- Create: `src/preload/preload.ts`

- [ ] **Step 1: Write `src/preload/preload.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/constants';
import { Vm, VmInput, Folder, VaultEntry, SessionState, ToastPayload, PromptType } from '@shared/types';

const api = {
  vault: {
    state: (): Promise<'empty' | 'locked' | 'unlocked'> => ipcRenderer.invoke(IPC.VAULT_STATE),
    init: (masterPw: string) => ipcRenderer.invoke(IPC.VAULT_INIT, masterPw),
    unlock: (masterPw: string) => ipcRenderer.invoke(IPC.VAULT_UNLOCK, masterPw),
    lock: () => ipcRenderer.invoke(IPC.VAULT_LOCK),
    setSecret: (vmId: number, entry: VaultEntry) => ipcRenderer.invoke(IPC.VAULT_SET_SECRET, vmId, entry),
    onStateChanged: (cb: (state: 'empty' | 'locked' | 'unlocked') => void) =>
      ipcRenderer.on(IPC.VAULT_STATE_CHANGED, (_e, s) => cb(s)),
  },
  vms: {
    list: (): Promise<Vm[]> => ipcRenderer.invoke(IPC.VMS_LIST),
    create: (input: VmInput, secret: VaultEntry): Promise<Vm> => ipcRenderer.invoke(IPC.VMS_CREATE, input, secret),
    update: (id: number, input: VmInput, secret: VaultEntry) => ipcRenderer.invoke(IPC.VMS_UPDATE, id, input, secret),
    delete: (id: number) => ipcRenderer.invoke(IPC.VMS_DELETE, id),
    touchUsed: (id: number) => ipcRenderer.invoke(IPC.VMS_TOUCH_USED, id),
  },
  folders: {
    list: (): Promise<Folder[]> => ipcRenderer.invoke(IPC.FOLDERS_LIST),
    create: (f: Omit<Folder, 'id'>) => ipcRenderer.invoke(IPC.FOLDERS_CREATE, f),
    delete: (id: number) => ipcRenderer.invoke(IPC.FOLDERS_DELETE, id),
  },
  session: {
    start: (vmId: number, cols: number, rows: number): Promise<string> =>
      ipcRenderer.invoke(IPC.SESSION_START, vmId, cols, rows),
    input: (sessionId: string, data: string) => ipcRenderer.invoke(IPC.SESSION_INPUT, sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.invoke(IPC.SESSION_RESIZE, sessionId, cols, rows),
    close: (sessionId: string) => ipcRenderer.invoke(IPC.SESSION_CLOSE, sessionId),
    pastePassword: (sessionId: string, type: PromptType) =>
      ipcRenderer.invoke(IPC.PASTE_PASSWORD, sessionId, type),
    onOutput: (cb: (sessionId: string, chunk: string) => void) =>
      ipcRenderer.on(IPC.SESSION_OUTPUT, (_e, sid, c) => cb(sid, c)),
    onState: (cb: (state: SessionState) => void) =>
      ipcRenderer.on(IPC.SESSION_STATE, (_e, s) => cb(s)),
    onToast: (cb: (toast: ToastPayload) => void) =>
      ipcRenderer.on(IPC.SESSION_TOAST, (_e, t) => cb(t)),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
```

- [ ] **Step 2: Add `Api` to global window type**

Append to `src/shared/types.ts`:

```ts
declare global {
  interface Window {
    api: import('../preload/preload').Api;
  }
}
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc -p tsconfig.preload.json --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/preload/preload.ts src/shared/types.ts
git commit -m "feat(preload): typed IPC bridge exposed as window.api"
```

---

### Task 14: IPC handlers in main

**Files:**
- Create: `src/main/ipc.ts`

- [ ] **Step 1: Write `src/main/ipc.ts`**

```ts
import { ipcMain, BrowserWindow, clipboard } from 'electron';
import type Database from 'better-sqlite3';
import { IPC } from '@shared/constants';
import { Vault } from './vault/vault';
import { VmsRepo } from './db/vms-repo';
import { SessionManager } from './ssh/session-manager';
import { SshSession } from './ssh/session';
import { ClipboardService } from './clipboard';
import { logger } from './logger';
import { Vm, VmInput, VaultEntry, Folder, PromptType, ToastPayload } from '@shared/types';

interface Deps {
  db: Database.Database;
  repo: VmsRepo;
  vault: Vault;
  sessions: SessionManager;
  clip: ClipboardService;
  mainWindow: () => BrowserWindow | null;
}

function pickSecretByPrompt(entry: VaultEntry, type: PromptType): string | undefined {
  switch (type) {
    case 'login':
    case 'generic':       return entry.password;
    case 'sudo':          return entry.sudoPassword;
    case 'key-passphrase':return entry.keyPassphrase;
  }
}

export function registerIpc(d: Deps): void {
  // vault
  ipcMain.handle(IPC.VAULT_STATE, () => d.vault.state());
  ipcMain.handle(IPC.VAULT_INIT, async (_e, pw: string) => { await d.vault.init(pw); });
  ipcMain.handle(IPC.VAULT_UNLOCK, async (_e, pw: string) => { await d.vault.unlock(pw); });
  ipcMain.handle(IPC.VAULT_LOCK, async () => { await d.vault.lock(); });
  ipcMain.handle(IPC.VAULT_SET_SECRET, async (_e, vmId: number, entry: VaultEntry) => {
    const vm = d.repo.getVm(vmId);
    if (!vm) throw new Error('vm not found');
    await d.vault.setSecret(vm.vaultRef, entry);
  });

  // vms
  ipcMain.handle(IPC.VMS_LIST, () => d.repo.listVms());
  ipcMain.handle(IPC.VMS_CREATE, async (_e, input: VmInput, secret: VaultEntry): Promise<Vm> => {
    const vm = d.repo.createVm(input);
    await d.vault.setSecret(vm.vaultRef, secret);
    return vm;
  });
  ipcMain.handle(IPC.VMS_UPDATE, async (_e, id: number, input: VmInput, secret: VaultEntry) => {
    const before = d.repo.getVm(id);
    if (!before) throw new Error('vm not found');
    d.repo.updateVm(id, input);
    await d.vault.setSecret(before.vaultRef, secret);
  });
  ipcMain.handle(IPC.VMS_DELETE, async (_e, id: number) => {
    const vm = d.repo.getVm(id);
    if (!vm) return;
    await d.vault.deleteSecret(vm.vaultRef);
    d.repo.deleteVm(id);
  });
  ipcMain.handle(IPC.VMS_TOUCH_USED, (_e, id: number) => d.repo.touchUsed(id));

  // folders
  ipcMain.handle(IPC.FOLDERS_LIST, () => d.repo.listFolders());
  ipcMain.handle(IPC.FOLDERS_CREATE, (_e, f: Omit<Folder, 'id'>) => d.repo.createFolder(f));
  ipcMain.handle(IPC.FOLDERS_DELETE, (_e, id: number) => d.repo.deleteFolder(id));

  // sessions
  ipcMain.handle(IPC.SESSION_START, async (_e, vmId: number, cols: number, rows: number) => {
    const vm = d.repo.getVm(vmId);
    if (!vm) throw new Error('vm not found');
    const session = new SshSession(vm, cols, rows);
    d.sessions.register(session);
    d.repo.touchUsed(vmId);

    session.on('data', (chunk: string) => {
      d.mainWindow()?.webContents.send(IPC.SESSION_OUTPUT, session.id, chunk);
    });
    session.on('state', (state) => {
      d.mainWindow()?.webContents.send(IPC.SESSION_STATE, state);
    });
    session.on('promptDetected', (type: PromptType) => {
      if (vm.autoCopyDisabled) {
        const toast: ToastPayload = { sessionId: session.id, vmId, promptType: type, hasSecret: false };
        d.mainWindow()?.webContents.send(IPC.SESSION_TOAST, toast);
        return;
      }
      const entry = d.vault.getSecret(vm.vaultRef);
      const secret = pickSecretByPrompt(entry, type);
      if (secret) {
        d.clip.copySecret(secret);
        logger.registerSecret(secret);
      }
      const toast: ToastPayload = { sessionId: session.id, vmId, promptType: type, hasSecret: !!secret };
      d.mainWindow()?.webContents.send(IPC.SESSION_TOAST, toast);
    });

    return session.id;
  });

  ipcMain.handle(IPC.SESSION_INPUT, (_e, sessionId: string, data: string) =>
    d.sessions.write(sessionId, data));
  ipcMain.handle(IPC.SESSION_RESIZE, (_e, sessionId: string, cols: number, rows: number) =>
    d.sessions.resize(sessionId, cols, rows));
  ipcMain.handle(IPC.SESSION_CLOSE, (_e, sessionId: string) => d.sessions.close(sessionId));

  ipcMain.handle(IPC.PASTE_PASSWORD, (_e, sessionId: string, type: PromptType) => {
    const session = d.sessions.get(sessionId);
    if (!session) return;
    const vm = d.repo.getVm(session.vmId);
    if (!vm) return;
    const entry = d.vault.getSecret(vm.vaultRef);
    const secret = pickSecretByPrompt(entry, type);
    if (secret) d.clip.copySecret(secret);
  });
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc -p tsconfig.main.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc.ts
git commit -m "feat(main): IPC handlers for vault, vms, folders, sessions"
```

---

### Task 15: Electron main entry — window + auto-lock

**Files:**
- Create: `src/main/index.ts`, `src/renderer/index.html`, `src/renderer/main.tsx`

- [ ] **Step 1: Write `src/main/index.ts`**

```ts
import { app, BrowserWindow, clipboard, powerMonitor, Menu, globalShortcut } from 'electron';
import path from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from './db/migrations';
import { VmsRepo } from './db/vms-repo';
import { Vault } from './vault/vault';
import { SessionManager } from './ssh/session-manager';
import { ClipboardService } from './clipboard';
import { registerIpc } from './ipc';
import { DEFAULTS } from '@shared/constants';

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '../renderer/index.html'));
  return win;
}

app.whenReady().then(() => {
  const userData = app.getPath('userData');
  const db = new Database(path.join(userData, 'vms.db'));
  migrate(db);
  const repo = new VmsRepo(db);
  const vault = new Vault(path.join(userData, 'vault.enc'));
  const sessions = new SessionManager();
  const clip = new ClipboardService({
    writeText: (t) => clipboard.writeText(t),
    clear: () => clipboard.clear(),
  });

  registerIpc({ db, repo, vault, sessions, clip, mainWindow: () => mainWindow });

  mainWindow = createWindow();

  // auto-lock on system events
  const lockAll = async () => {
    await vault.lock();
    sessions.closeAll();
    mainWindow?.webContents.send(IPC.VAULT_STATE_CHANGED, vault.state());
  };
  powerMonitor.on('lock-screen', () => { void lockAll(); });
  powerMonitor.on('suspend', () => { void lockAll(); });

  // ⌘L global shortcut (only when our window is focused)
  globalShortcut.register('CommandOrControl+L', () => {
    if (BrowserWindow.getFocusedWindow() === mainWindow) void lockAll();
  });

  // idle auto-lock — poll every 30s, lock if idleSeconds > AUTO_LOCK_MS / 1000
  setInterval(() => {
    if (vault.state() !== 'unlocked') return;
    if (powerMonitor.getSystemIdleTime() * 1000 > DEFAULTS.AUTO_LOCK_MS) void lockAll();
  }, 30_000);
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => globalShortcut.unregisterAll());
```

- [ ] **Step 2: Write `src/renderer/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'" />
    <title>Termius-Alt</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Write `src/renderer/main.tsx`**

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 4: Write a stub `src/renderer/App.tsx`**

```tsx
import React from 'react';

export function App() {
  return <div style={{ padding: 20 }}>Termius-Alt — boot OK</div>;
}
```

- [ ] **Step 5: Build and smoke-launch**

Run:
```bash
npm run build:main && npm run build:renderer && npx electron .
```
Expected: window opens, shows "Termius-Alt — boot OK". Close it.

- [ ] **Step 6: Commit**

```bash
git add src/main/index.ts src/renderer/index.html src/renderer/main.tsx src/renderer/App.tsx
git commit -m "feat(main): electron shell, IPC registration, auto-lock triggers"
```

---

## Phase 7 — Renderer: unlock + Zustand state

### Task 16: Zustand stores + Unlock screen

**Files:**
- Create: `src/renderer/state/vault-store.ts`, `src/renderer/state/vms-store.ts`, `src/renderer/state/sessions-store.ts`, `src/renderer/screens/Unlock.tsx`

- [ ] **Step 1: Write `src/renderer/state/vault-store.ts`**

```ts
import { create } from 'zustand';

type VaultState = 'empty' | 'locked' | 'unlocked' | 'unknown';

interface VaultStore {
  state: VaultState;
  refresh: () => Promise<void>;
  init: (pw: string) => Promise<void>;
  unlock: (pw: string) => Promise<void>;
  lock: () => Promise<void>;
}

export const useVaultStore = create<VaultStore>((set) => ({
  state: 'unknown',
  refresh: async () => set({ state: await window.api.vault.state() }),
  init: async (pw) => { await window.api.vault.init(pw); set({ state: 'unlocked' }); },
  unlock: async (pw) => { await window.api.vault.unlock(pw); set({ state: 'unlocked' }); },
  lock: async () => { await window.api.vault.lock(); set({ state: 'locked' }); },
}));
```

- [ ] **Step 2: Write `src/renderer/state/vms-store.ts`**

```ts
import { create } from 'zustand';
import { Vm, Folder, VmInput, VaultEntry } from '@shared/types';

interface VmsStore {
  vms: Vm[];
  folders: Folder[];
  refresh: () => Promise<void>;
  create: (input: VmInput, secret: VaultEntry) => Promise<Vm>;
  update: (id: number, input: VmInput, secret: VaultEntry) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const useVmsStore = create<VmsStore>((set, get) => ({
  vms: [],
  folders: [],
  refresh: async () => {
    const [vms, folders] = await Promise.all([window.api.vms.list(), window.api.folders.list()]);
    set({ vms, folders });
  },
  create: async (input, secret) => {
    const vm = await window.api.vms.create(input, secret);
    await get().refresh();
    return vm;
  },
  update: async (id, input, secret) => {
    await window.api.vms.update(id, input, secret);
    await get().refresh();
  },
  remove: async (id) => {
    await window.api.vms.delete(id);
    await get().refresh();
  },
}));
```

- [ ] **Step 3: Write `src/renderer/state/sessions-store.ts`**

```ts
import { create } from 'zustand';
import { SessionState, ToastPayload } from '@shared/types';

export interface Tab {
  sessionId: string;
  vmId: number;
  label: string;
  state: SessionState['status'];
}

interface SessionsStore {
  tabs: Tab[];
  activeTabId: string | null;
  toasts: ToastPayload[];
  addTab: (tab: Tab) => void;
  removeTab: (sessionId: string) => void;
  setActive: (sessionId: string) => void;
  updateState: (state: SessionState) => void;
  pushToast: (t: ToastPayload) => void;
  dismissToast: (sessionId: string) => void;
}

export const useSessionsStore = create<SessionsStore>((set) => ({
  tabs: [],
  activeTabId: null,
  toasts: [],
  addTab: (tab) => set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.sessionId })),
  removeTab: (id) => set((s) => ({
    tabs: s.tabs.filter((t) => t.sessionId !== id),
    activeTabId: s.activeTabId === id ? s.tabs.find((t) => t.sessionId !== id)?.sessionId ?? null : s.activeTabId,
  })),
  setActive: (id) => set({ activeTabId: id }),
  updateState: (state) => set((s) => ({
    tabs: s.tabs.map((t) => t.sessionId === state.sessionId ? { ...t, state: state.status } : t),
  })),
  pushToast: (t) => set((s) => ({ toasts: [...s.toasts.filter((x) => x.sessionId !== t.sessionId), t] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.sessionId !== id) })),
}));
```

- [ ] **Step 4: Write `src/renderer/screens/Unlock.tsx`**

```tsx
import React, { useState } from 'react';
import { useVaultStore } from '../state/vault-store';

export function Unlock() {
  const state = useVaultStore((s) => s.state);
  const init = useVaultStore((s) => s.init);
  const unlock = useVaultStore((s) => s.unlock);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isInit = state === 'empty';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (isInit) {
        if (pw.length < 12) { setErr('Master password must be at least 12 characters.'); return; }
        if (pw !== pw2) { setErr('Passwords do not match.'); return; }
        await init(pw);
      } else {
        try {
          await unlock(pw);
        } catch {
          setErr('Incorrect password.');
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    } finally {
      setBusy(false);
      setPw(''); setPw2('');
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', fontFamily: 'system-ui' }}>
      <form onSubmit={submit} style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 style={{ margin: 0 }}>{isInit ? 'Create master password' : 'Unlock'}</h1>
        {isInit && (
          <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
            This password encrypts your saved VM credentials. There is no recovery — if you lose it, the vault is gone.
          </p>
        )}
        <input
          type="password"
          value={pw}
          autoFocus
          placeholder="master password"
          onChange={(e) => setPw(e.target.value)}
          disabled={busy}
          style={{ padding: 8, fontSize: 14 }}
        />
        {isInit && (
          <input
            type="password"
            value={pw2}
            placeholder="confirm"
            onChange={(e) => setPw2(e.target.value)}
            disabled={busy}
            style={{ padding: 8, fontSize: 14 }}
          />
        )}
        {err && <div style={{ color: '#b00', fontSize: 13 }}>{err}</div>}
        <button type="submit" disabled={busy || !pw} style={{ padding: 8 }}>
          {isInit ? 'Create vault' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Wire Unlock into `src/renderer/App.tsx`**

```tsx
import React, { useEffect } from 'react';
import { useVaultStore } from './state/vault-store';
import { Unlock } from './screens/Unlock';
import { Main } from './screens/Main';

export function App() {
  const state = useVaultStore((s) => s.state);
  const refresh = useVaultStore((s) => s.refresh);

  useEffect(() => {
    refresh();
    window.api.vault.onStateChanged(() => { void refresh(); });
  }, [refresh]);

  if (state === 'unknown') return null;
  if (state !== 'unlocked') return <Unlock />;
  return <Main />;
}
```

- [ ] **Step 6: Add a stub `src/renderer/screens/Main.tsx`**

```tsx
import React from 'react';
export function Main() {
  return <div style={{ padding: 20 }}>Unlocked — main UI goes here</div>;
}
```

- [ ] **Step 7: Build and smoke-launch**

Run: `npm run build && npx electron .`
Expected: first launch shows "Create master password"; after creating, shows "Unlocked — main UI goes here". Close.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/
git commit -m "feat(renderer): zustand stores and unlock screen"
```

---

## Phase 8 — Main UI: sidebar, VM form, terminal, tabs, toast

### Task 17: Sidebar with VM tree and search

**Files:**
- Create: `src/renderer/components/Sidebar/Sidebar.tsx`, `src/renderer/components/Sidebar/Sidebar.css`

- [ ] **Step 1: Write `src/renderer/components/Sidebar/Sidebar.tsx`**

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useVmsStore } from '../../state/vms-store';
import { useSessionsStore } from '../../state/sessions-store';
import { Vm } from '@shared/types';
import './Sidebar.css';

interface Props {
  onNewVm: () => void;
  onEditVm: (vm: Vm) => void;
}

export function Sidebar({ onNewVm, onEditVm }: Props) {
  const { vms, folders, refresh, remove } = useVmsStore();
  const addTab = useSessionsStore((s) => s.addTab);
  const [query, setQuery] = useState('');

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vms;
    return vms.filter((v) =>
      v.label.toLowerCase().includes(q) ||
      v.host.toLowerCase().includes(q) ||
      v.username.toLowerCase().includes(q)
    );
  }, [vms, query]);

  const grouped = useMemo(() => {
    const map = new Map<number | null, Vm[]>();
    for (const v of filtered) {
      const list = map.get(v.folderId) ?? [];
      list.push(v);
      map.set(v.folderId, list);
    }
    return map;
  }, [filtered]);

  async function connect(vm: Vm) {
    const sessionId = await window.api.session.start(vm.id, 80, 24);
    addTab({ sessionId, vmId: vm.id, label: vm.label, state: 'connecting' });
  }

  return (
    <aside className="sidebar">
      <input
        className="sidebar-search"
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {folders.map((f) => (
        <div key={f.id} className="sidebar-folder">
          <div className="sidebar-folder-name">▼ {f.name}</div>
          {(grouped.get(f.id) ?? []).map((vm) => (
            <VmRow key={vm.id} vm={vm} onConnect={() => connect(vm)} onEdit={() => onEditVm(vm)} onDelete={() => remove(vm.id)} />
          ))}
        </div>
      ))}
      {(grouped.get(null) ?? []).length > 0 && (
        <div className="sidebar-folder">
          <div className="sidebar-folder-name">▼ Uncategorized</div>
          {(grouped.get(null) ?? []).map((vm) => (
            <VmRow key={vm.id} vm={vm} onConnect={() => connect(vm)} onEdit={() => onEditVm(vm)} onDelete={() => remove(vm.id)} />
          ))}
        </div>
      )}
      <button className="sidebar-new" onClick={onNewVm}>+ New VM</button>
    </aside>
  );
}

function VmRow({ vm, onConnect, onEdit, onDelete }: { vm: Vm; onConnect: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="vm-row" onDoubleClick={onConnect}>
      <span className="vm-label">{vm.label}</span>
      <span className="vm-actions">
        <button onClick={onConnect} title="Connect">▶</button>
        <button onClick={onEdit} title="Edit">✎</button>
        <button onClick={onDelete} title="Delete">✕</button>
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/renderer/components/Sidebar/Sidebar.css`**

```css
.sidebar { width: 260px; padding: 8px; background: #1e1e1e; color: #eee; height: 100vh; overflow: auto; font-family: system-ui; }
.sidebar-search { width: 100%; padding: 6px; box-sizing: border-box; margin-bottom: 8px; background: #2a2a2a; border: 1px solid #333; color: #eee; }
.sidebar-folder { margin-bottom: 8px; }
.sidebar-folder-name { font-weight: 600; padding: 4px 0; opacity: 0.85; }
.vm-row { display: flex; justify-content: space-between; padding: 4px 6px; border-radius: 4px; cursor: pointer; }
.vm-row:hover { background: #2a2a2a; }
.vm-actions button { background: none; border: none; color: #aaa; cursor: pointer; margin-left: 2px; }
.vm-actions button:hover { color: #fff; }
.sidebar-new { width: 100%; padding: 6px; margin-top: 8px; background: #2a2a2a; color: #eee; border: 1px solid #333; cursor: pointer; }
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc -p tsconfig.renderer.json --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Sidebar/
git commit -m "feat(renderer): sidebar with VM tree, search, and connect"
```

---

### Task 18: VM edit form (modal)

**Files:**
- Create: `src/renderer/components/VmEditForm/VmEditForm.tsx`, `src/renderer/components/VmEditForm/VmEditForm.css`

- [ ] **Step 1: Write `src/renderer/components/VmEditForm/VmEditForm.tsx`**

```tsx
import React, { useState } from 'react';
import { Vm, VmInput, VaultEntry, AuthMethod } from '@shared/types';
import { useVmsStore } from '../../state/vms-store';
import './VmEditForm.css';

interface Props {
  initial: Vm | null;
  onClose: () => void;
}

export function VmEditForm({ initial, onClose }: Props) {
  const { create, update } = useVmsStore();
  const [label, setLabel] = useState(initial?.label ?? '');
  const [host, setHost] = useState(initial?.host ?? '');
  const [port, setPort] = useState(initial?.port ?? 22);
  const [username, setUsername] = useState(initial?.username ?? '');
  const [authMethod, setAuthMethod] = useState<AuthMethod>(initial?.authMethod ?? 'password');
  const [keyPath, setKeyPath] = useState(initial?.keyPath ?? '');
  const [password, setPassword] = useState('');
  const [sudoPassword, setSudoPassword] = useState('');
  const [keyPassphrase, setKeyPassphrase] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const input: VmInput = {
      folderId: initial?.folderId ?? null,
      label, host, port, username, authMethod,
      keyPath: authMethod === 'password' ? null : (keyPath || null),
    };
    const secret: VaultEntry = {
      password: authMethod !== 'key' ? password || undefined : undefined,
      sudoPassword: sudoPassword || undefined,
      keyPassphrase: authMethod !== 'password' ? keyPassphrase || undefined : undefined,
    };
    if (initial) await update(initial.id, input, secret);
    else await create(input, secret);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="vm-form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{initial ? 'Edit VM' : 'New VM'}</h2>
        <label>Label <input value={label} onChange={(e) => setLabel(e.target.value)} required /></label>
        <label>Host  <input value={host} onChange={(e) => setHost(e.target.value)} required /></label>
        <label>Port  <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} /></label>
        <label>User  <input value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
        <label>Auth
          <select value={authMethod} onChange={(e) => setAuthMethod(e.target.value as AuthMethod)}>
            <option value="password">Password</option>
            <option value="key">Key</option>
            <option value="key+password">Key + Password</option>
          </select>
        </label>
        {authMethod !== 'password' && (
          <>
            <label>Key path <input value={keyPath} onChange={(e) => setKeyPath(e.target.value)} placeholder="~/.ssh/id_rsa" /></label>
            <label>Key passphrase <input type="password" value={keyPassphrase} onChange={(e) => setKeyPassphrase(e.target.value)} /></label>
          </>
        )}
        {authMethod !== 'key' && (
          <label>Password <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        )}
        <label>Sudo password <input type="password" value={sudoPassword} onChange={(e) => setSudoPassword(e.target.value)} /></label>
        <div className="form-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit">{initial ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/renderer/components/VmEditForm/VmEditForm.css`**

```css
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: grid; place-items: center; z-index: 100; }
.vm-form { background: #222; color: #eee; padding: 20px; border-radius: 8px; min-width: 360px; display: flex; flex-direction: column; gap: 10px; }
.vm-form label { display: flex; flex-direction: column; font-size: 13px; gap: 4px; }
.vm-form input, .vm-form select { padding: 6px; background: #1a1a1a; border: 1px solid #444; color: #eee; }
.form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc -p tsconfig.renderer.json --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/VmEditForm/
git commit -m "feat(renderer): VM create/edit modal form"
```

---

### Task 19: Terminal component (xterm.js wrapper)

**Files:**
- Create: `src/renderer/components/Terminal/Terminal.tsx`

- [ ] **Step 1: Write `src/renderer/components/Terminal/Terminal.tsx`**

```tsx
import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface Props {
  sessionId: string;
  active: boolean;
}

export function Terminal({ sessionId, active }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const term = new XTerm({ fontFamily: 'Menlo, Monaco, monospace', fontSize: 13, theme: { background: '#1e1e1e' } });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(ref.current);
    fit.fit();
    xtermRef.current = term;
    fitRef.current = fit;

    term.onData((data) => { void window.api.session.input(sessionId, data); });
    term.onResize(({ cols, rows }) => { void window.api.session.resize(sessionId, cols, rows); });

    window.api.session.onOutput((sid, chunk) => {
      if (sid === sessionId) term.write(chunk);
    });

    const ro = new ResizeObserver(() => fit.fit());
    ro.observe(ref.current);

    return () => { ro.disconnect(); term.dispose(); xtermRef.current = null; };
  }, [sessionId]);

  useEffect(() => {
    if (active && fitRef.current) {
      requestAnimationFrame(() => fitRef.current?.fit());
      xtermRef.current?.focus();
    }
  }, [active]);

  return <div ref={ref} style={{ flex: 1, display: active ? 'block' : 'none' }} />;
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc -p tsconfig.renderer.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Terminal/
git commit -m "feat(renderer): xterm.js terminal component wired to PTY"
```

---

### Task 20: Tab bar

**Files:**
- Create: `src/renderer/components/TabBar/TabBar.tsx`, `src/renderer/components/TabBar/TabBar.css`

- [ ] **Step 1: Write `src/renderer/components/TabBar/TabBar.tsx`**

```tsx
import React from 'react';
import { useSessionsStore } from '../../state/sessions-store';
import './TabBar.css';

export function TabBar() {
  const { tabs, activeTabId, setActive, removeTab } = useSessionsStore();

  async function close(id: string) {
    await window.api.session.close(id);
    removeTab(id);
  }

  const stateColor = (s: string) =>
    s === 'connected' ? '#5cb85c' : s === 'connecting' ? '#f0ad4e' : s === 'error' || s === 'closed' ? '#d9534f' : '#888';

  return (
    <div className="tab-bar">
      {tabs.map((t) => (
        <div key={t.sessionId}
             className={`tab ${activeTabId === t.sessionId ? 'active' : ''}`}
             onClick={() => setActive(t.sessionId)}>
          <span className="tab-dot" style={{ background: stateColor(t.state) }} />
          <span className="tab-label">{t.label}</span>
          <button className="tab-close" onClick={(e) => { e.stopPropagation(); close(t.sessionId); }}>×</button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write `src/renderer/components/TabBar/TabBar.css`**

```css
.tab-bar { display: flex; background: #161616; border-bottom: 1px solid #2a2a2a; font-family: system-ui; }
.tab { display: flex; align-items: center; gap: 6px; padding: 6px 12px; cursor: pointer; border-right: 1px solid #2a2a2a; color: #ccc; font-size: 13px; }
.tab.active { background: #1e1e1e; color: #fff; }
.tab-dot { width: 8px; height: 8px; border-radius: 50%; }
.tab-close { background: none; border: none; color: #888; cursor: pointer; font-size: 14px; padding: 0 2px; }
.tab-close:hover { color: #fff; }
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/TabBar/
git commit -m "feat(renderer): tab bar with state dots and close buttons"
```

---

### Task 21: Toast overlay

**Files:**
- Create: `src/renderer/components/Toast/Toast.tsx`, `src/renderer/components/Toast/Toast.css`

- [ ] **Step 1: Write `src/renderer/components/Toast/Toast.tsx`**

```tsx
import React, { useEffect } from 'react';
import { useSessionsStore } from '../../state/sessions-store';
import { PromptType } from '@shared/types';
import './Toast.css';

const label: Record<PromptType, string> = {
  login: 'Login password',
  sudo: 'Sudo password',
  'key-passphrase': 'Key passphrase',
  generic: 'Password',
};

export function ToastOverlay() {
  const { toasts, dismissToast } = useSessionsStore();
  const activeTabId = useSessionsStore((s) => s.activeTabId);
  const toast = toasts.find((t) => t.sessionId === activeTabId);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => dismissToast(toast.sessionId), 6000);
    return () => clearTimeout(id);
  }, [toast, dismissToast]);

  if (!toast) return null;

  return (
    <div className="toast">
      <div className="toast-title">
        🔑 {toast.hasSecret ? `${label[toast.promptType]} copied` : `No saved ${label[toast.promptType].toLowerCase()} for this VM`}
      </div>
      {toast.hasSecret && <div className="toast-sub">Press ⌘V to paste</div>}
      <div className="toast-actions">
        <button onClick={() => dismissToast(toast.sessionId)}>Dismiss</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/renderer/components/Toast/Toast.css`**

```css
.toast { position: fixed; bottom: 20px; right: 20px; background: #2a2a2a; color: #fff; padding: 12px 16px; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.4); font-family: system-ui; font-size: 13px; min-width: 260px; z-index: 200; }
.toast-title { font-weight: 600; }
.toast-sub { opacity: 0.7; margin-top: 4px; }
.toast-actions { margin-top: 8px; display: flex; justify-content: flex-end; gap: 6px; }
.toast-actions button { background: #444; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; }
.toast-actions button:hover { background: #555; }
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Toast/
git commit -m "feat(renderer): toast overlay for prompt-detected events"
```

---

### Task 22: Main screen — wires sidebar + tab bar + terminals + toast

**Files:**
- Modify: `src/renderer/screens/Main.tsx`

- [ ] **Step 1: Replace `src/renderer/screens/Main.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar/Sidebar';
import { TabBar } from '../components/TabBar/TabBar';
import { Terminal } from '../components/Terminal/Terminal';
import { ToastOverlay } from '../components/Toast/Toast';
import { VmEditForm } from '../components/VmEditForm/VmEditForm';
import { useSessionsStore } from '../state/sessions-store';
import { Vm } from '@shared/types';

export function Main() {
  const { tabs, activeTabId, updateState, pushToast } = useSessionsStore();
  const [editing, setEditing] = useState<Vm | null | undefined>(undefined);

  useEffect(() => {
    window.api.session.onState((s) => updateState(s));
    window.api.session.onToast((t) => pushToast(t));
  }, [updateState, pushToast]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#1e1e1e' }}>
      <Sidebar onNewVm={() => setEditing(null)} onEditVm={(vm) => setEditing(vm)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TabBar />
        <div style={{ flex: 1, position: 'relative' }}>
          {tabs.map((t) => (
            <Terminal key={t.sessionId} sessionId={t.sessionId} active={t.sessionId === activeTabId} />
          ))}
        </div>
      </div>
      {editing !== undefined && <VmEditForm initial={editing} onClose={() => setEditing(undefined)} />}
      <ToastOverlay />
    </div>
  );
}
```

- [ ] **Step 2: Build and smoke-launch**

Run: `npm run build && npx electron .`
Expected: unlocked UI shows sidebar with "+ New VM" button and an empty tab bar. Create a VM pointing at any reachable SSH host (or `localhost` if you have sshd), then double-click to connect. A terminal tab opens and prompts for a password.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/screens/Main.tsx
git commit -m "feat(renderer): main screen wires sidebar/tabs/terminals/toast"
```

---

## Phase 9 — Quick-connect picker and hotkeys

### Task 23: ⌘K Quick-connect picker

**Files:**
- Create: `src/renderer/components/QuickConnect/QuickConnect.tsx`, `src/renderer/components/QuickConnect/QuickConnect.css`
- Modify: `src/renderer/screens/Main.tsx`

- [ ] **Step 1: Write `src/renderer/components/QuickConnect/QuickConnect.tsx`**

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useVmsStore } from '../../state/vms-store';
import { useSessionsStore } from '../../state/sessions-store';
import './QuickConnect.css';

interface Props { onClose: () => void; }

export function QuickConnect({ onClose }: Props) {
  const vms = useVmsStore((s) => s.vms);
  const addTab = useSessionsStore((s) => s.addTab);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vms
      .filter((v) => !q || v.label.toLowerCase().includes(q) || v.host.toLowerCase().includes(q))
      .slice(0, 10);
  }, [vms, query]);

  async function connect(idx: number) {
    const vm = matches[idx];
    if (!vm) return;
    const sessionId = await window.api.session.start(vm.id, 80, 24);
    addTab({ sessionId, vmId: vm.id, label: vm.label, state: 'connecting' });
    onClose();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') setHighlight((h) => Math.min(h + 1, matches.length - 1));
    else if (e.key === 'ArrowUp') setHighlight((h) => Math.max(h - 1, 0));
    else if (e.key === 'Enter') void connect(highlight);
  }

  return (
    <div className="qc-backdrop" onClick={onClose}>
      <div className="qc-panel" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          placeholder="Search VMs…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
          onKeyDown={onKey}
        />
        <ul>
          {matches.map((vm, i) => (
            <li key={vm.id} className={i === highlight ? 'highlight' : ''} onClick={() => connect(i)}>
              {vm.label} <span className="qc-host">{vm.username}@{vm.host}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/renderer/components/QuickConnect/QuickConnect.css`**

```css
.qc-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: grid; place-items: start center; padding-top: 80px; z-index: 150; }
.qc-panel { background: #222; color: #eee; padding: 12px; border-radius: 8px; width: 480px; font-family: system-ui; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
.qc-panel input { width: 100%; padding: 8px; box-sizing: border-box; background: #1a1a1a; color: #eee; border: 1px solid #333; font-size: 14px; }
.qc-panel ul { list-style: none; padding: 0; margin: 8px 0 0 0; }
.qc-panel li { padding: 6px 8px; border-radius: 4px; cursor: pointer; }
.qc-panel li.highlight, .qc-panel li:hover { background: #333; }
.qc-host { opacity: 0.6; font-size: 12px; margin-left: 8px; }
```

- [ ] **Step 3: Wire ⌘K, ⌘L, ⌘W, ⌘⇧P into `src/renderer/screens/Main.tsx`**

Replace `Main.tsx` with:

```tsx
import React, { useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar/Sidebar';
import { TabBar } from '../components/TabBar/TabBar';
import { Terminal } from '../components/Terminal/Terminal';
import { ToastOverlay } from '../components/Toast/Toast';
import { VmEditForm } from '../components/VmEditForm/VmEditForm';
import { QuickConnect } from '../components/QuickConnect/QuickConnect';
import { useSessionsStore } from '../state/sessions-store';
import { useVaultStore } from '../state/vault-store';
import { Vm } from '@shared/types';

export function Main() {
  const { tabs, activeTabId, updateState, pushToast, removeTab } = useSessionsStore();
  const lock = useVaultStore((s) => s.lock);
  const [editing, setEditing] = useState<Vm | null | undefined>(undefined);
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    window.api.session.onState((s) => updateState(s));
    window.api.session.onToast((t) => pushToast(t));
  }, [updateState, pushToast]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'k') { e.preventDefault(); setQuickOpen(true); }
      else if (e.key === 'l' && !e.shiftKey) { e.preventDefault(); void lock(); }
      else if (e.key === 'w') {
        e.preventDefault();
        if (activeTabId) { void window.api.session.close(activeTabId); removeTab(activeTabId); }
      }
      else if (e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        if (activeTabId) void window.api.session.pastePassword(activeTabId, 'login');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lock, activeTabId, removeTab]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#1e1e1e' }}>
      <Sidebar onNewVm={() => setEditing(null)} onEditVm={(vm) => setEditing(vm)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TabBar />
        <div style={{ flex: 1, position: 'relative' }}>
          {tabs.map((t) => (
            <Terminal key={t.sessionId} sessionId={t.sessionId} active={t.sessionId === activeTabId} />
          ))}
        </div>
      </div>
      {editing !== undefined && <VmEditForm initial={editing} onClose={() => setEditing(undefined)} />}
      {quickOpen && <QuickConnect onClose={() => setQuickOpen(false)} />}
      <ToastOverlay />
    </div>
  );
}
```

- [ ] **Step 4: Build and smoke-test**

Run: `npm run build && npx electron .`
Expected: ⌘K opens picker; ⌘L locks app (returns to unlock screen); ⌘W closes the active tab; ⌘⇧P triggers a manual password copy.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/QuickConnect/ src/renderer/screens/Main.tsx
git commit -m "feat(renderer): quick-connect picker and keyboard shortcuts"
```

---

## Phase 10 — E2E test

### Task 24: Playwright E2E — connect and detect

**Files:**
- Create: `playwright.config.ts`, `test/e2e/connect-and-detect.spec.ts`, `test/e2e/docker-compose.sshd.yml`

- [ ] **Step 1: Write `test/e2e/docker-compose.sshd.yml`**

```yaml
services:
  sshd:
    image: linuxserver/openssh-server:latest
    container_name: termius-e2e-sshd
    environment:
      USER_NAME: testuser
      USER_PASSWORD: testpassword12345
      PASSWORD_ACCESS: "true"
      SUDO_ACCESS: "true"
    ports:
      - "2222:2222"
```

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 60_000,
  use: { trace: 'on-first-retry' },
  reporter: 'list',
});
```

- [ ] **Step 3: Write `test/e2e/connect-and-detect.spec.ts`**

```ts
import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

test('create vault, save VM, connect to local sshd, toast appears', async () => {
  const userData = mkdtempSync(path.join(tmpdir(), 'termius-e2e-'));
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, ELECTRON_USER_DATA_DIR: userData },
    cwd: process.cwd(),
  });
  const win = await app.firstWindow();

  // create master password
  await win.fill('input[type=password]', 'master-password-12345');
  await win.fill('input[placeholder=confirm]', 'master-password-12345');
  await win.click('button[type=submit]');

  // create VM
  await win.click('text=+ New VM');
  await win.fill('input >> nth=0', 'localhost-sshd');           // label
  await win.fill('input >> nth=1', '127.0.0.1');                // host
  await win.fill('input[type=number]', '2222');                 // port
  await win.fill('input >> nth=3', 'testuser');                 // user
  // auth defaults to password — set the password
  const passwordFields = await win.locator('input[type=password]').all();
  await passwordFields[0].fill('testpassword12345');            // login password
  await win.click('text=Create');

  // double-click VM to connect
  await win.dblclick('text=localhost-sshd');

  // toast should appear within 10s
  await expect(win.locator('.toast')).toContainText('Login password copied', { timeout: 10_000 });

  await app.close();
  rmSync(userData, { recursive: true, force: true });
});
```

- [ ] **Step 4: Start sshd container**

Run:
```bash
docker compose -f test/e2e/docker-compose.sshd.yml up -d
```
Expected: container running on port 2222.

- [ ] **Step 5: Run the E2E test**

Run:
```bash
npm run build && npx playwright test
```
Expected: PASS. The test creates a vault, saves a VM, connects, and sees the "Login password copied" toast.

- [ ] **Step 6: Stop the container**

```bash
docker compose -f test/e2e/docker-compose.sshd.yml down
```

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts test/e2e/
git commit -m "test(e2e): playwright covers full connect-and-detect flow"
```

---

## Phase 11 — Final polish

### Task 25: Run full test suite and typecheck

- [ ] **Step 1: Run unit tests**

Run: `npm test`
Expected: all unit tests pass (crypto, memory, vault, migrations, vms-repo, prompt-detector, session-manager, clipboard).

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no errors across main, preload, renderer.

- [ ] **Step 3: Manual end-to-end smoke**

Run: `npm run build && npx electron .`

Verify by hand:
- First launch → create master password (rejects <12 chars)
- Create a VM with a known password
- Double-click to connect → terminal opens
- When `password:` prompt appears, toast shows "Login password copied" and password is on the clipboard (paste with ⌘V to confirm)
- `sudo` from inside the session → toast shows "Sudo password copied"
- ⌘L locks the app → returns to unlock screen, terminal disappears (vault inaccessible)
- Unlock again → VM list is back
- ⌘W closes the active tab
- ⌘K opens the quick picker

- [ ] **Step 4: Commit any leftover fixes**

If you fixed anything during smoke testing, commit it with a focused message.

---

## Self-Review Summary

This plan implements every section of the spec:

- §3 Stack → Task 1
- §4 Architecture → Tasks 13–15
- §5 Data Model → Tasks 3, 5, 6, 7
- §6 Password Prompt Detection → Tasks 8, 14, 21
- §7 UI → Tasks 16–23
- §8 Security Model → Tasks 3, 5, 11, 12, 15 (auto-lock), 16 (unlock screen with 1s delay & min-12-char rule)
- §9 Project Structure → matches the layout used across tasks
- §10 Testing Strategy → Unit tests in tasks 3–11, E2E in task 24, full sweep in task 25

§11 (open questions: auto-type, Touch ID, sync) is explicitly deferred and out of v1 scope.
