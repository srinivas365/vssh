<div align="center">

<img src="build/icon.png" alt="vssh" width="120" height="120" />

# vssh

A Termius-alternative SSH client for macOS, Linux, and Windows that remembers your hosts and quietly hands you the password when SSH asks for it.

[![CI](https://github.com/srinivas365/vssh/actions/workflows/ci.yml/badge.svg)](https://github.com/srinivas365/vssh/actions/workflows/ci.yml)
[![Release](https://github.com/srinivas365/vssh/actions/workflows/release.yml/badge.svg)](https://github.com/srinivas365/vssh/actions/workflows/release.yml)

</div>

## Why

Working across a fleet of VMs means typing — or worse, pasting — the same passwords every day. vssh stores them in an encrypted local vault, watches the SSH session for a password prompt, and either auto-submits the secret or copies it to the clipboard so you can paste (`⌘V` / `Ctrl+V`). No vendor account, no cloud sync, no telemetry.

## Features

### Connection
- **Real `ssh`, real PTY** — vssh spawns the system `ssh` binary inside a pseudo-terminal via [`node-pty`](https://github.com/microsoft/node-pty), so your `~/.ssh/config`, known_hosts, jump hosts and SSH agent all just work.
- **Multiple sessions in tabs** — open as many concurrent terminals as you need; per-tab connection state dots and labels in the title bar.
- **Authentication methods** — password, SSH key, or key + fallback password. Key file paths are referenced, never copied.
- **Sudo and key passphrase support** — save them per-host alongside the login password.

### Password automation
- **Prompt detection** — a regex matrix watches PTY output for SSH login prompts, `[sudo]` prompts, and key passphrase prompts.
- **Auto-submit (per host)** — login passwords and key passphrases can be sent directly to the PTY with Enter when `Automatically submit login/key secrets` is enabled. Sudo prompts always stay on the clipboard/manual flow.
- **Auto clipboard copy + toast** — when auto-submit is off (or for sudo), the matched secret is copied and a toast appears with a platform-aware paste hint (`⌘V` on macOS, `Ctrl+V` on Windows).
- **Clipboard auto-clear** — secrets are wiped from the clipboard after 30 s (configurable).
- **Manual fallback** — `⌘⇧P` / `Ctrl+Shift+P` copies the saved login password into the active session even if detection misses.
- **Per-host opt-out** — disable auto-copy on hosts where the heuristic gets it wrong.

### Host management
- **Workspaces** — organize hosts into folders; drag hosts between workspaces in the sidebar.
- **Clone host** — duplicate a saved host (credentials included); edit the IP or label before saving. Handy for fleets where hosts differ by one octet.
- **Export / import** — backup or move hosts to another machine via an encrypted `.vssh` file. Choose workspaces to include; set a separate **export encryption key** (not your vault master password). On import, enter the same key to restore hosts and credentials.
- **Connection test** — verify host, port, username, and credentials from the host edit form before saving.

### UI
- **Hosts page** — Termius-style grid with auth badges, last-used timestamps, per-card connect/edit/clone/upload/download actions, plus header **Import** / **Export** for encrypted host backups.
- **Sidebar** — workspaces, search, hover actions (connect, clone, edit, delete), host subtext (`user@host`).
- **Settings** — themes, app/terminal fonts, terminal font size, and idle lock timeout (sidebar footer or header lock button).
- **Quick connect** — `⌘K` / `Ctrl+K` Spotlight-style picker, keyboard-driven.
- **Multiple built-in themes** — Light, Dark, Claude, Dracula, Nord, and Solarized Dark.
- **Lucide icons** — consistent iconography across hosts, sidebar, tabs, toasts, and modals.
- **Custom React dropdowns** — fully keyboard-navigable Select component (no native widgets).

### Security
- **Encrypted vault** — AES-256-GCM blob with an Argon2id-derived key (m=64 MiB, t=3, p=1).
- **Master password on first launch** — no recovery; vault is yours alone.
- **Auto-lock** — configurable idle timeout (default 15 min), plus lock on system sleep, lock-screen, or `⌘L` / `Ctrl+L`. The vault is wiped from memory; existing sessions keep running but new secret access requires re-unlock.
- **Renderer never sees plaintext secrets** — they flow main process → clipboard via a typed IPC surface.
- **Sandboxed renderer** — `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strict CSP, preload bundled with `esbuild` so there are no runtime `require()` calls.

### File transfers
- **Host-level uploads/downloads** — copy files or folders between your machine and a saved VM directly from the host card; no SSH, rsync, or sftp commands required.
- **SFTP browsing + rsync transfers** — browse remote directories with SFTP; transfers use rsync when available on both ends and fall back to SFTP otherwise.
- **Transfers page** — track progress, bytes transferred, logs, pause/resume, stop, and partial-file recovery for all current-session transfers.

### Terminal
- **xterm.js sessions** — full scrollback, multiple tabs, per-tab connection status.
- **Scrollback preserved** — switching between Hosts and Terminal views keeps every session's buffer alive; only visibility toggles.
- **Windows clipboard** — `Ctrl+C` copies selected text; `Ctrl+V` pastes (terminal-to-terminal or from other apps). Also supports `Ctrl+Shift+C/V` and `Shift+Insert`.
- **macOS clipboard** — standard `⌘C` / `⌘V` with selection.

### Productivity
- **Keyboard-first** — `⌘1`/`⌘2` (Hosts/Terminal), `⌘K`/`Ctrl+K` quick-connect, `⌘W`/`Ctrl+W` close tab, `⌘L`/`Ctrl+L` lock, `⌘⇧P`/`Ctrl+Shift+P` paste password.
- **Folders + last-used sort** — hosts in the sidebar bubble up by recency.

## Quick start

### Download

Grab the latest asset for your OS from the [Releases page](https://github.com/srinivas365/vssh/releases/latest):

- **macOS (Apple Silicon):** `vssh-<version>-arm64.dmg`
- **Linux (x64):** `vssh-<version>.AppImage`
- **Windows (x64):** `vssh*Setup*.exe`

Install:

1. **macOS** — open the DMG and drag **vssh** to Applications.
   - One-time setup for unsigned builds:
     ```bash
     sudo xattr -cr /Applications/vssh.app
     ```
2. **Linux** — mark the AppImage executable and run it:
   ```bash
   chmod +x vssh-*.AppImage
   ./vssh-*.AppImage
   ```
3. **Windows** — run the `.exe` installer.

> **macOS note:** Gatekeeper may block unsigned apps downloaded from the internet with _"vssh is damaged and can't be opened"_. The `xattr` command above removes the quarantine marker.

### Build from source

```bash
git clone git@github.com:srinivas365/vssh.git
cd vssh
make install            # npm install
make icon               # generate app icon
make dist               # produces installer in release/ for your current OS
```

Or just run it without packaging:

```bash
make run                # build + launch Electron
```

## Screenshots

### Landing + vault unlock

![vssh unlock screen](docs/screenshots/unlock.png)

### Hosts, workspaces, and actions

![vssh hosts page](docs/screenshots/hosts.png)

### Quick connect palette

![vssh quick connect](docs/screenshots/quick-connect.png)

### Terminal session + prompt automation

![vssh terminal](docs/screenshots/terminal.png)

### Transfers

![vssh transfers page](docs/screenshots/transfers.png)

### Settings and themes

![vssh settings page](docs/screenshots/settings.png)

### Theme + font customization applied

![vssh settings with dracula + font changes](docs/screenshots/settings-theme-font.png)
![vssh hosts with dracula + monospace app font](docs/screenshots/hosts-theme-font.png)
![vssh terminal with dracula + JetBrains Mono](docs/screenshots/terminal-theme-font.png)

## Architecture

Two-process Electron app:

```
┌─ Main process (Node) ──────────────────────────────┐
│                                                    │
│   ┌────────┐   ┌──────────────┐   ┌─────────────┐  │
│   │  Vault │   │  VMs SQLite  │   │  Session    │  │
│   │  AES-  │   │  metadata    │   │  manager    │  │
│   │  GCM   │   │  (host,user) │   │  (node-pty) │  │
│   └────────┘   └──────────────┘   └─────────────┘  │
│        │              │                  │         │
│        └──────────────┴──────────────────┘         │
│                       │                            │
│             ┌─────────▼─────────┐                  │
│             │  Prompt detector  │                  │
│             │  (regex on PTY)   │                  │
│             └─────────┬─────────┘                  │
│                       │                            │
│             ┌─────────▼─────────┐                  │
│             │  Clipboard (TTL)  │                  │
│             └───────────────────┘                  │
└─────────────────────┬──────────────────────────────┘
                      │ typed IPC (window.api)
┌─────────────────────▼──────────────────────────────┐
│  Renderer (React + xterm.js)                       │
│                                                    │
│   Header  │  Sidebar  │  Hosts page                │
│   Tabs    │  Terminal │  Toast / Modals / Picker   │
│                                                    │
│   State: Zustand stores (vault, vms, sessions,      │
│          settings)                                  │
└────────────────────────────────────────────────────┘
```

The renderer never receives plaintext secrets. When a prompt is detected, the main process either types the secret into the PTY (auto-submit) or pushes it to the clipboard and notifies the renderer — the value itself never crosses the IPC boundary.

## Stack

| Layer | Tech |
|---|---|
| Shell | Electron 33, TypeScript 5.6 |
| UI | React 18, xterm.js, Zustand |
| Build | Vite (renderer), tsc + tsc-alias (main), esbuild (preload) |
| Native | better-sqlite3, argon2, node-pty |
| Tests | Vitest (unit), Playwright (E2E driving Electron) |
| Packaging | electron-builder → DMG (macOS), AppImage (Linux), NSIS `.exe` (Windows) |
| CI | GitHub Actions on Ubuntu (test + E2E) + release builds on macOS, Linux, and Windows |

## Development

### One-time setup

```bash
make install
```

Mac requires Xcode Command Line Tools for the native module builds. The icon build script needs `librsvg` (`brew install librsvg`).

### Common targets

Run `make` (no args) for the full list; the most-used:

| Command | What |
|---|---|
| `make dev` | Vite + tsc -w + esbuild -w + Electron in one shell |
| `make build` | Full production build |
| `make typecheck` | All three TypeScript projects |
| `make test` | Unit tests (auto-rebuilds native modules for Node ABI) |
| `make e2e` | Full E2E: starts Docker sshd, rebuilds for Electron ABI, runs Playwright |
| `make verify` | Pre-commit gate: typecheck + tests |
| `make icon` | Regenerate `.icns`/`.png` from `build/icon.svg` |
| `make dmg` | Produce a signed (if secrets present) or unsigned DMG |
| `make clean` | Wipe `dist/`, `release/`, test outputs |
| `make sshd-up` / `sshd-down` | Manage the openssh-server container on its own |

### Native module ABI

Electron and Node use different `NODE_MODULE_VERSION`s, so `better-sqlite3` etc. need to be rebuilt when switching contexts. The Makefile handles this:
- `make test` triggers `rebuild:node` automatically (`pretest` npm hook)
- `make e2e` and `make dmg` trigger `rebuild:electron`

If you see `NODE_MODULE_VERSION` mismatch errors, run `make rebuild-node` or `make rebuild-electron` directly.

### Project layout

```
src/
├── main/                # Electron main process (Node)
│   ├── db/              # SQLite schema, migrations, repo
│   ├── settings/        # App settings persistence (electron-store)
│   ├── vault/           # Argon2id + AES-GCM + lifecycle
│   ├── ssh/             # node-pty session, manager, prompt detector
│   ├── clipboard.ts     # auto-clearing clipboard service
│   ├── export/          # encrypted host export/import
│   ├── ipc.ts           # typed IPC handlers
│   ├── logger.ts        # redaction-aware logger
│   └── index.ts         # app entry, auto-lock, IPC registration
├── preload/             # contextBridge → window.api (bundled with esbuild)
├── renderer/            # React app
│   ├── components/      # Sidebar, TabBar, Terminal, Toast, VmEditForm,
│   │                    # QuickConnect, HostsTransfer, Select, Transfers
│   ├── screens/         # Unlock, Main, HostsPage, TransfersPage, SettingsPage
│   ├── state/           # Zustand stores
│   └── styles/          # design tokens (app.css)
└── shared/              # types, constants, vm-clone, hosts-export helpers

test/
├── unit/                # Vitest — vault, repo, detector, export, clone, clipboard, etc.
└── e2e/                 # Playwright spec + sshd Docker compose

build/                   # Icon source + generated .icns/.png
scripts/                 # build helpers (copy schema, build icon)
docs/superpowers/        # Design spec and implementation plan
.github/workflows/       # CI + release pipelines
```

## Releases

### CI

`.github/workflows/ci.yml` runs on every push and PR:
1. **`test`** (Ubuntu): typecheck → build → unit tests (with Electron cache + retry on transient download failures)
2. **`e2e`** (Ubuntu): builds + rebuilds native modules + spins up Dockerized sshd + runs Playwright under `xvfb`

### Cross-platform releases

`.github/workflows/release.yml` fires on a `v*` tag push and produces installers for all supported platforms. **Installer version comes from the git tag** (e.g. tag `v0.2.2` → binaries labeled `0.2.2`), not from `package.json`.

```bash
git tag v0.2.2
git push origin v0.2.2
```

GitHub Actions:
1. Builds a macOS Apple Silicon DMG (`*.dmg`) on `macos-14`
2. Builds a Linux x64 AppImage (`*.AppImage`) on `ubuntu-latest`
3. Builds a Windows x64 NSIS installer (`*.exe`) on `windows-latest`
4. Creates a GitHub Release at `/releases/tag/v0.2.2` with those assets attached and auto-generated notes

The workflow caches Electron downloads and retries `npm ci` / `electron-builder` on transient CDN timeouts (504s).

### macOS code signing (optional)

Without signing the DMG still works — macOS Gatekeeper just asks the user to confirm on first launch. To produce signed + notarized builds, add these repo secrets:

| Secret | How to obtain |
|---|---|
| `MAC_CERT_P12_BASE64` | `base64 -i DeveloperID.p12 \| pbcopy` |
| `MAC_CERT_PASSWORD` | P12 export password |
| `APPLE_ID` | Apple developer email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | Developer team ID |

The release workflow picks them up automatically; no code change required.

## Data and updates

User data lives outside the packaged app/binary in:

```
macOS:   ~/Library/Application Support/vssh/
Linux:   ~/.config/vssh/
Windows: %APPDATA%\vssh\

vms.db        # VM metadata — SQLite, NOT encrypted
vault.enc     # All passwords — AES-256-GCM blob
```

**Updates preserve data.** Installing a newer release replaces app binaries only; the user data directory is not touched. Your hosts and saved passwords carry over.

**Backups.** Copy that folder somewhere safe. The vault is portable across machines (same password unlocks it on any machine with vssh installed). You can also use **Hosts → Export** to write an encrypted `.vssh` file (separate export key) and **Import** on another machine.

**Lost master password = lost vault.** This is by design — there's no escrow, no recovery key, no support form. Choose a password you can remember or write down somewhere offline.

## Security model

In scope:
- Casual attacker with brief filesystem access (lost laptop, malicious local process reading `~/Library/Application Support`)
- Plaintext secrets leaking to swap, logs, or crash dumps

Out of scope:
- Compromised user account with live memory dump access while the vault is unlocked
- Keyloggers capturing the master password
- Malicious upstream npm dependencies

Concrete measures: AES-256-GCM + Argon2id, master-password min 12 chars, vault file mode `0o600`, secrets zeroed from buffers after use, clipboard auto-clear, logger redaction, sandboxed renderer with no plaintext secret IPC.

## Roadmap

Deferred from v1, candidates for v1.x:
- Auto-update via `electron-updater` reading the GitHub Releases this CI already produces
- Touch ID unlock (store the Argon2 key in Keychain, secured by biometric)
- SFTP and port forwarding (file transfer via rsync/SFTP exists; interactive SFTP sessions do not)
- Cloud sync (E2E encrypted, BYO-storage)
- Versioned vault format + SQLite migration framework (currently `CREATE TABLE IF NOT EXISTS` only)
- Selective import (merge/skip duplicates) for host exports

## Contributing

PRs welcome. Before submitting:

```bash
make verify           # typecheck + unit tests
make verify-full      # + E2E (requires Docker)
```

All commits use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).

## License

[MIT](LICENSE) © 2026 Srinivas Mannem

## Design and planning

This project was built from a [design spec](docs/superpowers/specs/2026-06-01-termius-alternative-design.md) and [implementation plan](docs/superpowers/plans/2026-06-01-termius-alternative.md) under the [superpowers](https://github.com/anthropics/claude-code) workflow — both committed alongside the code for the curious.
