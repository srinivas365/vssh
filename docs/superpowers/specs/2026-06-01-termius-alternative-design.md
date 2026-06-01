# Termius Alternative — Design Spec

**Date:** 2026-06-01
**Status:** Draft, pending user review

## 1. Purpose

A desktop SSH client that stores VM connection details (host, username, credentials) locally and, when the SSH session prompts for a password, automatically copies the saved password to the clipboard and shows a toast so the user can paste it. Termius-style ergonomics, single-user, offline-first.

## 2. v1 Scope

In scope:
- Save VMs with host, port, username, auth method
- Auth methods: password, SSH key, key + password
- Per-VM saved sudo password and key passphrase
- Multiple concurrent SSH sessions in tabs
- Folder/group organization with last-used sort
- Automatic password-prompt detection during SSH sessions → clipboard copy + toast
- Encrypted local credential vault unlocked by a master password
- Auto-lock after idle timeout

Out of scope for v1:
- Port forwarding, SFTP, tunnels
- Cloud sync between devices
- Team sharing of credentials
- Windows/Linux release builds (CI builds them but macOS is the primary target)
- "Forgot master password" recovery flow (deliberately — losing it loses the vault)

## 3. Stack

| Concern | Choice |
|---|---|
| Shell | Electron |
| UI | React + TypeScript |
| Terminal renderer | xterm.js |
| SSH transport | system `ssh` binary spawned via node-pty |
| VM metadata store | better-sqlite3 (synchronous, embedded) |
| Credential vault | AES-256-GCM with Argon2id-derived key, stored as encrypted JSON blob |
| Non-sensitive prefs | electron-store |
| State (renderer) | Zustand |
| Tests | Vitest (unit/integration), Playwright (E2E driving Electron) |
| Build | electron-builder |

## 4. Architecture

Two-process Electron app.

**Main process (Node):**
- SQLite database for VM metadata
- Encrypted vault loaded into memory on unlock
- PTY/session manager: one `node-pty` instance per active SSH session
- Prompt detector consuming PTY output stream
- Clipboard service with auto-clear timer
- Typed IPC surface exposed to renderer

**Renderer process (React):**
- Sidebar (VM tree, search, drag-drop)
- Tab bar + xterm.js terminals
- Toast/tooltip overlay
- VM edit modal, unlock screen, settings
- Never receives plaintext secrets; only secret-related IPC is write-only (e.g. "save this password")

**Electron hardening:**
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Strict CSP on the renderer
- Preload script exposes a single typed `window.api` namespace

## 5. Data Model

### 5.1 `vms.db` — SQLite, unencrypted, non-sensitive metadata

```sql
CREATE TABLE folders (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  parent_id   INTEGER REFERENCES folders(id),
  sort_order  INTEGER
);

CREATE TABLE vms (
  id                  INTEGER PRIMARY KEY,
  folder_id           INTEGER REFERENCES folders(id),
  label               TEXT NOT NULL,
  host                TEXT NOT NULL,
  port                INTEGER NOT NULL DEFAULT 22,
  username            TEXT NOT NULL,
  auth_method         TEXT NOT NULL CHECK (auth_method IN ('password','key','key+password')),
  key_path            TEXT,
  vault_ref           TEXT NOT NULL UNIQUE,    -- UUID linking to vault entry
  auto_copy_disabled  INTEGER NOT NULL DEFAULT 0,
  last_used_at        INTEGER,
  created_at          INTEGER NOT NULL
);
```

Browsable while the app is locked. Sidebar renders without the master password.

### 5.2 `vault.enc` — encrypted JSON blob

File layout: `[salt:16][nonce:12][ciphertext][tag:16]`

Decrypted plaintext shape:
```json
{
  "<vault_ref-uuid>": {
    "password": "...",
    "sudo_password": "...",
    "key_passphrase": "..."
  }
}
```

All fields optional per VM. Vault is held in main-process memory only while unlocked.

### 5.3 Key derivation

- Argon2id, parameters `m=64MB, t=3, p=1`, 32-byte output
- Salt: 16 random bytes stored alongside the ciphertext
- Re-derivation runs once per unlock; the derived key is held in memory and zeroed on lock

## 6. Password Prompt Detection

The defining feature.

### 6.1 Pipeline

```
ssh process ─stdout─▶ node-pty ─chunk─▶ Main
                                          │
                          ┌───────────────┼───────────────┐
                          ▼                               ▼
                  PromptDetector                  Forward chunk
                  (rolling 512-byte buffer)       to renderer (xterm)
                          │
                          ▼
              regex matrix evaluates current tail
                          │
                          ▼
                  Copy matching secret → clipboard
                  IPC to renderer → Toast
```

