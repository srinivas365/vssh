<div align="center">

<img src="build/icon.png" alt="vssh" width="120" height="120" />

# vssh

A Termius-alternative SSH client for macOS that remembers your hosts and quietly hands you the password when SSH asks for it.

[![CI](https://github.com/srinivas365/vssh/actions/workflows/ci.yml/badge.svg)](https://github.com/srinivas365/vssh/actions/workflows/ci.yml)
[![Release](https://github.com/srinivas365/vssh/actions/workflows/release.yml/badge.svg)](https://github.com/srinivas365/vssh/actions/workflows/release.yml)

</div>

## Why

Working across a fleet of VMs means typing — or worse, pasting — the same passwords every day. vssh stores them in an encrypted local vault, watches the SSH session for a password prompt, and copies the right secret to the clipboard so all you do is `⌘V`. No vendor account, no cloud sync, no telemetry.

## Features

### Connection
- **Real `ssh`, real PTY** — vssh spawns the system `ssh` binary inside a pseudo-terminal via [`node-pty`](https://github.com/microsoft/node-pty), so your `~/.ssh/config`, known_hosts, jump hosts and SSH agent all just work.
- **Multiple sessions in tabs** — open as many concurrent terminals as you need; per-tab connection state dots and labels in the title bar.
- **Authentication methods** — password, SSH key, or key + fallback password. Key file paths are referenced, never copied.
- **Sudo and key passphrase support** — save them per-host alongside the login password.

### Password automation
- **Prompt detection** — a regex matrix watches PTY output for SSH login prompts, `[sudo]` prompts, and key passphrase prompts.
- **Auto clipboard copy + toast** — when a prompt is matched, the right secret is copied and a toast appears: "🔑 Login password copied — Press ⌘V to paste".
- **Clipboard auto-clear** — secrets are wiped from the clipboard after 30 s (configurable).
- **Manual fallback** — `⌘⇧P` copies the saved login password into the active session even if detection misses (custom sudo prompts, etc.).
- **Per-host opt-out** — disable auto-copy on hosts where the heuristic gets it wrong.

### UI
- **Hosts page** — a Termius-style grid of every saved host with auth badges, last-used timestamps, and primary "Connect" buttons.
- **Sidebar** — folders, search, hover-only actions, host subtext (`user@host`).
- **Quick connect** — `⌘K` Spotlight-style picker, keyboard-driven.
- **Light theme** — refined CSS-variable-based design tokens; rounded squircle app icon.
- **Custom React dropdowns** — fully keyboard-navigable Select component (no native widgets).

### Security
- **Encrypted vault** — AES-256-GCM blob with an Argon2id-derived key (m=64 MiB, t=3, p=1).
- **Master password on first launch** — no recovery; vault is yours alone.
- **Auto-lock** — after 15 min idle, on system sleep, on system lock-screen, or via `⌘L`. The vault is wiped from memory; existing sessions keep running but new secret access requires re-unlock.
- **Renderer never sees plaintext secrets** — they flow main process → clipboard via a typed IPC surface.
- **Sandboxed renderer** — `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strict CSP, preload bundled with `esbuild` so there are no runtime `require()` calls.

### Productivity
- **Keyboard-first** — `⌘1`/`⌘2` Hosts/Terminal view, `⌘K` quick-connect, `⌘T` new tab, `⌘W` close tab, `⌘⇧[`/`⌘⇧]` switch tabs, `⌘L` lock, `⌘⇧P` paste password.
- **Terminal scrollback preserved** — switching between Hosts and Terminal views keeps every session's xterm buffer alive; only visibility toggles.
- **Folders + last-used sort** — VMs in the sidebar bubble up by recency.

## Quick start

### Download

Grab the latest `vssh-x.y.z-arm64.dmg` from the [Releases page](https://github.com/srinivas365/vssh/releases/latest).

1. Open the DMG and drag **vssh** to Applications.
2. **One-time setup** — remove the macOS quarantine flag so Gatekeeper stops blocking the unsigned app:
   ```bash
   sudo xattr -cr /Applications/vssh.app
   ```
3. Open vssh.

> **Why step 2?** macOS shows _"vssh is damaged and can't be opened"_ for unsigned apps downloaded from the internet, even though the app itself is fine. The `xattr` command removes the "downloaded from internet" marker so the OS stops complaining. Right-click → Open does **not** work for this particular Gatekeeper rule (it does for "unidentified developer", but not for "damaged"). You only need to do this once per install. Future updates may swap in a signed + notarized build that opens without this step — see [Code signing](#code-signing-optional).

> Apple Silicon only for now — Intel builds are paused because GitHub deprecated the `macos-13` runner image. If you need an Intel build, see [Build from source](#build-from-source).

### Build from source

```bash
git clone git@github.com:srinivas365/vssh.git
cd vssh
make install            # npm install
make icon               # generate app icon
make dmg                # produces release/vssh-*.dmg
```

Or just run it without packaging:

```bash
make run                # build + launch Electron
```

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
│   State: Zustand stores (vault, vms, sessions)     │
└────────────────────────────────────────────────────┘
```

The renderer never receives plaintext secrets. When a prompt is detected, the main process pushes the secret directly to the clipboard and only notifies the renderer "a login password was copied" — the value itself never crosses the IPC boundary.

## Stack

| Layer | Tech |
|---|---|
| Shell | Electron 33, TypeScript 5.6 |
| UI | React 18, xterm.js, Zustand |
| Build | Vite (renderer), tsc + tsc-alias (main), esbuild (preload) |
| Native | better-sqlite3, argon2, node-pty |
| Tests | Vitest (unit), Playwright (E2E driving Electron) |
| Packaging | electron-builder → DMG |
| CI | GitHub Actions on Ubuntu (test + E2E) and macOS-13/14 (DMG) |

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
│   ├── vault/           # Argon2id + AES-GCM + lifecycle
│   ├── ssh/             # node-pty session, manager, prompt detector
│   ├── clipboard.ts     # auto-clearing clipboard service
│   ├── ipc.ts           # typed IPC handlers
│   ├── logger.ts        # redaction-aware logger
│   └── index.ts         # app entry, auto-lock, IPC registration
├── preload/             # contextBridge → window.api (bundled with esbuild)
├── renderer/            # React app
│   ├── components/      # Sidebar, TabBar, Terminal, Toast, VmEditForm,
│   │                    # QuickConnect, Select
│   ├── screens/         # Unlock, Main, HostsPage
│   ├── state/           # Zustand stores
│   └── styles/          # design tokens (app.css)
└── shared/              # cross-process types and constants

test/
├── unit/                # Vitest — 34 tests across vault, repo, detector, etc.
└── e2e/                 # Playwright spec + sshd Docker compose

build/                   # Icon source + generated .icns/.png
scripts/                 # build helpers (copy schema, build icon)
docs/superpowers/        # Design spec and implementation plan
.github/workflows/       # CI + release pipelines
```

## Releases

### CI

`.github/workflows/ci.yml` runs on every push and PR:
1. **`test`** (Ubuntu): typecheck → build → unit tests
2. **`e2e`** (Ubuntu): builds + rebuilds native modules + spins up Dockerized sshd + runs Playwright under `xvfb`

### DMG releases

`.github/workflows/release.yml` fires on a `v*` tag push and produces DMGs for both architectures.

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions:
1. Builds `vssh-0.1.0-arm64.dmg` on `macos-14` (Apple Silicon)
2. Creates a GitHub Release at `/releases/tag/v0.1.0` with the DMG attached and auto-generated notes

### Code signing (optional)

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

User data lives outside the `.app` bundle in:

```
~/Library/Application Support/vssh/
├── vms.db        # VM metadata — SQLite, NOT encrypted
└── vault.enc     # All passwords — AES-256-GCM blob
```

**Updates preserve data.** Installing a newer DMG only replaces `/Applications/vssh.app`; the data directory is never touched. Your hosts and saved passwords carry over.

**Backups.** Copy that folder somewhere safe. The vault is portable across machines (same password unlocks it on any Mac with vssh installed).

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
- Auto-type directly into PTY (skip clipboard)
- SFTP and port forwarding
- Cloud sync (E2E encrypted, BYO-storage)
- Versioned vault format + SQLite migration framework (currently `CREATE TABLE IF NOT EXISTS` only)

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
