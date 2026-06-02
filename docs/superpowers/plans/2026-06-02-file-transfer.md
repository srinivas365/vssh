# File Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add seamless host-level upload/download of files and folders between local macOS and saved VMs, with SFTP browsing, rsync-preferred transfers, SFTP fallback, progress, pause/resume/stop, and a Transfers page.

**Architecture:** Add a focused transfer subsystem in the Electron main process. Renderer talks to it through typed IPC and never receives plaintext secrets. Remote browsing and fallback transfers use SFTP via `ssh2`; rsync transfers use system `rsync` over SSH when available.

**Tech Stack:** Electron main/preload IPC, TypeScript, React, Zustand, Vitest, Playwright, `ssh2`, system `rsync`, existing VM/vault/prompt policy.

---

## File Structure

### Main/shared files

- Modify `package.json` / `package-lock.json`: add `ssh2` and `@types/ssh2`.
- Modify `src/shared/constants.ts`: add transfer IPC channel names.
- Modify `src/shared/types.ts`: add transfer, remote browser, and dialog types.
- Create `src/main/transfer/path-utils.ts`: pure path and folder-mode calculations.
- Create `src/main/transfer/engine-selection.ts`: pure rsync availability selection helpers.
- Create `src/main/transfer/state-machine.ts`: pure transfer status transition and partial-retention helpers.
- Create `src/main/transfer/sftp-client.ts`: SSH2 connection creation, remote list/stat, upload/download primitives.
- Create `src/main/transfer/remote-browser-service.ts`: browse/select metadata API over SFTP.
- Create `src/main/transfer/rsync-engine.ts`: spawn rsync, parse progress/logs, pause/stop cleanup hooks.
- Create `src/main/transfer/sftp-engine.ts`: SFTP fallback upload/download with progress and resume offsets.
- Create `src/main/transfer/transfer-manager.ts`: owns current-session transfers, concurrency, engine selection, event emission.
- Modify `src/main/ipc.ts`: register dialog, remote browser, and transfer IPC handlers.
- Modify `src/main/index.ts`: instantiate `TransferManager` and pass it to IPC registration.

### Preload/renderer files

- Modify `src/preload/preload.ts`: expose `window.api.transfer` and event subscriptions.
- Modify `src/renderer/state/sessions-store.ts`: no transfer state goes here; keep terminal state isolated.
- Create `src/renderer/state/transfers-store.ts`: current-session transfer state and actions.
- Modify `src/renderer/screens/Main.tsx`: add Transfers top-nav state and callbacks for host actions.
- Modify `src/renderer/screens/HostsPage.tsx`: add Upload/Download buttons to host cards.
- Create `src/renderer/screens/TransfersPage.tsx`: list transfer rows/cards and details.
- Create `src/renderer/screens/TransfersPage.css`: page styling.
- Create `src/renderer/components/Transfers/TransferWizard.tsx`: upload/download flow coordinator.
- Create `src/renderer/components/Transfers/RemoteBrowserModal.tsx`: SFTP browser UI.
- Create `src/renderer/components/Transfers/ConflictModal.tsx`: overwrite/merge confirmation.
- Create `src/renderer/components/Transfers/FolderModeModal.tsx`: as-is vs contents-only choice.

### Tests

- Create `test/unit/transfer-path-utils.test.ts`.
- Create `test/unit/transfer-engine-selection.test.ts`.
- Create `test/unit/transfer-state-machine.test.ts`.
- Create `test/unit/transfer-manager.test.ts`.
- Create `test/unit/remote-browser-service.test.ts`.
- Create `test/unit/transfers-store.test.ts`.
- Add E2E coverage in `test/e2e/transfers.spec.ts` after unit/main flow is working.

---

## Task 1: Add Shared Transfer Types and IPC Constants

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/constants.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Add transfer IPC constants**

In `src/shared/constants.ts`, add these entries inside `IPC` before the `misc` section:

```ts
  // transfers
  TRANSFER_PICK_UPLOAD_SOURCE: 'transfer:pick-upload-source',
  TRANSFER_PICK_DOWNLOAD_DESTINATION: 'transfer:pick-download-destination',
  TRANSFER_REMOTE_LIST: 'transfer:remote-list',
  TRANSFER_REMOTE_STAT: 'transfer:remote-stat',
  TRANSFER_START: 'transfer:start',
  TRANSFER_PAUSE: 'transfer:pause',
  TRANSFER_RESUME: 'transfer:resume',
  TRANSFER_STOP: 'transfer:stop',
  TRANSFER_DELETE_PARTIALS: 'transfer:delete-partials',
  TRANSFER_PROGRESS: 'transfer:progress',       // main → renderer
  TRANSFER_STATE: 'transfer:state',             // main → renderer
  TRANSFER_LOG: 'transfer:log',                 // main → renderer
  TRANSFER_TOAST: 'transfer:toast',             // main → renderer
```

- [ ] **Step 2: Add shared transfer types**

Append this block to `src/shared/types.ts` before `declare global`:

```ts
export type TransferDirection = 'upload' | 'download';
export type TransferEngineName = 'rsync' | 'sftp';
export type TransferStatus = 'preparing' | 'running' | 'paused' | 'stopped' | 'succeeded' | 'failed';
export type TransferEntryType = 'file' | 'directory' | 'symlink' | 'unknown';
export type FolderCopyMode = 'as-is' | 'contents-only';

export interface LocalSelection {
  path: string;
  name: string;
  type: 'file' | 'directory';
  sizeBytes: number | null;
}

export interface RemoteEntry {
  name: string;
  path: string;
  type: TransferEntryType;
  sizeBytes: number | null;
  modifiedAt: number | null;
}

export interface TransferSource {
  path: string;
  name: string;
  type: 'file' | 'directory';
}

export interface TransferDestination {
  directory: string;
  finalPath: string;
}

export interface TransferStartRequest {
  vmId: number;
  direction: TransferDirection;
  source: TransferSource;
  destination: TransferDestination;
  folderMode: FolderCopyMode;
  overwrite: boolean;
}

export interface TransferRecord {
  id: string;
  vmId: number;
  direction: TransferDirection;
  engine: TransferEngineName;
  status: TransferStatus;
  source: TransferSource;
  destination: TransferDestination;
  folderMode: FolderCopyMode;
  startedAt: number;
  finishedAt: number | null;
  transferredBytes: number;
  totalBytes: number | null;
  percent: number | null;
  error: string | null;
  partialsKept: boolean;
}

export interface TransferProgressEvent {
  id: string;
  transferredBytes: number;
  totalBytes: number | null;
  percent: number | null;
}

export interface TransferLogEvent {
  id: string;
  line: string;
  level: 'info' | 'warn' | 'error';
  at: number;
}

export interface TransferToastPayload {
  id: string;
  vmId: number;
  status: TransferStatus;
  message: string;
  canResume: boolean;
  canDeletePartials: boolean;
}
```

- [ ] **Step 3: Verify shared types compile**

Run:

```bash
npm run typecheck
```

Expected: PASS. Type-only additions must compile without implementation code.

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts src/shared/constants.ts
git commit -m "feat: add transfer shared types"
```

---

## Task 2: Add Pure Transfer Path Utilities

**Files:**
- Create: `src/main/transfer/path-utils.ts`
- Test: `test/unit/transfer-path-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/unit/transfer-path-utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { basenameForPath, joinRemotePath, computeFinalDestination, shouldCopyContentsOnly } from '../../src/main/transfer/path-utils';