### 6.2 Regex matrix (case-insensitive)

| Prompt type | Pattern (tail of buffer) | Secret looked up |
|---|---|---|
| SSH login | `^\S+@\S+'s password:\s*$` OR `password:\s*$` within first 5s of session | `vault[vault_ref].password` |
| Sudo | `\[sudo\] password for \S+:\s*$` OR `Password:\s*$` after session is established | `vault[vault_ref].sudo_password` |
| Key passphrase | `Enter passphrase for key '.*':\s*$` | `vault[vault_ref].key_passphrase` |
| Generic fallback | line ending in `password:` / `passphrase:` not matching above | login password, toast asks for confirm |

### 6.3 Rules

- Detection runs only on PTY output, never on user input
- Per-session debounce: fire at most once every 2 seconds
- If matching secret missing for the VM, show "no password saved for this VM" toast — never silently no-op
- VMs with `auto_copy_disabled = 1` get a click-to-copy toast instead
- Buffer is reassembled across chunk boundaries to handle split UTF-8 / split prompt strings

### 6.4 Toast

Non-modal, bottom-right of active terminal tab. Auto-dismiss after 6s.

Content:
```
🔑 <Login | Sudo | Key> password copied
   Press ⌘V to paste

[Dismiss]  [Don't auto-copy for this VM]
```

Clicking "Don't auto-copy for this VM" sets `auto_copy_disabled = 1`.

### 6.5 Clipboard

- `clipboard.writeText` followed by a `clipboard.clear()` timer
- Default TTL 30s, configurable 10s–300s
- Timer is not cancelled if the user copies something else — acceptable trade-off, simpler than tracking clipboard contents

## 7. UI

