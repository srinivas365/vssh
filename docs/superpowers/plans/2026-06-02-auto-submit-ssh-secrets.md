# Auto-submit SSH Secrets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SSH login passwords and key passphrases submit automatically with Enter while keeping sudo on the existing clipboard/manual flow.

**Architecture:** Add a persisted per-host `autoSubmitEnabled` flag, expose it in the host form, and route prompt detections through a small main-process policy helper. Eligible login/key prompts write `secret + '\r'` to the PTY; ineligible prompts preserve existing clipboard behavior.

**Tech Stack:** Electron main process, TypeScript, better-sqlite3, React 18, Zustand, Vitest.

---

## File structure

- Modify `src/shared/types.ts`: add `autoSubmitEnabled` to `Vm`/`VmInput`; add toast delivery metadata.
- Modify `src/main/db/schema.sql`: add `auto_submit_enabled` with default enabled for new databases.
- Modify `src/main/db/migrations.ts`: add idempotent migration for existing databases.
- Modify `src/main/db/vms-repo.ts`: map, create, update, and move VM records with the new flag.
- Create `src/main/ssh/prompt-action.ts`: pure policy for prompt secret selection and delivery decision.
- Modify `src/main/ipc.ts`: use policy helper and write eligible secrets to the PTY.
- Modify `src/renderer/components/VmEditForm/VmEditForm.tsx`: add checkbox and include field in `VmInput`.
- Modify `src/renderer/components/Toast/Toast.tsx`: show “sent” vs “copied” wording.
- Modify existing tests: `test/unit/migrations.test.ts`, `test/unit/vms-repo.test.ts`.
- Create focused unit test: `test/unit/prompt-action.test.ts`.

---

### Task 1: Add persisted `autoSubmitEnabled` VM field

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/db/schema.sql`
- Modify: `src/main/db/migrations.ts`
- Modify: `src/main/db/vms-repo.ts`
- Test: `test/unit/migrations.test.ts`
- Test: `test/unit/vms-repo.test.ts`

- [ ] **Step 1: Update shared VM types**

In `src/shared/types.ts`, change the VM and VM input definitions to include `autoSubmitEnabled`, and add toast delivery metadata for later tasks:

```ts
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
  autoSubmitEnabled: boolean;
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
  autoSubmitEnabled: boolean;
}

export interface ToastPayload {
  sessionId: string;
  vmId: number;
  promptType: PromptType;
  hasSecret: boolean;
  delivery: 'copied' | 'sent' | 'none';
}
```

- [ ] **Step 2: Add the column to the base schema**

In `src/main/db/schema.sql`, add `auto_submit_enabled` after `auto_copy_disabled`:

```sql
  auto_copy_disabled  INTEGER NOT NULL DEFAULT 0,
  auto_submit_enabled INTEGER NOT NULL DEFAULT 1,
  last_used_at        INTEGER,
```

- [ ] **Step 3: Add an idempotent migration for existing databases**

Replace `src/main/db/migrations.ts` with:

```ts
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
```

- [ ] **Step 4: Update `VmsRepo` row mapping and writes**

In `src/main/db/vms-repo.ts`:

1. Add the row field:

```ts
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
```

2. Add the mapped property in `rowToVm`:

```ts
    autoCopyDisabled: r.auto_copy_disabled === 1,
    autoSubmitEnabled: r.auto_submit_enabled === 1,
    lastUsedAt: r.last_used_at,
```

3. Replace the `createVm` insert with:

```ts
    const stmt = this.db.prepare(`
      INSERT INTO vms (folder_id, label, host, port, username, auth_method, key_path, vault_ref, auto_submit_enabled, created_at)
      VALUES (@folderId, @label, @host, @port, @username, @authMethod, @keyPath, @vaultRef, @autoSubmitEnabled, @createdAt)
    `);
```

4. Replace the `updateVm` SQL with:

```ts
      UPDATE vms SET folder_id=@folderId, label=@label, host=@host, port=@port,
        username=@username, auth_method=@authMethod, key_path=@keyPath,
        auto_submit_enabled=@autoSubmitEnabled
      WHERE id=@id