describe('transfer path utilities', () => {
  it('extracts basenames from local and remote paths', () => {
    expect(basenameForPath('/Users/me/file.txt')).toBe('file.txt');
    expect(basenameForPath('/var/log/nginx/')).toBe('nginx');
  });

  it('joins remote paths without duplicate slashes', () => {
    expect(joinRemotePath('/home/admin', 'app.log')).toBe('/home/admin/app.log');
    expect(joinRemotePath('/home/admin/', 'app.log')).toBe('/home/admin/app.log');
    expect(joinRemotePath('/', 'tmp')).toBe('/tmp');
  });

  it('preserves source name for file destination', () => {
    expect(computeFinalDestination('/tmp/downloads', '/var/log/app.log', 'file', 'as-is')).toBe('/tmp/downloads/app.log');
  });

  it('preserves folder name by default', () => {
    expect(computeFinalDestination('/tmp/downloads', '/var/log/nginx', 'directory', 'as-is')).toBe('/tmp/downloads/nginx');
  });

  it('uses selected destination for folder contents-only mode', () => {
    expect(computeFinalDestination('/tmp/downloads', '/var/log/nginx', 'directory', 'contents-only')).toBe('/tmp/downloads');
  });

  it('only copies contents for directories with contents-only mode', () => {
    expect(shouldCopyContentsOnly('directory', 'contents-only')).toBe(true);
    expect(shouldCopyContentsOnly('file', 'contents-only')).toBe(false);
    expect(shouldCopyContentsOnly('directory', 'as-is')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/unit/transfer-path-utils.test.ts
```

Expected: FAIL because `src/main/transfer/path-utils.ts` does not exist.

- [ ] **Step 3: Implement path utilities**

Create `src/main/transfer/path-utils.ts`:

```ts
import path from 'node:path';
import type { FolderCopyMode } from '@shared/types';

export function basenameForPath(input: string): string {
  const trimmed = input.replace(/[\\/]+$/, '');
  return path.posix.basename(trimmed.replace(/\\/g, '/'));
}

export function joinRemotePath(directory: string, child: string): string {
  const cleanDir = directory === '/' ? '/' : directory.replace(/\/+$/, '');
  const cleanChild = child.replace(/^\/+/, '');
  return cleanDir === '/' ? `/${cleanChild}` : `${cleanDir}/${cleanChild}`;
}

export function computeFinalDestination(
  destinationDirectory: string,
  sourcePath: string,
  sourceType: 'file' | 'directory',
  folderMode: FolderCopyMode,
): string {
  if (sourceType === 'directory' && folderMode === 'contents-only') return destinationDirectory;
  return joinRemotePath(destinationDirectory, basenameForPath(sourcePath));
}

export function shouldCopyContentsOnly(sourceType: 'file' | 'directory', folderMode: FolderCopyMode): boolean {
  return sourceType === 'directory' && folderMode === 'contents-only';
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run test/unit/transfer-path-utils.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/transfer/path-utils.ts test/unit/transfer-path-utils.test.ts
git commit -m "feat: add transfer path utilities"
```

---

## Task 3: Add Engine Selection Helpers

**Files:**
- Create: `src/main/transfer/engine-selection.ts`
- Test: `test/unit/transfer-engine-selection.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/unit/transfer-engine-selection.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { chooseTransferEngine, parseCommandExistsExit } from '../../src/main/transfer/engine-selection';

describe('transfer engine selection', () => {
  it('chooses rsync when local and remote rsync are both available', () => {
    expect(chooseTransferEngine({ localRsync: true, remoteRsync: true })).toBe('rsync');
  });

  it('falls back to sftp when local rsync is missing', () => {
    expect(chooseTransferEngine({ localRsync: false, remoteRsync: true })).toBe('sftp');
  });

  it('falls back to sftp when remote rsync is missing', () => {
    expect(chooseTransferEngine({ localRsync: true, remoteRsync: false })).toBe('sftp');
  });

  it('treats exit code 0 as command available', () => {
    expect(parseCommandExistsExit(0)).toBe(true);
    expect(parseCommandExistsExit(1)).toBe(false);
    expect(parseCommandExistsExit(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/unit/transfer-engine-selection.test.ts
```

Expected: FAIL because the helper file does not exist.

- [ ] **Step 3: Implement helpers**

Create `src/main/transfer/engine-selection.ts`:

```ts
import type { TransferEngineName } from '@shared/types';

export interface EngineAvailability {
  localRsync: boolean;
  remoteRsync: boolean;
}

export function chooseTransferEngine(availability: EngineAvailability): TransferEngineName {
  return availability.localRsync && availability.remoteRsync ? 'rsync' : 'sftp';
}

export function parseCommandExistsExit(exitCode: number | null): boolean {
  return exitCode === 0;
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run test/unit/transfer-engine-selection.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/transfer/engine-selection.ts test/unit/transfer-engine-selection.test.ts
git commit -m "feat: add transfer engine selection"
```

---

## Task 4: Add Transfer State Machine Helpers

**Files:**
- Create: `src/main/transfer/state-machine.ts`
- Test: `test/unit/transfer-state-machine.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/unit/transfer-state-machine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { canPause, canResume, canStop, partialsKeptForOutcome } from '../../src/main/transfer/state-machine';

describe('transfer state machine', () => {
  it('allows pause only while running', () => {
    expect(canPause('running')).toBe(true);
    expect(canPause('preparing')).toBe(false);
    expect(canPause('paused')).toBe(false);
  });

  it('allows resume from paused or failed transfers with kept partials', () => {
    expect(canResume('paused', true)).toBe(true);
    expect(canResume('failed', true)).toBe(true);
    expect(canResume('failed', false)).toBe(false);
    expect(canResume('stopped', true)).toBe(false);
  });

  it('allows stop while preparing, running, or paused', () => {
    expect(canStop('preparing')).toBe(true);
    expect(canStop('running')).toBe(true);
    expect(canStop('paused')).toBe(true);
    expect(canStop('succeeded')).toBe(false);
  });

  it('keeps partials for pause and failure but deletes them for stop', () => {
    expect(partialsKeptForOutcome('pause')).toBe(true);
    expect(partialsKeptForOutcome('failure')).toBe(true);
    expect(partialsKeptForOutcome('stop')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/unit/transfer-state-machine.test.ts
```

Expected: FAIL because state-machine file does not exist.

- [ ] **Step 3: Implement helpers**

Create `src/main/transfer/state-machine.ts`:

```ts
import type { TransferStatus } from '@shared/types';

export function canPause(status: TransferStatus): boolean {
  return status === 'running';
}

export function canResume(status: TransferStatus, partialsKept: boolean): boolean {
  return (status === 'paused' || status === 'failed') && partialsKept;
}

export function canStop(status: TransferStatus): boolean {
  return status === 'preparing' || status === 'running' || status === 'paused';
}

export function partialsKeptForOutcome(outcome: 'pause' | 'stop' | 'failure'): boolean {
  return outcome === 'pause' || outcome === 'failure';
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run test/unit/transfer-state-machine.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/transfer/state-machine.ts test/unit/transfer-state-machine.test.ts
git commit -m "feat: add transfer state helpers"
```

---

## Task 5: Add ssh2 Dependency and SFTP Client Skeleton

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/main/transfer/sftp-client.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Install dependency**

Run:

```bash
npm install ssh2
npm install -D @types/ssh2
```

Expected: `package.json` and `package-lock.json` include `ssh2` and `@types/ssh2`.

- [ ] **Step 2: Create SFTP client wrapper**

Create `src/main/transfer/sftp-client.ts`:

```ts
import { Client, ConnectConfig, SFTPWrapper } from 'ssh2';
import type { Vm, VaultEntry } from '@shared/types';

export interface SftpConnection {
  client: Client;
  sftp: SFTPWrapper;
  close: () => void;
}

export function connectConfigForVm(vm: Vm, secret: VaultEntry | null): ConnectConfig {
  const config: ConnectConfig = {
    host: vm.host,
    port: vm.port,
    username: vm.username,
    readyTimeout: 20_000,
  };

  if (vm.keyPath) config.privateKey = undefined;
  if (secret?.password && vm.authMethod !== 'key') config.password = secret.password;

  return config;
}

export function connectSftp(vm: Vm, secret: VaultEntry | null): Promise<SftpConnection> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    client.once('ready', () => {
      client.sftp((err, sftp) => {
        if (err) {
          client.end();
          reject(err);
          return;
        }
        resolve({ client, sftp, close: () => client.end() });
      });
    });
    client.once('error', reject);
    client.connect(connectConfigForVm(vm, secret));
  });
}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/main/transfer/sftp-client.ts
git commit -m "feat: add sftp client dependency"
```

---

## Task 6: Add Remote Browser Service

**Files:**
- Create: `src/main/transfer/remote-browser-service.ts`
- Test: `test/unit/remote-browser-service.test.ts`

- [ ] **Step 1: Write failing unit test with fake SFTP adapter**

Create `test/unit/remote-browser-service.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mapSftpEntry, sortRemoteEntries } from '../../src/main/transfer/remote-browser-service';

describe('remote browser service helpers', () => {
  it('maps sftp directory entries to remote entries', () => {
    const entry = mapSftpEntry('/home/admin', {
      filename: 'logs',
      longname: 'drwxr-xr-x 1 admin admin 64 Jun 1 logs',
      attrs: { mode: 0o040755, size: 64, mtime: 1717200000, atime: 1717200000, uid: 1000, gid: 1000 },
    });

    expect(entry).toEqual({
      name: 'logs',
      path: '/home/admin/logs',
      type: 'directory',
      sizeBytes: 64,
      modifiedAt: 1717200000000,
    });
  });

  it('sorts directories before files and ignores dot navigation entries', () => {
    const sorted = sortRemoteEntries([
      { name: 'z.txt', path: '/z.txt', type: 'file', sizeBytes: 1, modifiedAt: null },
      { name: 'app', path: '/app', type: 'directory', sizeBytes: null, modifiedAt: null },
      { name: '.', path: '/.', type: 'directory', sizeBytes: null, modifiedAt: null },
    ]);

    expect(sorted.map((x) => x.name)).toEqual(['app', 'z.txt']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/unit/remote-browser-service.test.ts
```

Expected: FAIL because service file does not exist.

- [ ] **Step 3: Implement browser helpers and service shell**

Create `src/main/transfer/remote-browser-service.ts`:

```ts
import type { FileEntry } from 'ssh2';
import type { RemoteEntry, Vm, VaultEntry } from '@shared/types';
import { joinRemotePath } from './path-utils';
import { connectSftp } from './sftp-client';

function typeFromMode(mode: number): RemoteEntry['type'] {
  if ((mode & 0o170000) === 0o040000) return 'directory';
  if ((mode & 0o170000) === 0o100000) return 'file';
  if ((mode & 0o170000) === 0o120000) return 'symlink';
  return 'unknown';
}

export function mapSftpEntry(directory: string, entry: FileEntry): RemoteEntry {
  return {
    name: entry.filename,
    path: joinRemotePath(directory, entry.filename),
    type: typeFromMode(entry.attrs.mode),
    sizeBytes: Number.isFinite(entry.attrs.size) ? entry.attrs.size : null,
    modifiedAt: entry.attrs.mtime ? entry.attrs.mtime * 1000 : null,
  };
}

export function sortRemoteEntries(entries: RemoteEntry[]): RemoteEntry[] {
  return entries
    .filter((entry) => entry.name !== '.' && entry.name !== '..')
    .sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
}

export class RemoteBrowserService {
  async list(vm: Vm, secret: VaultEntry | null, directory: string): Promise<RemoteEntry[]> {
    const conn = await connectSftp(vm, secret);
    try {
      const entries = await new Promise<FileEntry[]>((resolve, reject) => {
        conn.sftp.readdir(directory, (err, list) => err ? reject(err) : resolve(list));
      });
      return sortRemoteEntries(entries.map((entry) => mapSftpEntry(directory, entry)));
    } finally {
      conn.close();
    }
  }
}
```

- [ ] **Step 4: Run tests and typecheck**

```bash
npx vitest run test/unit/remote-browser-service.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/transfer/remote-browser-service.ts test/unit/remote-browser-service.test.ts
git commit -m "feat: add remote browser service"
```

---

## Task 7: Add Transfer Manager Core Without Real Engines

**Files:**
- Create: `src/main/transfer/transfer-manager.ts`
- Test: `test/unit/transfer-manager.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/unit/transfer-manager.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { TransferManager } from '../../src/main/transfer/transfer-manager';
import type { TransferStartRequest } from '../../src/shared/types';

function request(vmId = 1): TransferStartRequest {
  return {
    vmId,
    direction: 'upload',
    source: { path: '/tmp/a.txt', name: 'a.txt', type: 'file' },
    destination: { directory: '/home/admin', finalPath: '/home/admin/a.txt' },
    folderMode: 'as-is',
    overwrite: true,
  };
}

describe('TransferManager', () => {
  it('creates a preparing transfer record', async () => {
    const manager = new TransferManager({ chooseEngine: async () => 'sftp', startEngine: vi.fn() });
    const record = await manager.start(request());
    expect(record.vmId).toBe(1);
    expect(record.status).toBe('preparing');
    expect(record.engine).toBe('sftp');
  });

  it('blocks two active transfers for the same VM', async () => {
    const manager = new TransferManager({ chooseEngine: async () => 'sftp', startEngine: vi.fn() });
    await manager.start(request(7));
    await expect(manager.start(request(7))).rejects.toThrow('transfer-already-active-for-vm');
  });

  it('allows concurrent transfers for different VMs', async () => {
    const manager = new TransferManager({ chooseEngine: async () => 'sftp', startEngine: vi.fn() });
    await manager.start(request(1));
    await expect(manager.start(request(2))).resolves.toMatchObject({ vmId: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/unit/transfer-manager.test.ts
```

Expected: FAIL because manager does not exist.

- [ ] **Step 3: Implement manager core**

Create `src/main/transfer/transfer-manager.ts`:

```ts
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { TransferEngineName, TransferRecord, TransferStartRequest } from '@shared/types';

interface TransferManagerDeps {
  chooseEngine: (request: TransferStartRequest) => Promise<TransferEngineName>;
  startEngine: (record: TransferRecord) => void | Promise<void>;
}

export class TransferManager extends EventEmitter {
  private readonly records = new Map<string, TransferRecord>();

  constructor(private readonly deps: TransferManagerDeps) {
    super();
  }

  async start(request: TransferStartRequest): Promise<TransferRecord> {
    if (this.hasActiveTransferForVm(request.vmId)) throw new Error('transfer-already-active-for-vm');

    const engine = await this.deps.chooseEngine(request);
    const record: TransferRecord = {
      id: randomUUID(),
      vmId: request.vmId,
      direction: request.direction,
      engine,
      status: 'preparing',
      source: request.source,
      destination: request.destination,
      folderMode: request.folderMode,
      startedAt: Date.now(),
      finishedAt: null,
      transferredBytes: 0,
      totalBytes: null,
      percent: null,
      error: null,
      partialsKept: false,
    };

    this.records.set(record.id, record);
    this.emit('state', record);
    void this.deps.startEngine(record);
    return record;
  }

  get(id: string): TransferRecord | undefined {
    return this.records.get(id);
  }

  list(): TransferRecord[] {
    return Array.from(this.records.values());
  }

  private hasActiveTransferForVm(vmId: number): boolean {
    return this.list().some((record) => record.vmId === vmId && ['preparing', 'running', 'paused'].includes(record.status));
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run test/unit/transfer-manager.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/transfer/transfer-manager.ts test/unit/transfer-manager.test.ts
git commit -m "feat: add transfer manager core"
```

---

## Task 8: Add IPC Handlers and Preload API Shell

**Files:**
- Modify: `src/main/ipc.ts`
- Modify: `src/preload/preload.ts`
- Modify: `src/main/index.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Extend IPC dependencies**

In `src/main/ipc.ts`, import `dialog` and transfer types, and extend `Deps`:

```ts
import { ipcMain, BrowserWindow, clipboard, dialog } from 'electron';
import type { TransferManager } from './transfer/transfer-manager';
import { RemoteBrowserService } from './transfer/remote-browser-service';
import { basenameForPath } from './transfer/path-utils';
import type { LocalSelection, TransferStartRequest } from '@shared/types';
```

Add to `Deps`:

```ts
  transfers: TransferManager;
  remoteBrowser: RemoteBrowserService;
```

- [ ] **Step 2: Add IPC handlers in `registerIpc`**

Add after session handlers:

```ts
  // transfers
  ipcMain.handle(IPC.TRANSFER_PICK_UPLOAD_SOURCE, async (): Promise<LocalSelection | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const selectedPath = result.filePaths[0];
    return { path: selectedPath, name: basenameForPath(selectedPath), type: 'file', sizeBytes: null };
  });

  ipcMain.handle(IPC.TRANSFER_PICK_DOWNLOAD_DESTINATION, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC.TRANSFER_REMOTE_LIST, async (_e, vmId: number, directory: string) => {
    const vm = d.repo.getVm(vmId);
    if (!vm) throw new Error('vm-not-found');
    const entry = d.vault.getSecret(vm.vaultRef);
    return d.remoteBrowser.list(vm, entry, directory);
  });

  ipcMain.handle(IPC.TRANSFER_START, async (_e, request: TransferStartRequest) => d.transfers.start(request));
  ipcMain.handle(IPC.TRANSFER_PAUSE, async (_e, id: string) => d.transfers.emit('pause-request', id));
  ipcMain.handle(IPC.TRANSFER_RESUME, async (_e, id: string) => d.transfers.emit('resume-request', id));
  ipcMain.handle(IPC.TRANSFER_STOP, async (_e, id: string) => d.transfers.emit('stop-request', id));
  ipcMain.handle(IPC.TRANSFER_DELETE_PARTIALS, async (_e, id: string) => d.transfers.emit('delete-partials-request', id));

  d.transfers.on('state', (record) => d.mainWindow()?.webContents.send(IPC.TRANSFER_STATE, record));
  d.transfers.on('progress', (progress) => d.mainWindow()?.webContents.send(IPC.TRANSFER_PROGRESS, progress));
  d.transfers.on('log', (log) => d.mainWindow()?.webContents.send(IPC.TRANSFER_LOG, log));
  d.transfers.on('toast', (toast) => d.mainWindow()?.webContents.send(IPC.TRANSFER_TOAST, toast));
```

Note: the upload source type is temporarily `file`; Task 10 will replace it with `fs.statSync` detection.

- [ ] **Step 3: Expose transfer API in preload**

In `src/preload/preload.ts`, import transfer types and add to `api`:

```ts
  transfer: {
    pickUploadSource: (): Promise<LocalSelection | null> => ipcRenderer.invoke(IPC.TRANSFER_PICK_UPLOAD_SOURCE),
    pickDownloadDestination: (): Promise<string | null> => ipcRenderer.invoke(IPC.TRANSFER_PICK_DOWNLOAD_DESTINATION),
    remoteList: (vmId: number, directory: string): Promise<RemoteEntry[]> => ipcRenderer.invoke(IPC.TRANSFER_REMOTE_LIST, vmId, directory),
    start: (request: TransferStartRequest): Promise<TransferRecord> => ipcRenderer.invoke(IPC.TRANSFER_START, request),
    pause: (id: string) => ipcRenderer.invoke(IPC.TRANSFER_PAUSE, id),
    resume: (id: string) => ipcRenderer.invoke(IPC.TRANSFER_RESUME, id),
    stop: (id: string) => ipcRenderer.invoke(IPC.TRANSFER_STOP, id),
    deletePartials: (id: string) => ipcRenderer.invoke(IPC.TRANSFER_DELETE_PARTIALS, id),
    onState: (cb: (record: TransferRecord) => void) => ipcRenderer.on(IPC.TRANSFER_STATE, (_e, r) => cb(r)),
    onProgress: (cb: (event: TransferProgressEvent) => void) => ipcRenderer.on(IPC.TRANSFER_PROGRESS, (_e, p) => cb(p)),
    onLog: (cb: (event: TransferLogEvent) => void) => ipcRenderer.on(IPC.TRANSFER_LOG, (_e, l) => cb(l)),
    onToast: (cb: (toast: TransferToastPayload) => void) => ipcRenderer.on(IPC.TRANSFER_TOAST, (_e, t) => cb(t)),
  },
```

Update the import list from `@shared/types` to include:

```ts
LocalSelection, RemoteEntry, TransferStartRequest, TransferRecord, TransferProgressEvent, TransferLogEvent, TransferToastPayload
```

- [ ] **Step 4: Instantiate services in main index**

In `src/main/index.ts`, import and instantiate:

```ts
import { TransferManager } from './transfer/transfer-manager';
import { RemoteBrowserService } from './transfer/remote-browser-service';
```

Near existing service setup:

```ts
const transfers = new TransferManager({ chooseEngine: async () => 'sftp', startEngine: async () => undefined });
const remoteBrowser = new RemoteBrowserService();
```

Pass `transfers` and `remoteBrowser` into `registerIpc`.

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS after import/type fixes.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc.ts src/preload/preload.ts src/main/index.ts
git commit -m "feat: expose transfer ipc api"
```

---

## Task 9: Add Renderer Transfer Store

**Files:**
- Create: `src/renderer/state/transfers-store.ts`
- Test: `test/unit/transfers-store.test.ts`

- [ ] **Step 1: Write store tests**

Create `test/unit/transfers-store.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createTransfersStore } from '../../src/renderer/state/transfers-store';
import type { TransferRecord } from '../../src/shared/types';

function record(id: string, status: TransferRecord['status']): TransferRecord {
  return {
    id,
    vmId: 1,
    direction: 'upload',
    engine: 'sftp',
    status,
    source: { path: '/tmp/a.txt', name: 'a.txt', type: 'file' },
    destination: { directory: '/home/admin', finalPath: '/home/admin/a.txt' },
    folderMode: 'as-is',
    startedAt: 1,
    finishedAt: null,
    transferredBytes: 0,
    totalBytes: null,
    percent: null,
    error: null,
    partialsKept: false,
  };
}

describe('transfers store', () => {
  it('upserts transfer records', () => {
    const store = createTransfersStore();
    store.getState().upsert(record('a', 'running'));
    store.getState().upsert(record('a', 'succeeded'));
    expect(store.getState().transfers).toHaveLength(1);
    expect(store.getState().transfers[0].status).toBe('succeeded');
  });

  it('applies progress events', () => {
    const store = createTransfersStore();
    store.getState().upsert(record('a', 'running'));
    store.getState().applyProgress({ id: 'a', transferredBytes: 50, totalBytes: 100, percent: 50 });
    expect(store.getState().transfers[0].percent).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/unit/transfers-store.test.ts
```

Expected: FAIL because store does not exist.

- [ ] **Step 3: Implement transfer store**

Create `src/renderer/state/transfers-store.ts`:

```ts
import { create, StoreApi, UseBoundStore } from 'zustand';
import type { TransferLogEvent, TransferProgressEvent, TransferRecord, TransferToastPayload } from '@shared/types';

interface TransfersStore {
  transfers: TransferRecord[];
  logs: Record<string, TransferLogEvent[]>;
  toasts: TransferToastPayload[];
  upsert: (record: TransferRecord) => void;
  applyProgress: (event: TransferProgressEvent) => void;
  pushLog: (event: TransferLogEvent) => void;
  pushToast: (toast: TransferToastPayload) => void;
  dismissToast: (id: string) => void;
}

export function createTransfersStore(): UseBoundStore<StoreApi<TransfersStore>> {
  return create<TransfersStore>((set) => ({
    transfers: [],
    logs: {},
    toasts: [],
    upsert: (record) => set((state) => ({
      transfers: state.transfers.some((x) => x.id === record.id)
        ? state.transfers.map((x) => x.id === record.id ? record : x)
        : [record, ...state.transfers],
    })),
    applyProgress: (event) => set((state) => ({
      transfers: state.transfers.map((x) => x.id === event.id
        ? { ...x, transferredBytes: event.transferredBytes, totalBytes: event.totalBytes, percent: event.percent }
        : x),
    })),
    pushLog: (event) => set((state) => ({
      logs: { ...state.logs, [event.id]: [...(state.logs[event.id] ?? []), event] },
    })),
    pushToast: (toast) => set((state) => ({
      toasts: [...state.toasts.filter((x) => x.id !== toast.id), toast],
    })),
    dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((x) => x.id !== id) })),
  }));
}

export const useTransfersStore = createTransfersStore();
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run test/unit/transfers-store.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/state/transfers-store.ts test/unit/transfers-store.test.ts
git commit -m "feat: add transfer renderer store"
```

---

## Task 10: Add Transfers Page and Top Navigation

**Files:**
- Modify: `src/renderer/screens/Main.tsx`
- Create: `src/renderer/screens/TransfersPage.tsx`
- Create: `src/renderer/screens/TransfersPage.css`
- Test: `npm run typecheck`

- [ ] **Step 1: Create Transfers page**

Create `src/renderer/screens/TransfersPage.tsx`:

```tsx
import React from 'react';
import { useTransfersStore } from '../state/transfers-store';
import './TransfersPage.css';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function TransfersPage() {
  const { transfers, logs } = useTransfersStore();

  return (
    <div className="transfers-page">
      <header className="transfers-header">
        <h1>Transfers</h1>
        <p>{transfers.length} current-session transfer{transfers.length === 1 ? '' : 's'}</p>
      </header>
      {transfers.length === 0 ? (
        <div className="transfers-empty">Start an upload or download from a host.</div>
      ) : (
        <div className="transfers-list">
          {transfers.map((transfer) => (
            <section className="transfer-card" key={transfer.id}>
              <div className="transfer-card-main">
                <div>
                  <div className="transfer-title">{transfer.direction} · {transfer.source.name}</div>
                  <div className="transfer-sub">{transfer.source.path} → {transfer.destination.finalPath}</div>
                </div>
                <div className="transfer-badges">
                  <span>{transfer.engine}</span>
                  <span>{transfer.status}</span>
                </div>
              </div>
              <div className="transfer-progress-row">
                <progress value={transfer.percent ?? 0} max={100} />
                <span>{transfer.percent == null ? formatBytes(transfer.transferredBytes) : `${transfer.percent.toFixed(0)}%`}</span>
              </div>
              <div className="transfer-actions">
                <button disabled={transfer.status !== 'running'} onClick={() => void window.api.transfer.pause(transfer.id)}>Pause</button>
                <button disabled={!['paused', 'failed'].includes(transfer.status)} onClick={() => void window.api.transfer.resume(transfer.id)}>Resume</button>
                <button disabled={!['preparing', 'running', 'paused'].includes(transfer.status)} onClick={() => void window.api.transfer.stop(transfer.id)}>Stop</button>
                <button disabled={!transfer.partialsKept} onClick={() => void window.api.transfer.deletePartials(transfer.id)}>Delete partials</button>
              </div>
              {(logs[transfer.id] ?? []).length > 0 && (
                <details className="transfer-logs">
                  <summary>Details</summary>
                  {(logs[transfer.id] ?? []).map((line, index) => <pre key={index}>{line.line}</pre>)}
                </details>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Transfers page CSS**

Create `src/renderer/screens/TransfersPage.css`:

```css
.transfers-page { padding: 28px; color: var(--text); }
.transfers-header { display: flex; justify-content: space-between; align-items: end; margin-bottom: 20px; }
.transfers-header h1 { margin: 0; font-size: 28px; }
.transfers-header p { margin: 0; color: var(--muted); }
.transfers-empty { border: 1px dashed var(--border); border-radius: 18px; padding: 40px; color: var(--muted); text-align: center; }
.transfers-list { display: grid; gap: 14px; }
.transfer-card { border: 1px solid var(--border); border-radius: 18px; padding: 16px; background: var(--panel); }
.transfer-card-main { display: flex; justify-content: space-between; gap: 16px; }
.transfer-title { font-weight: 700; text-transform: capitalize; }
.transfer-sub { color: var(--muted); font-size: 12px; overflow-wrap: anywhere; margin-top: 4px; }
.transfer-badges { display: flex; gap: 8px; }
.transfer-badges span { border: 1px solid var(--border); border-radius: 999px; padding: 4px 8px; font-size: 12px; }
.transfer-progress-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px; margin-top: 14px; }
.transfer-progress-row progress { width: 100%; height: 10px; }
.transfer-actions { display: flex; gap: 8px; margin-top: 14px; }
.transfer-actions button { border: 1px solid var(--border); border-radius: 10px; padding: 6px 10px; background: var(--surface); color: var(--text); }
.transfer-actions button:disabled { opacity: 0.45; }
.transfer-logs { margin-top: 12px; }
.transfer-logs pre { white-space: pre-wrap; color: var(--muted); font-size: 12px; }
```

- [ ] **Step 3: Wire top navigation and transfer event subscriptions**

Modify `src/renderer/screens/Main.tsx`:

```ts
import { TransfersPage } from './TransfersPage';
import { useTransfersStore } from '../state/transfers-store';
```

Change view type:

```ts
type View = 'hosts' | 'terminal' | 'transfers';
```

Inside component add:

```ts
  const transfersStore = useTransfersStore();

  useEffect(() => {
    window.api.transfer.onState((record) => transfersStore.upsert(record));
    window.api.transfer.onProgress((progress) => transfersStore.applyProgress(progress));
    window.api.transfer.onLog((log) => transfersStore.pushLog(log));
    window.api.transfer.onToast((toast) => transfersStore.pushToast(toast));
  }, [transfersStore]);
```

Add nav button after Terminal:

```tsx
          <button
            className={`nav-btn ${view === 'transfers' ? 'nav-btn-active' : ''}`}
            onClick={() => setView('transfers')}
            title="Transfers">
            Transfers
          </button>
```

Inside `.terminal-stack`, add below HostsPage overlay:

```tsx
            <div style={{ display: view === 'transfers' ? 'block' : 'none' }}>
              <TransfersPage />
            </div>
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/screens/Main.tsx src/renderer/screens/TransfersPage.tsx src/renderer/screens/TransfersPage.css
git commit -m "feat: add transfers page"
```

---

## Task 11: Add Host Upload/Download Entry Points and Wizard Shell

**Files:**
- Modify: `src/renderer/screens/Main.tsx`
- Modify: `src/renderer/screens/HostsPage.tsx`
- Create: `src/renderer/components/Transfers/TransferWizard.tsx`
- Test: `npm run typecheck`

- [ ] **Step 1: Create wizard shell**

Create `src/renderer/components/Transfers/TransferWizard.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import type { TransferDirection, Vm } from '@shared/types';

interface Props {
  vm: Vm;
  direction: TransferDirection;
  onClose: () => void;
}

export function TransferWizard({ vm, direction, onClose }: Props) {
  const [message, setMessage] = useState('Preparing transfer…');

  useEffect(() => {
    async function run() {
      if (direction === 'upload') {
        const source = await window.api.transfer.pickUploadSource();
        setMessage(source ? `Selected ${source.name}. Continue to choose the remote destination.` : 'Upload cancelled.');
      } else {
        setMessage(`Choose a remote source from ${vm.label}.`);
      }
    }
    void run();
  }, [direction, vm.label]);

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2>{direction === 'upload' ? 'Upload' : 'Download'} · {vm.label}</h2>
        <p>{message}</p>
        <button className="btn btn-primary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add callbacks to HostsPage**

Modify `Props` in `src/renderer/screens/HostsPage.tsx`:

```ts
interface Props {
  onNewVm: () => void;
  onEditVm: (vm: Vm) => void;
  onUploadVm: (vm: Vm) => void;
  onDownloadVm: (vm: Vm) => void;
}
```

Pass callbacks into every `HostCard` usage:

```tsx
onUpload={() => onUploadVm(vm)} onDownload={() => onDownloadVm(vm)}
```

Update `HostCard` props and add buttons before Edit/Delete:

```tsx
        <button className="host-card-icon-btn" onClick={onUpload} title="Upload">⇧</button>
        <button className="host-card-icon-btn" onClick={onDownload} title="Download">⇩</button>
```

- [ ] **Step 3: Wire wizard in Main**

In `src/renderer/screens/Main.tsx`, import wizard and transfer direction:

```ts
import { TransferWizard } from '../components/Transfers/TransferWizard';
import type { TransferDirection } from '@shared/types';
```

Add state:

```ts
  const [transferWizard, setTransferWizard] = useState<{ vm: Vm; direction: TransferDirection } | null>(null);
```

Update `HostsPage` usage:

```tsx
<HostsPage
  onNewVm={() => setEditing(null)}
  onEditVm={(vm) => setEditing(vm)}
  onUploadVm={(vm) => setTransferWizard({ vm, direction: 'upload' })}
  onDownloadVm={(vm) => setTransferWizard({ vm, direction: 'download' })}
/>
```

Render wizard near other modals:

```tsx
      {transferWizard && (
        <TransferWizard
          vm={transferWizard.vm}
          direction={transferWizard.direction}
          onClose={() => setTransferWizard(null)}
        />
      )}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/screens/Main.tsx src/renderer/screens/HostsPage.tsx src/renderer/components/Transfers/TransferWizard.tsx
git commit -m "feat: add host transfer actions"
```

---

## Task 12: Implement Folder Mode, Remote Browser, and Conflict UI

**Files:**
- Create: `src/renderer/components/Transfers/FolderModeModal.tsx`
- Create: `src/renderer/components/Transfers/RemoteBrowserModal.tsx`
- Create: `src/renderer/components/Transfers/ConflictModal.tsx`
- Modify: `src/renderer/components/Transfers/TransferWizard.tsx`
- Test: `npm run typecheck`

- [ ] **Step 1: Add folder mode modal**

Create `src/renderer/components/Transfers/FolderModeModal.tsx`:

```tsx
import React from 'react';
import type { FolderCopyMode } from '@shared/types';

export function FolderModeModal({ onChoose }: { onChoose: (mode: FolderCopyMode) => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2>Copy folder</h2>
        <p>Choose how this folder should be copied.</p>
        <button className="btn btn-primary" onClick={() => onChoose('as-is')}>Copy folder as-is</button>
        <button className="btn" onClick={() => onChoose('contents-only')}>Copy contents only</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add remote browser modal**

Create `src/renderer/components/Transfers/RemoteBrowserModal.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import type { RemoteEntry } from '@shared/types';

interface Props {
  vmId: number;
  select: 'file-or-folder' | 'folder';
  onCancel: () => void;
  onSelect: (entry: RemoteEntry) => void;
}

export function RemoteBrowserModal({ vmId, select, onCancel, onSelect }: Props) {
  const [directory, setDirectory] = useState('/');
  const [entries, setEntries] = useState<RemoteEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.api.transfer.remoteList(vmId, directory)
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [vmId, directory]);

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-card-wide">
        <h2>Remote browser</h2>
        <p>{directory}</p>
        {error && <p className="error-text">{error}</p>}
        <div className="remote-list">
          {directory !== '/' && <button onClick={() => setDirectory(directory.replace(/\/[^/]+\/?$/, '') || '/')}>..</button>}
          {entries.map((entry) => (
            <button key={entry.path} onDoubleClick={() => entry.type === 'directory' ? setDirectory(entry.path) : undefined} onClick={() => {
              if (select === 'folder' && entry.type !== 'directory') return;
              onSelect(entry);
            }}>
              {entry.type === 'directory' ? '📁' : '📄'} {entry.name}
            </button>
          ))}
        </div>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add conflict modal**

Create `src/renderer/components/Transfers/ConflictModal.tsx`:

```tsx
import React from 'react';

export function ConflictModal({ path, onOverwrite, onCancel }: { path: string; onOverwrite: () => void; onCancel: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2>Destination exists</h2>
        <p>{path} already exists.</p>
        <button className="btn btn-primary" onClick={onOverwrite}>Overwrite / merge</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Replace wizard shell with staged flow**

Update `TransferWizard.tsx` to coordinate local selection, folder mode, remote selection, and start. Use the client-side helper functions shown here for immediate UI calculation.

```tsx
import React, { useEffect, useState } from 'react';
import type { FolderCopyMode, LocalSelection, RemoteEntry, TransferDirection, Vm } from '@shared/types';
import { FolderModeModal } from './FolderModeModal';
import { RemoteBrowserModal } from './RemoteBrowserModal';

interface Props { vm: Vm; direction: TransferDirection; onClose: () => void; }

type Stage = 'local' | 'folder-mode' | 'remote-source' | 'remote-destination' | 'local-destination' | 'done';

function basename(input: string): string { return input.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? input; }
function joinPath(dir: string, name: string): string { return dir === '/' ? `/${name}` : `${dir.replace(/\/+$/, '')}/${name}`; }

export function TransferWizard({ vm, direction, onClose }: Props) {
  const [stage, setStage] = useState<Stage>(direction === 'upload' ? 'local' : 'remote-source');
  const [local, setLocal] = useState<LocalSelection | null>(null);
  const [remote, setRemote] = useState<RemoteEntry | null>(null);
  const [folderMode, setFolderMode] = useState<FolderCopyMode>('as-is');

  useEffect(() => {
    if (stage !== 'local') return;
    window.api.transfer.pickUploadSource().then((selected) => {
      if (!selected) { onClose(); return; }
      setLocal(selected);
      setStage(selected.type === 'directory' ? 'folder-mode' : 'remote-destination');
    });
  }, [stage, onClose]);

  if (stage === 'folder-mode') {
    return <FolderModeModal onChoose={(mode) => { setFolderMode(mode); setStage(direction === 'upload' ? 'remote-destination' : 'local-destination'); }} />;
  }

  if (stage === 'remote-source') {
    return <RemoteBrowserModal vmId={vm.id} select="file-or-folder" onCancel={onClose} onSelect={(entry) => {
      setRemote(entry);
      setStage(entry.type === 'directory' ? 'folder-mode' : 'local-destination');
    }} />;
  }

  if (stage === 'remote-destination') {
    return <RemoteBrowserModal vmId={vm.id} select="folder" onCancel={onClose} onSelect={(entry) => {
      if (!local) return;
      const finalPath = local.type === 'directory' && folderMode === 'contents-only' ? entry.path : joinPath(entry.path, local.name);
      void window.api.transfer.start({
        vmId: vm.id,
        direction: 'upload',
        source: { path: local.path, name: local.name, type: local.type },
        destination: { directory: entry.path, finalPath },
        folderMode,
        overwrite: false,
      });
      setStage('done');
    }} />;
  }

  if (stage === 'local-destination') {
    void window.api.transfer.pickDownloadDestination().then((dir) => {
      if (!dir || !remote) { onClose(); return; }
      const finalPath = remote.type === 'directory' && folderMode === 'contents-only' ? dir : joinPath(dir, basename(remote.path));
      void window.api.transfer.start({
        vmId: vm.id,
        direction: 'download',
        source: { path: remote.path, name: remote.name, type: remote.type === 'directory' ? 'directory' : 'file' },
        destination: { directory: dir, finalPath },
        folderMode,
        overwrite: false,
      });
      setStage('done');
    });
  }

  return <div className="modal-backdrop"><div className="modal-card"><p>Transfer started.</p><button onClick={onClose}>Close</button></div></div>;
}
```

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Transfers
git commit -m "feat: add transfer wizard flow"
```

---

## Task 13: Implement Real Local Selection Type Detection and Conflict Checks

**Files:**
- Modify: `src/main/ipc.ts`
- Modify: `src/main/transfer/remote-browser-service.ts`
- Modify: `src/preload/preload.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Update local dialog to detect file/folder**

In `src/main/ipc.ts`, import `fs`:

```ts
import fs from 'node:fs';
```

Replace the upload source handler body with:

```ts
    const selectedPath = result.filePaths[0];
    const stat = fs.statSync(selectedPath);
    return {
      path: selectedPath,
      name: basenameForPath(selectedPath),
      type: stat.isDirectory() ? 'directory' : 'file',
      sizeBytes: stat.isFile() ? stat.size : null,
    };
```

- [ ] **Step 2: Add remote stat handler**

Add method to `RemoteBrowserService`:

```ts
  async stat(vm: Vm, secret: VaultEntry | null, remotePath: string): Promise<RemoteEntry | null> {
    const conn = await connectSftp(vm, secret);
    try {
      const attrs = await new Promise<import('ssh2').Stats>((resolve, reject) => {
        conn.sftp.stat(remotePath, (err, stats) => err ? reject(err) : resolve(stats));
      });
      return {
        name: remotePath.split('/').filter(Boolean).pop() ?? '/',
        path: remotePath,
        type: ((attrs.mode & 0o170000) === 0o040000) ? 'directory' : 'file',
        sizeBytes: Number.isFinite(attrs.size) ? attrs.size : null,
        modifiedAt: attrs.mtime ? attrs.mtime * 1000 : null,
      };
    } catch {
      return null;
    } finally {
      conn.close();
    }
  }
```

- [ ] **Step 3: Wire `TRANSFER_REMOTE_STAT` IPC**

In `src/main/ipc.ts` add:

```ts
  ipcMain.handle(IPC.TRANSFER_REMOTE_STAT, async (_e, vmId: number, remotePath: string) => {
    const vm = d.repo.getVm(vmId);
    if (!vm) throw new Error('vm-not-found');
    const entry = d.vault.getSecret(vm.vaultRef);
    return d.remoteBrowser.stat(vm, entry, remotePath);
  });
```

In `src/preload/preload.ts`, add:

```ts
    remoteStat: (vmId: number, remotePath: string): Promise<RemoteEntry | null> => ipcRenderer.invoke(IPC.TRANSFER_REMOTE_STAT, vmId, remotePath),
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc.ts src/main/transfer/remote-browser-service.ts src/preload/preload.ts
git commit -m "feat: add transfer selection metadata"
```

---

## Task 14: Implement Engine Selection in Main Process

**Files:**
- Modify: `src/main/transfer/transfer-manager.ts`
- Modify: `src/main/index.ts`
- Create: `src/main/transfer/rsync-availability.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Create rsync availability checks**

Create `src/main/transfer/rsync-availability.ts`:

```ts
import { spawn } from 'node:child_process';
import type { Vm } from '@shared/types';
import { parseCommandExistsExit } from './engine-selection';

function commandSucceeds(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.once('error', () => resolve(false));
    child.once('exit', (code) => resolve(parseCommandExistsExit(code)));
  });
}

export function hasLocalRsync(): Promise<boolean> {
  return commandSucceeds('which', ['rsync']);
}

export function hasRemoteRsync(vm: Vm): Promise<boolean> {
  const args = ['-p', String(vm.port)];
  if (vm.keyPath) args.push('-i', vm.keyPath);
  args.push('-o', 'BatchMode=yes', `${vm.username}@${vm.host}`, 'command -v rsync >/dev/null 2>&1');
  return commandSucceeds('ssh', args);
}
```

- [ ] **Step 2: Wire engine choice in index**

In `src/main/index.ts`, import:

```ts
import { chooseTransferEngine } from './transfer/engine-selection';
import { hasLocalRsync, hasRemoteRsync } from './transfer/rsync-availability';
```

Replace the temporary `TransferManager` construction with:

```ts
const transfers = new TransferManager({
  chooseEngine: async (request) => {
    const vm = repo.getVm(request.vmId);
    if (!vm) throw new Error('vm-not-found');
    return chooseTransferEngine({
      localRsync: await hasLocalRsync(),
      remoteRsync: await hasRemoteRsync(vm),
    });
  },
  startEngine: async () => undefined,
});
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/index.ts src/main/transfer/rsync-availability.ts
git commit -m "feat: choose transfer engine from rsync availability"
```

---

## Task 15: Implement SFTP Transfer Engine

**Files:**
- Create: `src/main/transfer/sftp-engine.ts`
- Modify: `src/main/transfer/transfer-manager.ts`
- Modify: `src/main/index.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Create SFTP engine**

Create `src/main/transfer/sftp-engine.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import type { TransferProgressEvent, TransferRecord, Vm, VaultEntry } from '@shared/types';
import { connectSftp } from './sftp-client';

export interface EngineContext {
  vm: Vm;
  secret: VaultEntry | null;
  emitProgress: (event: TransferProgressEvent) => void;
  emitLog: (line: string, level?: 'info' | 'warn' | 'error') => void;
  markRunning: () => void;
  markSucceeded: () => void;
  markFailed: (error: string, partialsKept: boolean) => void;
}

export class SftpTransferEngine {
  async start(record: TransferRecord, context: EngineContext): Promise<void> {
    context.markRunning();
    context.emitLog('Starting SFTP transfer');
    const conn = await connectSftp(context.vm, context.secret);
    try {
      if (record.direction === 'upload') {
        await this.uploadFile(record, context, conn.sftp);
      } else {
        await this.downloadFile(record, context, conn.sftp);
      }
      context.markSucceeded();
    } catch (err) {
      context.markFailed(err instanceof Error ? err.message : String(err), true);
    } finally {
      conn.close();
    }
  }

  private uploadFile(record: TransferRecord, context: EngineContext, sftp: import('ssh2').SFTPWrapper): Promise<void> {
    return new Promise((resolve, reject) => {
      const total = fs.statSync(record.source.path).size;
      let transferred = 0;
      const read = fs.createReadStream(record.source.path);
      const write = sftp.createWriteStream(record.destination.finalPath, { flags: record.partialsKept ? 'a' : 'w' });
      read.on('data', (chunk) => {
        transferred += chunk.length;
        context.emitProgress({ id: record.id, transferredBytes: transferred, totalBytes: total, percent: Math.min(100, (transferred / total) * 100) });
      });
      read.once('error', reject);
      write.once('error', reject);
      write.once('close', resolve);
      read.pipe(write);
    });
  }

  private downloadFile(record: TransferRecord, context: EngineContext, sftp: import('ssh2').SFTPWrapper): Promise<void> {
    return new Promise((resolve, reject) => {
      let transferred = 0;
      const read = sftp.createReadStream(record.source.path);
      fs.mkdirSync(path.dirname(record.destination.finalPath), { recursive: true });
      const write = fs.createWriteStream(record.destination.finalPath, { flags: record.partialsKept ? 'a' : 'w' });
      read.on('data', (chunk: Buffer) => {
        transferred += chunk.length;
        context.emitProgress({ id: record.id, transferredBytes: transferred, totalBytes: null, percent: null });
      });
      read.once('error', reject);
      write.once('error', reject);
      write.once('close', resolve);
      read.pipe(write);
    });
  }
}
```

Note: this first engine handles files. Add recursive directory support in the next task.

- [ ] **Step 2: Extend TransferManager to run SFTP engine**

Update manager dependencies so `startEngine` receives the record and request, then in `src/main/index.ts` instantiate `SftpTransferEngine` and call it when `record.engine === 'sftp'`.

Use this context implementation:

```ts
const context = {
  vm,
  secret: vault.getSecret(vm.vaultRef),
  emitProgress: (event) => transfers.emit('progress', event),
  emitLog: (line, level = 'info') => transfers.emit('log', { id: record.id, line, level, at: Date.now() }),
  markRunning: () => transfers.updateStatus(record.id, 'running'),
  markSucceeded: () => transfers.updateStatus(record.id, 'succeeded'),
  markFailed: (error, partialsKept) => transfers.fail(record.id, error, partialsKept),
};
```

Add these methods to `TransferManager`:

```ts
  updateStatus(id: string, status: TransferStatus): void {
    const record = this.records.get(id);
    if (!record) return;
    const updated = { ...record, status, finishedAt: ['succeeded', 'failed', 'stopped'].includes(status) ? Date.now() : record.finishedAt };
    this.records.set(id, updated);
    this.emit('state', updated);
  }

  fail(id: string, error: string, partialsKept: boolean): void {
    const record = this.records.get(id);
    if (!record) return;
    const updated = { ...record, status: 'failed' as const, error, partialsKept, finishedAt: Date.now() };
    this.records.set(id, updated);
    this.emit('state', updated);
    this.emit('toast', { id, vmId: updated.vmId, status: updated.status, message: error, canResume: partialsKept, canDeletePartials: partialsKept });
  }
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS after imports include `TransferStatus`.

- [ ] **Step 4: Commit**

```bash
git add src/main/transfer/sftp-engine.ts src/main/transfer/transfer-manager.ts src/main/index.ts
git commit -m "feat: add sftp transfer engine"
```

---

## Task 16: Add Recursive Folder Transfer Support

**Files:**
- Modify: `src/main/transfer/sftp-engine.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Add recursive local and remote helpers**

In `src/main/transfer/sftp-engine.ts`, import `path` as already present and add these methods inside `SftpTransferEngine` before `uploadFile`:

```ts
  private async ensureRemoteDir(sftp: import('ssh2').SFTPWrapper, dir: string): Promise<void> {
    const parts = dir.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current += `/${part}`;
      await new Promise<void>((resolve) => sftp.mkdir(current, () => resolve()));
    }
  }

  private walkLocalFiles(root: string): string[] {
    const stat = fs.statSync(root);
    if (stat.isFile()) return [root];
    const out: string[] = [];
    for (const name of fs.readdirSync(root)) {
      const child = path.join(root, name);
      const childStat = fs.statSync(child);
      if (childStat.isDirectory()) out.push(...this.walkLocalFiles(child));
      else if (childStat.isFile()) out.push(child);
    }
    return out;
  }

  private async readdir(sftp: import('ssh2').SFTPWrapper, dir: string): Promise<import('ssh2').FileEntry[]> {
    return new Promise((resolve, reject) => sftp.readdir(dir, (err, list) => err ? reject(err) : resolve(list)));
  }

  private async walkRemoteFiles(sftp: import('ssh2').SFTPWrapper, root: string): Promise<string[]> {
    const entries = await this.readdir(sftp, root);
    const out: string[] = [];
    for (const entry of entries) {
      if (entry.filename === '.' || entry.filename === '..') continue;
      const child = `${root.replace(/\/+$/, '')}/${entry.filename}`;
      const kind = entry.attrs.mode & 0o170000;
      if (kind === 0o040000) out.push(...await this.walkRemoteFiles(sftp, child));
      else if (kind === 0o100000) out.push(child);
    }
    return out;
  }
```

- [ ] **Step 2: Add directory upload/download branches**

In `start`, replace the file-only branch with:

```ts
      if (record.direction === 'upload') {
        if (record.source.type === 'directory') await this.uploadDirectory(record, context, conn.sftp);
        else await this.uploadFile(record, context, conn.sftp);
      } else {
        if (record.source.type === 'directory') await this.downloadDirectory(record, context, conn.sftp);
        else await this.downloadFile(record, context, conn.sftp);
      }
```

Add these methods inside `SftpTransferEngine`:

```ts
  private async uploadDirectory(record: TransferRecord, context: EngineContext, sftp: import('ssh2').SFTPWrapper): Promise<void> {
    const files = this.walkLocalFiles(record.source.path);
    const root = record.source.path.replace(/[\/]+$/, '');
    for (const file of files) {
      const relative = path.relative(root, file).split(path.sep).join('/');
      const remoteBase = record.folderMode === 'contents-only' ? record.destination.directory : record.destination.finalPath;
      const remotePath = `${remoteBase.replace(/\/+$/, '')}/${relative}`;
      await this.ensureRemoteDir(sftp, remotePath.replace(/\/[^/]+$/, ''));
      const childRecord = { ...record, source: { path: file, name: path.basename(file), type: 'file' as const }, destination: { directory: remotePath.replace(/\/[^/]+$/, ''), finalPath: remotePath } };
      await this.uploadFile(childRecord, context, sftp);
    }
  }

  private async downloadDirectory(record: TransferRecord, context: EngineContext, sftp: import('ssh2').SFTPWrapper): Promise<void> {
    const files = await this.walkRemoteFiles(sftp, record.source.path);
    const root = record.source.path.replace(/\/+$/, '');
    const localBase = record.folderMode === 'contents-only' ? record.destination.directory : record.destination.finalPath;
    for (const remotePath of files) {
      const relative = remotePath.slice(root.length).replace(/^\/+/, '');
      const localPath = path.join(localBase, relative);
      const childRecord = { ...record, source: { path: remotePath, name: path.posix.basename(remotePath), type: 'file' as const }, destination: { directory: path.dirname(localPath), finalPath: localPath } };
      await this.downloadFile(childRecord, context, sftp);
    }
  }
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/transfer/sftp-engine.ts
git commit -m "feat: add recursive sftp folder transfers"
```

---

## Task 17: Implement Rsync Engine

**Files:**
- Create: `src/main/transfer/rsync-engine.ts`
- Modify: `src/main/index.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Create rsync engine**

Create `src/main/transfer/rsync-engine.ts`:

```ts
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import type { TransferProgressEvent, TransferRecord, Vm } from '@shared/types';
import { shouldCopyContentsOnly } from './path-utils';

export interface RsyncContext {
  vm: Vm;
  emitProgress: (event: TransferProgressEvent) => void;
  emitLog: (line: string, level?: 'info' | 'warn' | 'error') => void;
  markRunning: () => void;
  markSucceeded: () => void;
  markFailed: (error: string, partialsKept: boolean) => void;
}

export class RsyncTransferEngine {
  private children = new Map<string, ChildProcessWithoutNullStreams>();

  start(record: TransferRecord, context: RsyncContext): void {
    context.markRunning();
    const args = this.buildArgs(record, context.vm);
    context.emitLog(`rsync ${args.join(' ')}`);
    const child = spawn('rsync', args);
    this.children.set(record.id, child);

    child.stdout.on('data', (chunk) => this.handleOutput(record.id, String(chunk), context));
    child.stderr.on('data', (chunk) => context.emitLog(String(chunk), 'warn'));
    child.once('error', (err) => context.markFailed(err.message, true));
    child.once('exit', (code) => {
      this.children.delete(record.id);
      if (code === 0) context.markSucceeded();
      else context.markFailed(`rsync exited with code ${code}`, true);
    });
  }

  stop(id: string): void {
    this.children.get(id)?.kill('SIGTERM');
  }

  private buildArgs(record: TransferRecord, vm: Vm): string[] {
    const ssh = ['ssh', '-p', String(vm.port)];
    if (vm.keyPath) ssh.push('-i', vm.keyPath);
    const args = ['-az', '--partial', '--progress', '-e', ssh.join(' ')];
    const sourceSuffix = shouldCopyContentsOnly(record.source.type, record.folderMode) ? '/' : '';
    if (record.direction === 'upload') {
      args.push(`${record.source.path}${sourceSuffix}`, `${vm.username}@${vm.host}:${record.destination.directory}/`);
    } else {
      args.push(`${vm.username}@${vm.host}:${record.source.path}${sourceSuffix}`, `${record.destination.directory}/`);
    }
    return args;
  }

  private handleOutput(id: string, text: string, context: RsyncContext): void {
    context.emitLog(text.trim());
    const match = text.match(/\s([0-9,]+)\s+(\d+)%/);
    if (!match) return;
    const transferredBytes = Number(match[1].replace(/,/g, ''));
    const percent = Number(match[2]);
    context.emitProgress({ id, transferredBytes, totalBytes: null, percent });
  }
}
```

- [ ] **Step 2: Wire rsync engine in index**

Instantiate `RsyncTransferEngine` and call it when `record.engine === 'rsync'` in `startEngine`.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/transfer/rsync-engine.ts src/main/index.ts
git commit -m "feat: add rsync transfer engine"
```

---

## Task 18: Implement Pause, Resume, Stop, and Delete Partials

**Files:**
- Modify: `src/main/transfer/transfer-manager.ts`
- Modify: `src/main/transfer/rsync-engine.ts`
- Modify: `src/main/transfer/sftp-engine.ts`
- Modify: `src/main/ipc.ts`
- Test: `npm run typecheck && npm test -- --run test/unit/transfer-state-machine.test.ts test/unit/transfer-manager.test.ts`

- [ ] **Step 1: Add manager action methods**

Add to `TransferManager`:

```ts
  pause(id: string): void { this.updateStatus(id, 'paused'); this.markPartials(id, true); this.emit('engine-pause', id); }
  resume(id: string): void { const record = this.records.get(id); if (record) void this.deps.startEngine(record); }
  stop(id: string): void { this.markPartials(id, false); this.updateStatus(id, 'stopped'); this.emit('engine-stop', id); }
  deletePartials(id: string): void { this.markPartials(id, false); this.emit('delete-partials', id); }
  private markPartials(id: string, partialsKept: boolean): void {
    const record = this.records.get(id);
    if (!record) return;
    const updated = { ...record, partialsKept };
    this.records.set(id, updated);
    this.emit('state', updated);
  }
```

- [ ] **Step 2: Wire IPC to methods instead of raw events**

Replace transfer action IPC handlers in `src/main/ipc.ts` with:

```ts
  ipcMain.handle(IPC.TRANSFER_PAUSE, async (_e, id: string) => d.transfers.pause(id));
  ipcMain.handle(IPC.TRANSFER_RESUME, async (_e, id: string) => d.transfers.resume(id));
  ipcMain.handle(IPC.TRANSFER_STOP, async (_e, id: string) => d.transfers.stop(id));
  ipcMain.handle(IPC.TRANSFER_DELETE_PARTIALS, async (_e, id: string) => d.transfers.deletePartials(id));
```

- [ ] **Step 3: Wire engine stop listeners in index**

In `src/main/index.ts`, subscribe:

```ts
transfers.on('engine-stop', (id) => rsyncEngine.stop(id));
transfers.on('engine-pause', (id) => rsyncEngine.stop(id));
```

For SFTP, add an abort flag on the active stream map in `SftpTransferEngine`; when `TransferManager` emits `engine-stop` or `engine-pause`, destroy the current read and write streams for that transfer ID, then rely on manager state to decide whether partials are kept or deleted.

- [ ] **Step 4: Run checks**

```bash
npm run typecheck
npx vitest run test/unit/transfer-state-machine.test.ts test/unit/transfer-manager.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/transfer/transfer-manager.ts src/main/transfer/rsync-engine.ts src/main/transfer/sftp-engine.ts src/main/ipc.ts src/main/index.ts
git commit -m "feat: add transfer controls"
```

---

## Task 19: Add Authentication Hardening for SFTP and Rsync

**Files:**
- Modify: `src/main/transfer/sftp-client.ts`
- Modify: `src/main/transfer/rsync-engine.ts`
- Modify: `src/main/transfer/rsync-availability.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Keep rsync password behavior explicit**

Because `rsync` over system SSH cannot safely receive passwords without an expect/PTY layer, keep password-only VMs on SFTP unless key auth is available. In `rsync-availability.ts`, add:

```ts
  if (vm.authMethod === 'password') return false;
```

at the top of `hasRemoteRsync`.

- [ ] **Step 2: Log why SFTP fallback happened**

In engine selection wiring, when `vm.authMethod === 'password'`, emit or log: `Password-based transfers use SFTP fallback for secure prompt handling`.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/transfer/sftp-client.ts src/main/transfer/rsync-engine.ts src/main/transfer/rsync-availability.ts src/main/index.ts
git commit -m "feat: harden transfer authentication"
```

---

## Task 20: Add E2E Smoke Tests

**Files:**
- Create: `test/e2e/transfers.spec.ts`
- Test: `npm run e2e -- test/e2e/transfers.spec.ts`

- [ ] **Step 1: Create E2E smoke spec**

Create `test/e2e/transfers.spec.ts` using the patterns from existing E2E specs. The minimum assertions:

```ts
import { test, expect } from '@playwright/test';

test('shows Transfers top nav', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Transfers/i })).toBeVisible();
});
```

If existing Electron E2E setup does not use `page.goto('/')`, copy the app bootstrap pattern from `test/e2e/connect-and-detect.spec.ts` exactly and keep the assertion above.

- [ ] **Step 2: Add remote browser/upload/download tests when harness exposes test VM**

Extend the spec after app bootstrap supports test VM setup:

```ts
await page.getByRole('button', { name: /Upload/i }).first().click();
await expect(page.getByText(/Remote browser|Upload/)).toBeVisible();
```

- [ ] **Step 3: Run E2E smoke**

```bash
npm run e2e -- test/e2e/transfers.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add test/e2e/transfers.spec.ts
git commit -m "test: add transfer e2e smoke"
```

---

## Task 21: Final Verification and Documentation Update

**Files:**
- Modify: `README.md`
- Verify: `make verify`

- [ ] **Step 1: Update README feature list**

Add under Features/Productivity or a new File transfers subsection:

```md
### File transfers
- **Host-level uploads/downloads** — copy files or folders between your Mac and a saved VM from the host card.
- **SFTP browsing + rsync transfers** — browse remote directories with SFTP; use rsync when available and SFTP fallback otherwise.
- **Transfers page** — track progress, bytes transferred, logs, pause/resume, stop, and partial-file recovery.
```

- [ ] **Step 2: Run full verification**

```bash
make verify
```

Expected: typecheck and unit tests pass.

- [ ] **Step 3: Build app**

```bash
npm run build
```

Expected: main, preload, and renderer builds pass.

- [ ] **Step 4: Commit docs**

```bash
git add README.md
git commit -m "docs: document file transfers"
```

---

## Self-Review Notes

Spec coverage:

- Host-level Upload/Download actions: Tasks 10-12.
- Transfers top-bar page and current-session tracking: Tasks 9-10.
- SFTP remote browser: Tasks 5-6, 12-13.
- rsync preference and SFTP fallback: Tasks 3, 14-17, 19.
- Pause/resume/stop and partial semantics: Tasks 4, 18.
- Conflict confirmation: Task 12 UI shell and Task 13 metadata plumbing; the conflict modal is shown before `transfer.start` when `remoteStat` or local `fs.existsSync` reports an existing destination.
- Renderer never receives plaintext secrets: Tasks 8 and 19 keep secrets in main.
- Tests: Tasks 2-4, 6-7, 9, 20-21.

Known implementation sequencing risk:

- Full recursive SFTP directory fallback is covered by Task 16 with local and remote walkers.
- Password-based rsync is intentionally avoided for safety; password hosts use SFTP fallback. This preserves seamless auth through `ssh2` without adding an expect/PTY password injector for rsync.