### 7.1 Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  ☰  Termius-alt                                    🔒 Lock   ⚙       │
├────────────────┬─────────────────────────────────────────────────────┤
│ 🔍 Search...   │  ┌─[prod-db-01]─┬─[staging-web]─┬─[+]──────────┐   │
│                │  │ user@prod-db-01:~$ sudo systemctl restart   │   │
│ ▼ Production   │  │ [sudo] password for user: ▮                 │   │
│   • prod-db-01 │  │                                              │   │
│   • prod-web   │  │                                              │   │
│                │  │                            ┌────────────────┐│   │
│ ▼ Staging      │  │                            │ 🔑 Sudo pw     ││   │
│   • staging-web│  │                            │ copied — ⌘V    ││   │
│                │  │                            └────────────────┘│   │
│ [+ New VM]     │  └──────────────────────────────────────────────┘   │
│                │  ● Connected · 22ms · key+password                  │
└────────────────┴─────────────────────────────────────────────────────┘
```

### 7.2 Sidebar (~260px default, resizable)

- Search box filters by label / host / username
- Tree of folders → VMs, drag-drop reordering and moves
- VM context menu: Connect, Connect in new tab, Edit, Duplicate, Delete
- Double-click VM = connect in new tab
- "+ New VM" button at bottom

### 7.3 Tab bar

- One tab per active session, closeable
- "+" opens a ⌘K-style quick-connect picker
- Tab shows label + state dot (● green=connected, yellow=connecting, red=disconnected)

### 7.4 VM edit modal

Fields: Label, Host, Port, Username, Auth method (Password / Key / Key+Password).
Conditional rendering of password / key path / key passphrase / sudo password fields.
Secret fields render as `••••••••` with a press-and-hold 👁 reveal.

### 7.5 Unlock screen

- Single master-password field
- 1s delay after wrong attempt (rate-limit)
- No "forgot password" affordance; onboarding text explains the trade-off

### 7.6 Keyboard shortcuts

| Shortcut | Action |
|---|---|
| ⌘T | New tab (quick-connect picker) |
| ⌘W | Close tab |
| ⌘⇧[ / ⌘⇧] | Switch tabs |
| ⌘K | Jump-to-VM picker |
| ⌘L | Lock app immediately |
| ⌘⇧P | Manually paste saved password into current session |

## 8. Security Model

### 8.1 In scope

- Casual attacker with brief filesystem access (lost laptop, malicious app reading `~/Library/Application Support`)
- Plaintext credentials in swap, logs, or crash dumps

### 8.2 Out of scope

- Compromised user account / root attacker with live memory access while unlocked
- Keyloggers capturing the master password
- Malicious upstream npm dependencies (mitigated by minimal dep tree, not eliminated)

### 8.3 Measures

| Risk | Mitigation |
|---|---|
| Vault stolen | AES-256-GCM + Argon2id (m=64MB, t=3, p=1) |
| Weak master password | Min 12 chars at creation, strength meter, no max |
| Secrets linger in memory | Buffers zeroed on lock; refs dropped; GC hint |
| Secrets leak to renderer | Renderer never receives plaintext; main owns clipboard and PTY write |
| Clipboard lingering | Auto-clear 30s default (10s–300s configurable) |
| Logs contain secrets | Redaction layer in logger; PTY output never logged in v1 |
| Electron RCE | contextIsolation + sandbox + nodeIntegration off + strict CSP + typed preload |
| Key files | Path stored only; we never copy or relocate user's key files |

### 8.4 Auto-lock

- Triggers: idle timeout (default 15 min, configurable 1–120 min or never), system sleep, system lock screen, manual ⌘L
- On lock: vault wiped from memory, app returns to unlock screen
- Live SSH sessions are NOT killed on lock — they keep running. Locking blocks new secret access (new connects, reveal, manual paste), not existing terminals.

### 8.5 Vault backup

User can export an encrypted backup file (same format, same master password). No cloud sync v1.

## 9. Project Structure

```
termius/
├── package.json
├── electron-builder.yml
├── tsconfig.json
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── ipc.ts
│   │   ├── db/
│   │   │   ├── schema.sql
│   │   │   ├── migrations.ts
│   │   │   └── vms-repo.ts
│   │   ├── vault/
│   │   │   ├── crypto.ts
│   │   │   ├── vault.ts
│   │   │   └── memory.ts
│   │   ├── ssh/
│   │   │   ├── session.ts
│   │   │   ├── session-manager.ts
│   │   │   └── prompt-detector.ts
│   │   ├── clipboard.ts
│   │   └── logger.ts
│   ├── preload/
│   │   └── preload.ts
│   ├── renderer/
│   │   ├── App.tsx
│   │   ├── screens/
│   │   │   ├── Unlock.tsx
│   │   │   └── Main.tsx
│   │   ├── components/
│   │   │   ├── Sidebar/
│   │   │   ├── TabBar/
│   │   │   ├── Terminal/
│   │   │   ├── Toast/
│   │   │   ├── VmEditForm/
│   │   │   └── QuickConnect/
│   │   ├── state/
│   │   └── styles/
│   └── shared/
│       ├── types.ts
│       └── constants.ts
└── test/
    ├── unit/
    │   ├── vault.test.ts
    │   ├── prompt-detector.test.ts
    │   ├── vms-repo.test.ts
    │   └── clipboard.test.ts
    └── e2e/
        ├── unlock-flow.spec.ts
        ├── vm-crud.spec.ts
        └── connect-and-detect.spec.ts
```

Each main-process module is plain Node and importable in tests without booting Electron.

## 10. Testing Strategy

| Layer | Tool | Coverage |
|---|---|---|
| Unit (main) | Vitest | Vault encrypt/decrypt round-trip, prompt-detector regex matrix (positive + false-positive), VM repo CRUD, clipboard auto-clear timing |
| Unit (renderer) | Vitest + React Testing Library | VM form validation, toast rendering, keyboard shortcuts |
| Integration | Vitest | PromptDetector + SessionManager: scripted PTY output → correct secret type requested |
| E2E | Playwright (Electron driver) | Unlock flow; VM CRUD; connect → detect password prompt → toast appears. SSH target = `linuxserver/openssh-server` Docker container with known creds. |

### Critical prompt-detection test cases

- `password:` appearing mid-line in `cat`'d log → must NOT fire
- Re-prompt after wrong password → must fire again, respecting 2s debounce
- Custom sudo passprompt → false negative is acceptable; user falls back to ⌘⇧P
- Multi-byte UTF-8 chunk boundaries splitting the prompt string → buffer reassembles

### CI

GitHub Actions matrix on macOS (primary), Linux, Windows for builds via electron-builder. E2E only on macOS in v1.

## 11. Open Questions / Future Work

- Auto-type secret directly into PTY (skipping clipboard) — deferred to v1.1 after we observe how reliable detection is in real usage
- "Test connection" button in the VM edit form — v1.1
- Port forwarding / SFTP — v2
- Cloud sync — v2, requires team decision on hosting/E2E key model
- Touch ID unlock for the vault (macOS) — v1.1, would use Keychain to store the Argon2-derived key