```

5. Add a setter near `setAutoCopyDisabled`:

```ts
  setAutoSubmitEnabled(id: number, enabled: boolean): void {
    this.db
      .prepare('UPDATE vms SET auto_submit_enabled = ? WHERE id = ?')
      .run(enabled ? 1 : 0, id);
  }
```

- [ ] **Step 5: Update existing repository tests for the new field**

In `test/unit/vms-repo.test.ts`, add `autoSubmitEnabled: true` to every `repo.createVm(...)` and `repo.updateVm(...)` input object. Update the first test with these assertions:

```ts
    expect(vm.autoSubmitEnabled).toBe(true);
    expect(vm.autoCopyDisabled).toBe(false);
```

Add this test after `sets auto_copy_disabled`:

```ts
  it('sets auto_submit_enabled', () => {
    const vm = repo.createVm({ folderId: null, label: 'a', host: 'h', port: 22, username: 'u', authMethod: 'password', keyPath: null, autoSubmitEnabled: true });
    repo.setAutoSubmitEnabled(vm.id, false);
    expect(repo.getVm(vm.id)?.autoSubmitEnabled).toBe(false);
  });
```

In `test/unit/migrations.test.ts`, add:

```ts
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
```

- [ ] **Step 6: Run focused tests and verify they pass**

Run:

```bash
npm test -- test/unit/migrations.test.ts test/unit/vms-repo.test.ts
```

Expected: both test files pass.

- [ ] **Step 7: Commit Task 1**

```bash
git add src/shared/types.ts src/main/db/schema.sql src/main/db/migrations.ts src/main/db/vms-repo.ts test/unit/migrations.test.ts test/unit/vms-repo.test.ts
git commit -m "feat: persist auto-submit setting"
```

---

### Task 2: Add pure prompt action policy

**Files:**
- Create: `src/main/ssh/prompt-action.ts`
- Create: `test/unit/prompt-action.test.ts`

- [ ] **Step 1: Create failing tests for prompt delivery decisions**

Create `test/unit/prompt-action.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { decidePromptAction } from '../../src/main/ssh/prompt-action';
import { Vm, VaultEntry } from '../../src/shared/types';

function vm(overrides: Partial<Vm> = {}): Vm {
  return {
    id: 1,
    folderId: null,
    label: 'test',
    host: '127.0.0.1',
    port: 22,
    username: 'user',
    authMethod: 'password',
    keyPath: null,
    vaultRef: 'vault-ref',
    autoCopyDisabled: false,
    autoSubmitEnabled: true,
    lastUsedAt: null,
    createdAt: 1,
    ...overrides,
  };
}

const entry: VaultEntry = {
  password: 'login-secret',
  sudoPassword: 'sudo-secret',
  keyPassphrase: 'key-secret',
};

describe('decidePromptAction', () => {
  it('sends login passwords when auto-submit is enabled', () => {
    expect(decidePromptAction(vm(), entry, 'login')).toEqual({
      secret: 'login-secret',
      delivery: 'sent',
    });
  });

  it('sends key passphrases when auto-submit is enabled', () => {
    expect(decidePromptAction(vm(), entry, 'key-passphrase')).toEqual({
      secret: 'key-secret',
      delivery: 'sent',
    });
  });

  it('copies sudo passwords instead of auto-submitting them', () => {
    expect(decidePromptAction(vm(), entry, 'sudo')).toEqual({
      secret: 'sudo-secret',
      delivery: 'copied',
    });
  });

  it('copies login passwords when auto-submit is disabled', () => {
    expect(decidePromptAction(vm({ autoSubmitEnabled: false }), entry, 'login')).toEqual({
      secret: 'login-secret',
      delivery: 'copied',
    });
  });

  it('does not copy fallback secrets when auto-copy is disabled', () => {
    expect(decidePromptAction(vm({ autoSubmitEnabled: false, autoCopyDisabled: true }), entry, 'login')).toEqual({
      secret: undefined,
      delivery: 'none',
    });
  });

  it('still auto-submits eligible prompts when auto-copy is disabled', () => {
    expect(decidePromptAction(vm({ autoCopyDisabled: true }), entry, 'login')).toEqual({
      secret: 'login-secret',
      delivery: 'sent',
    });
  });

  it('returns none when the matching secret is missing', () => {
    expect(decidePromptAction(vm(), {}, 'login')).toEqual({
      secret: undefined,
      delivery: 'none',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails because the helper does not exist**

Run:

```bash
npm test -- test/unit/prompt-action.test.ts
```

Expected: FAIL with an import/module error for `prompt-action`.

- [ ] **Step 3: Implement the prompt action helper**

Create `src/main/ssh/prompt-action.ts`:

```ts
import { PromptType, VaultEntry, Vm } from '@shared/types';

export type PromptDelivery = 'copied' | 'sent' | 'none';

export interface PromptAction {
  secret: string | undefined;
  delivery: PromptDelivery;
}

export function pickSecretByPrompt(entry: VaultEntry, type: PromptType): string | undefined {
  switch (type) {
    case 'login':
    case 'generic':
      return entry.password;
    case 'sudo':
      return entry.sudoPassword;
    case 'key-passphrase':
      return entry.keyPassphrase;
  }
}

function canAutoSubmit(type: PromptType): boolean {
  return type === 'login' || type === 'key-passphrase';
}

export function decidePromptAction(vm: Vm, entry: VaultEntry, type: PromptType): PromptAction {
  const secret = pickSecretByPrompt(entry, type);
  if (!secret) return { secret: undefined, delivery: 'none' };

  if (vm.autoSubmitEnabled && canAutoSubmit(type)) {
    return { secret, delivery: 'sent' };
  }

  if (!vm.autoCopyDisabled) {
    return { secret, delivery: 'copied' };
  }

  return { secret: undefined, delivery: 'none' };
}
```

- [ ] **Step 4: Run helper tests and verify they pass**

Run:

```bash
npm test -- test/unit/prompt-action.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/main/ssh/prompt-action.ts test/unit/prompt-action.test.ts
git commit -m "feat: add prompt auto-submit policy"
```

---

### Task 3: Wire auto-submit into prompt handling

**Files:**
- Modify: `src/main/ipc.ts`

- [ ] **Step 1: Replace local secret picker with policy import**

In `src/main/ipc.ts`, remove `VaultEntry` from the type import if it is only used by `pickSecretByPrompt`, delete the local `pickSecretByPrompt` function, and add:

```ts
import { decidePromptAction, pickSecretByPrompt } from './ssh/prompt-action';
```

Keep `VaultEntry` imported from `@shared/types` because IPC handlers still use it for vault writes.

- [ ] **Step 2: Replace the prompt handler body**

In `src/main/ipc.ts`, replace the `session.on('promptDetected', ...)` body with:

```ts
    session.on('promptDetected', (type: PromptType) => {
      const entry = d.vault.getSecret(vm.vaultRef);
      const action = decidePromptAction(vm, entry, type);

      if (action.secret && action.delivery === 'sent') {
        session.write(`${action.secret}\r`);
        logger.registerSecret(action.secret);
      } else if (action.secret && action.delivery === 'copied') {
        d.clip.copySecret(action.secret);
        logger.registerSecret(action.secret);
      }

      const toast: ToastPayload = {
        sessionId: session.id,
        vmId,
        promptType: type,
        hasSecret: !!action.secret,
        delivery: action.delivery,
      };
      d.mainWindow()?.webContents.send(IPC.SESSION_TOAST, toast);
    });
```

This intentionally lets auto-submit work even if `autoCopyDisabled` is true, because auto-submit is a separate setting.

- [ ] **Step 3: Confirm manual password copy still uses the shared picker**

The `IPC.PASTE_PASSWORD` handler should continue to read:

```ts
    const secret = pickSecretByPrompt(entry, type);
    if (secret) d.clip.copySecret(secret);
```

- [ ] **Step 4: Run TypeScript check**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/main/ipc.ts
git commit -m "feat: auto-submit eligible ssh prompts"
```

---

### Task 4: Add the per-host UI control

**Files:**
- Modify: `src/renderer/components/VmEditForm/VmEditForm.tsx`
- Modify: `src/main/ipc.ts`

- [ ] **Step 1: Add form state for auto-submit**

In `src/renderer/components/VmEditForm/VmEditForm.tsx`, after the `keyPassphrase` state, add:

```ts
  const [autoSubmitEnabled, setAutoSubmitEnabled] = useState(initial?.autoSubmitEnabled ?? true);
```

- [ ] **Step 2: Include the setting in submitted VM input**

In the `input: VmInput` object, add `autoSubmitEnabled`:

```ts
    const input: VmInput = {
      folderId,
      label, host, port, username, authMethod,
      keyPath: authMethod === 'password' ? null : (keyPath || null),
      autoSubmitEnabled,
    };
```

- [ ] **Step 3: Render a checkbox near password fields**

In the form JSX, after the sudo password label and before `.form-actions`, add:

```tsx
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={autoSubmitEnabled}
            onChange={(e) => setAutoSubmitEnabled(e.target.checked)}
          />
          Automatically submit login/key secrets
        </label>
```

If `checkbox-label` has no styling, leave it unstyled unless the existing CSS makes it unreadable.

- [ ] **Step 4: Update move-to-folder to preserve the setting**

In `src/main/ipc.ts`, update the `d.repo.updateVm(vmId, { ... })` object in the `IPC.VMS_MOVE_TO_FOLDER` handler to include:

```ts
      autoSubmitEnabled: vm.autoSubmitEnabled,
```

- [ ] **Step 5: Run TypeScript check**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add src/renderer/components/VmEditForm/VmEditForm.tsx src/main/ipc.ts
git commit -m "feat: expose auto-submit host setting"
```

---

### Task 5: Update toast wording for sent vs copied secrets

**Files:**
- Modify: `src/renderer/components/Toast/Toast.tsx`

- [ ] **Step 1: Update toast rendering logic**

In `src/renderer/components/Toast/Toast.tsx`, add this helper above `ToastOverlay`:

```ts
function toastTitle(toast: { promptType: PromptType; hasSecret: boolean; delivery: 'copied' | 'sent' | 'none' }): string {
  if (!toast.hasSecret) return `No saved ${label[toast.promptType].toLowerCase()} for this host`;
  if (toast.delivery === 'sent') return `${label[toast.promptType]} sent`;
  return `${label[toast.promptType]} copied`;
}

function toastSubtext(toast: { hasSecret: boolean; delivery: 'copied' | 'sent' | 'none' }): string | null {
  if (!toast.hasSecret) return null;
  if (toast.delivery === 'sent') return 'Submitted automatically';
  return 'Press ⌘V to paste into the terminal';
}
```

Then replace the title/subtitle JSX inside `<div className="toast">` with:

```tsx
      <div className="toast-title">
        <span className="toast-icon">🔑</span>
        {toastTitle(toast)}
      </div>
      {toastSubtext(toast) && <div className="toast-sub">{toastSubtext(toast)}</div>}
```

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit Task 5**

```bash
git add src/renderer/components/Toast/Toast.tsx
git commit -m "feat: show auto-submit toast status"
```

---

### Task 6: Final verification

**Files:**
- No code changes expected unless verification reveals a defect.

- [ ] **Step 1: Run unit tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Optional manual smoke test if Docker sshd is available**

Run the app with the existing dev command:

```bash
make dev
```

Manual check:

1. Create or edit a password-auth host.
2. Confirm “Automatically submit login/key secrets” is checked.
3. Connect.
4. Expected: password prompt is satisfied automatically and the toast says the login password was sent.
5. Edit the host and uncheck the setting.
6. Connect again.
7. Expected: vssh returns to clipboard behavior and the toast says the login password was copied.

- [ ] **Step 4: Commit any verification fixes**

If verification required fixes, commit them:

```bash
git status --short
git add src/shared/types.ts src/main/db/schema.sql src/main/db/migrations.ts src/main/db/vms-repo.ts src/main/ssh/prompt-action.ts src/main/ipc.ts src/renderer/components/VmEditForm/VmEditForm.tsx src/renderer/components/Toast/Toast.tsx test/unit/migrations.test.ts test/unit/vms-repo.test.ts test/unit/prompt-action.test.ts
git commit -m "fix: complete auto-submit verification"
```

Only stage files that actually changed during verification. If no fixes were required, do not create an empty commit.
