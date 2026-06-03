# Transfers UI Redesign + Icon Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 0B progress bug, add VM info to transfer cards, swap all Unicode symbols for Lucide React icons, redesign transfer card badges, and remove the "Delete partials" button.

**Architecture:** Backend changes (types + manager) first, then renderer. Icon pack is installed once and used across HostsPage, TransfersPage, and Main. All changes are on the existing `feat/file-transfers` branch.

**Tech Stack:** TypeScript, React, Lucide React, Zustand, Vitest, Electron

---

## File Map

| File | What changes |
|------|-------------|
| `src/shared/types.ts` | Add `vmLabel`/`vmHost` to `TransferRecord` and `TransferStartRequest` |
| `src/main/transfer/transfer-manager.ts` | Add `applyProgress()`; update `fail()` to call `markPartials(id, false)` |
| `src/main/index.ts` | Wire `emitProgress` to also call `transfers.applyProgress()` |
| `src/renderer/components/Transfers/TransferWizard.tsx` | Pass `vmLabel`/`vmHost` in both `start()` calls |
| `test/unit/transfer-manager.test.ts` | Tests for `applyProgress()` and fail auto-partials |
| `test/unit/transfers-store.test.ts` | Test that `upsert` after `applyProgress` preserves bytes |
| `package.json` | Add `lucide-react` |
| `src/renderer/screens/Main.tsx` | Replace 🔒 with `<Lock>` Lucide icon |
| `src/renderer/screens/HostsPage.tsx` | Replace ⊟ ⇧ ⇩ ✎ ✕ ⌕ with Lucide icons |
| `src/renderer/screens/HostsPage.css` | Fix `.chip-count` background to `var(--bg-muted)` |
| `src/renderer/screens/TransfersPage.tsx` | Full card redesign: VM header, color badges, icon buttons, no partials button |
| `src/renderer/screens/TransfersPage.css` | New badge + action button styles |

---

## Task 1: Add vmLabel/vmHost to shared types

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add fields to TransferStartRequest and TransferRecord**

Open `src/shared/types.ts`. Find `TransferStartRequest` (line ~93) and `TransferRecord` (line ~102). Add `vmLabel` and `vmHost` to both:

```ts
export interface TransferStartRequest {
  vmId: number;
  vmLabel: string;
  vmHost: string;
  direction: TransferDirection;
  source: TransferSource;
  destination: TransferDestination;
  folderMode: FolderCopyMode;
  overwrite: boolean;
}
```

```ts
export interface TransferRecord {
  id: string;
  vmId: number;
  vmLabel: string;
  vmHost: string;
  direction: TransferDirection;
  // ... rest unchanged
}
```

- [ ] **Step 2: Run the TypeScript compiler to find all call sites that need updating**

```bash
npx tsc --noEmit 2>&1 | grep "vmLabel\|vmHost\|TransferStartRequest\|TransferRecord" | head -30
```

Expected: errors pointing at `transfer-manager.ts`, `TransferWizard.tsx`, and test fixtures. These will be fixed in subsequent tasks.

- [ ] **Step 3: Update TransferManager to copy vmLabel/vmHost onto the record**

In `src/main/transfer/transfer-manager.ts`, in the `start()` method, add the two fields when constructing the record:

```ts
const record: TransferRecord = {
  id: randomUUID(),
  vmId: request.vmId,
  vmLabel: request.vmLabel,
  vmHost: request.vmHost,
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
```

- [ ] **Step 4: Update TransferWizard to pass vmLabel and vmHost**

In `src/renderer/components/Transfers/TransferWizard.tsx`, both `window.api.transfer.start()` calls need the new fields. The `vm` prop is already in scope.

Upload call (line ~43):
```ts
void window.api.transfer.start({
  vmId: vm.id,
  vmLabel: vm.label,
  vmHost: vm.host,
  direction: 'upload',
  source: { path: local.path, name: local.name, type: local.type },
  destination: { directory: entry.path, finalPath },
  folderMode,
  overwrite: false,
});
```

Download call (line ~60):
```ts
void window.api.transfer.start({
  vmId: vm.id,
  vmLabel: vm.label,
  vmHost: vm.host,
  direction: 'download',
  source: { path: remote.path, name: remote.name, type: remote.type === 'directory' ? 'directory' : 'file' },
  destination: { directory: dir, finalPath },
  folderMode,
  overwrite: false,
});
```

- [ ] **Step 5: Update test fixture in transfer-manager.test.ts**

In `test/unit/transfer-manager.test.ts`, the `request()` helper needs the new fields:

```ts
function request(vmId = 1): TransferStartRequest {
  return {
    vmId,
    vmLabel: 'Test VM',
    vmHost: '10.0.0.1',
    direction: 'upload',
    source: { path: '/tmp/a.txt', name: 'a.txt', type: 'file' },
    destination: { directory: '/home/admin', finalPath: '/home/admin/a.txt' },
    folderMode: 'as-is',
    overwrite: true,
  };
}
```

- [ ] **Step 6: Update test fixture in transfers-store.test.ts**

In `test/unit/transfers-store.test.ts`, the `record()` helper needs the new fields:

```ts
function record(id: string, status: TransferRecord['status']): TransferRecord {
  return {
    id,
    vmId: 1,
    vmLabel: 'Test VM',
    vmHost: '10.0.0.1',
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
```

- [ ] **Step 7: Run unit tests**

```bash
npx vitest run test/unit/transfer-manager.test.ts test/unit/transfers-store.test.ts
```

Expected: all existing tests pass.

- [ ] **Step 8: Run tsc**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to vmLabel/vmHost.

- [ ] **Step 9: Commit**

```bash
git add src/shared/types.ts src/main/transfer/transfer-manager.ts src/renderer/components/Transfers/TransferWizard.tsx test/unit/transfer-manager.test.ts test/unit/transfers-store.test.ts
git commit -m "feat: snapshot vmLabel and vmHost onto TransferRecord"
```

---

## Task 2: Fix progress bytes tracking in TransferManager

**Files:**
- Modify: `src/main/transfer/transfer-manager.ts`
- Modify: `src/main/index.ts`
- Modify: `test/unit/transfer-manager.test.ts`

**Problem:** `TransferManager` never updates its internal record with progress bytes. When `updateStatus('succeeded')` emits `'state'`, the record still has `transferredBytes: 0`, overwriting progress accumulated in the renderer store.

**Fix:** Add `applyProgress()` to the manager so the stored record stays in sync. Wire `emitProgress` in `index.ts` to call it.

- [ ] **Step 1: Write the failing test**

Add to `test/unit/transfer-manager.test.ts`:

```ts
it('preserves transferredBytes in state event after progress applied', async () => {
  const stateEvents: TransferRecord[] = [];
  const manager = new TransferManager({ chooseEngine: async () => 'sftp', startEngine: vi.fn() });
  manager.on('state', (r: TransferRecord) => stateEvents.push(r));

  const record = await manager.start(request());
  manager.applyProgress({ id: record.id, transferredBytes: 1024, totalBytes: 2048, percent: 50 });
  manager.updateStatus(record.id, 'succeeded');

  const finalState = stateEvents[stateEvents.length - 1];
  expect(finalState.transferredBytes).toBe(1024);
  expect(finalState.percent).toBe(50);
});
```

You'll need to import `TransferRecord` at the top if not already present:
```ts
import type { TransferRecord, TransferStartRequest } from '../../src/shared/types';
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run test/unit/transfer-manager.test.ts
```

Expected: FAIL — `manager.applyProgress is not a function`

- [ ] **Step 3: Add applyProgress() to TransferManager**

In `src/main/transfer/transfer-manager.ts`, add after the `deletePartials()` method:

```ts
applyProgress(event: TransferProgressEvent): void {
  const record = this.records.get(event.id);
  if (!record) return;
  const updated = { ...record, transferredBytes: event.transferredBytes, totalBytes: event.totalBytes, percent: event.percent };
  this.records.set(event.id, updated);
}
```

Also add the import at the top if not already there:
```ts
import type { TransferEngineName, TransferProgressEvent, TransferRecord, TransferStartRequest, TransferStatus } from '@shared/types';
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/unit/transfer-manager.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Wire applyProgress in index.ts**

In `src/main/index.ts`, find the `emitProgress` callback (line ~72):

```ts
emitProgress: (event: import('@shared/types').TransferProgressEvent) => transfers.emit('progress', event),
```

Change it to:

```ts
emitProgress: (event: import('@shared/types').TransferProgressEvent) => {
  transfers.applyProgress(event);
  transfers.emit('progress', event);
},
```

- [ ] **Step 6: Run tsc**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/main/transfer/transfer-manager.ts src/main/index.ts test/unit/transfer-manager.test.ts
git commit -m "fix: preserve transferredBytes in final state event after transfer completes"
```

---

## Task 3: Auto-delete partials on fail

**Files:**
- Modify: `src/main/transfer/transfer-manager.ts`
- Modify: `test/unit/transfer-manager.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `test/unit/transfer-manager.test.ts`:

```ts
it('sets partialsKept to false when transfer fails', async () => {
  const stateEvents: TransferRecord[] = [];
  const manager = new TransferManager({ chooseEngine: async () => 'sftp', startEngine: vi.fn() });
  manager.on('state', (r: TransferRecord) => stateEvents.push(r));

  const record = await manager.start(request());
  manager.fail(record.id, 'connection lost', true);

  const finalState = stateEvents[stateEvents.length - 1];
  expect(finalState.partialsKept).toBe(false);
  expect(finalState.status).toBe('failed');
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run test/unit/transfer-manager.test.ts
```

Expected: FAIL — `expected true to be false` (currently fail keeps `partialsKept: true` when passed `true`)

- [ ] **Step 3: Update fail() to always clear partialsKept**

In `src/main/transfer/transfer-manager.ts`, find the `fail()` method and change:

```ts
fail(id: string, error: string, partialsKept: boolean): void {
  const record = this.records.get(id);
  if (!record) return;
  const updated = { ...record, status: 'failed' as const, error, partialsKept: false, finishedAt: Date.now() };
  this.records.set(id, updated);
  this.emit('state', updated);
  this.emit('toast', { id, vmId: updated.vmId, status: updated.status, message: error, canResume: false, canDeletePartials: false });
}
```

Note: `partialsKept` parameter is kept in the signature (engines still pass it) but we always use `false`. `canResume` and `canDeletePartials` in the toast are also set to `false`.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/unit/transfer-manager.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/transfer/transfer-manager.ts test/unit/transfer-manager.test.ts
git commit -m "fix: always clear partialsKept on transfer failure"
```

---

## Task 4: Install Lucide React + update HostsPage and Main

**Files:**
- Modify: `package.json` (via npm)
- Modify: `src/renderer/screens/Main.tsx`
- Modify: `src/renderer/screens/HostsPage.tsx`
- Modify: `src/renderer/screens/HostsPage.css`

- [ ] **Step 1: Install lucide-react**

```bash
npm install lucide-react
```

Expected: package installed, `package.json` and `package-lock.json` updated.

- [ ] **Step 2: Update Main.tsx lock button**

In `src/renderer/screens/Main.tsx`, add the import at the top:

```ts
import { Lock } from 'lucide-react';
```

Find the lock button (line ~116):
```tsx
<button className="app-header-lock" onClick={() => void lock()} title="Lock (⌘L)">
  🔒
</button>
```

Change to:
```tsx
<button className="app-header-lock" onClick={() => void lock()} title="Lock (⌘L)">
  <Lock size={14} />
</button>
```

- [ ] **Step 3: Update HostsPage.tsx icons**

In `src/renderer/screens/HostsPage.tsx`, add the import:

```ts
import { Download, Pencil, Search, Server, Upload, X } from 'lucide-react';
```

Replace search icon in the search field (find `className="hosts-search-icon"`):
```tsx
<span className="hosts-search-icon"><Search size={14} /></span>
```

In `HostCard`, replace the card icon:
```tsx
<div className="host-card-icon"><Server size={18} /></div>
```

Replace the empty state icon (find `className="hosts-empty-icon"`):
```tsx
<div className="hosts-empty-icon"><Server size={26} /></div>
```

Replace the four action icon buttons:
```tsx
<button className="host-card-icon-btn" onClick={onUpload} title="Upload"><Upload size={14} /></button>
<button className="host-card-icon-btn" onClick={onDownload} title="Download"><Download size={14} /></button>
<button className="host-card-icon-btn" onClick={onEdit} title="Edit"><Pencil size={14} /></button>
<button className="host-card-icon-btn" onClick={onDelete} title="Delete"><X size={14} /></button>
```

- [ ] **Step 4: Fix chip-count CSS**

In `src/renderer/screens/HostsPage.css`, find `.chip-count`:

```css
.chip-count {
  background: rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 600;
}
```

Change the background:
```css
.chip-count {
  background: var(--bg-muted);
  border-radius: 8px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 600;
}
```

- [ ] **Step 5: Run tsc**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/renderer/screens/Main.tsx src/renderer/screens/HostsPage.tsx src/renderer/screens/HostsPage.css
git commit -m "feat: add lucide-react icons to HostsPage and Main header"
```

---

## Task 5: Redesign TransfersPage

**Files:**
- Modify: `src/renderer/screens/TransfersPage.tsx`
- Modify: `src/renderer/screens/TransfersPage.css`

- [ ] **Step 1: Update TransfersPage.tsx**

Replace the entire file content with:

```tsx
import React from 'react';
import { Download, PauseCircle, PlayCircle, Server, StopCircle, Upload } from 'lucide-react';
import { useTransfersStore } from '../state/transfers-store';
import './TransfersPage.css';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function progressLabel(transferredBytes: number, totalBytes: number | null, percent: number | null): string {
  if (percent != null) return `${percent.toFixed(0)}%`;
  return formatBytes(transferredBytes);
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
              <div className="transfer-card-head">
                <div className="transfer-card-vm">
                  <div className="transfer-vm-icon">
                    <Server size={16} />
                  </div>
                  <div className="transfer-vm-info">
                    <div className="transfer-vm-label">{transfer.vmLabel}</div>
                    <div className="transfer-vm-host">{transfer.vmHost}</div>
                  </div>
                </div>
                <div className="transfer-card-badges">
                  <span className="transfer-badge-engine">{transfer.engine}</span>
                  <span className={`transfer-badge-status transfer-badge-${transfer.status}`}>{transfer.status}</span>
                </div>
              </div>
              <div className="transfer-file-row">
                <span className="transfer-direction-icon">
                  {transfer.direction === 'upload' ? <Upload size={12} /> : <Download size={12} />}
                </span>
                <span className="transfer-filename">{transfer.source.name}</span>
              </div>
              <div className="transfer-sub">{transfer.source.path} → {transfer.destination.finalPath}</div>
              <div className="transfer-progress-row">
                <progress value={transfer.percent ?? 0} max={100} />
                <span>{progressLabel(transfer.transferredBytes, transfer.totalBytes, transfer.percent)}</span>
              </div>
              <div className="transfer-actions">
                <button
                  className="transfer-action-btn"
                  disabled={transfer.status !== 'running'}
                  onClick={() => void window.api.transfer.pause(transfer.id)}
                  title="Pause"
                >
                  <PauseCircle size={14} />
                </button>
                <button
                  className="transfer-action-btn"
                  disabled={!['paused', 'failed'].includes(transfer.status)}
                  onClick={() => void window.api.transfer.resume(transfer.id)}
                  title="Resume"
                >
                  <PlayCircle size={14} />
                </button>
                <button
                  className="transfer-action-btn"
                  disabled={!['preparing', 'running', 'paused'].includes(transfer.status)}
                  onClick={() => void window.api.transfer.stop(transfer.id)}
                  title="Stop"
                >
                  <StopCircle size={14} />
                </button>
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

- [ ] **Step 2: Update TransfersPage.css**

Replace the entire file content with:

```css
.transfers-page { padding: 28px; color: var(--text); }
.transfers-header { display: flex; justify-content: space-between; align-items: end; margin-bottom: 20px; }
.transfers-header h1 { margin: 0; font-size: 28px; }
.transfers-header p { margin: 0; color: var(--text-muted); }
.transfers-empty { border: 1px dashed var(--border); border-radius: 18px; padding: 40px; color: var(--muted); text-align: center; }
.transfers-list { display: grid; gap: 14px; }

.transfer-card { border: 1px solid var(--border); border-radius: 18px; padding: 16px; background: var(--panel); display: flex; flex-direction: column; gap: 10px; }

/* VM header row */
.transfer-card-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.transfer-card-vm { display: flex; align-items: center; gap: 10px; min-width: 0; }
.transfer-vm-icon {
  width: 32px; height: 32px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
  display: grid; place-items: center;
  flex-shrink: 0;
}
.transfer-vm-info { min-width: 0; }
.transfer-vm-label { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.transfer-vm-host { font-size: 12px; color: var(--text-muted); font-family: ui-monospace, SFMono-Regular, monospace; }

/* Badges */
.transfer-card-badges { display: flex; gap: 6px; flex-shrink: 0; }
.transfer-badge-engine {
  background: var(--bg-muted);
  color: var(--text-muted);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
}
.transfer-badge-status {
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
}
.transfer-badge-succeeded { background: rgba(16, 185, 129, 0.12); color: var(--success); }
.transfer-badge-failed    { background: rgba(239, 68, 68, 0.12);  color: var(--danger); }
.transfer-badge-running   { background: rgba(245, 158, 11, 0.12); color: var(--warn); }
.transfer-badge-paused    { background: rgba(245, 158, 11, 0.12); color: var(--warn); }
.transfer-badge-stopped,
.transfer-badge-preparing { background: var(--bg-muted); color: var(--text-faint); }

/* File row */
.transfer-file-row { display: flex; align-items: center; gap: 6px; }
.transfer-direction-icon { color: var(--text-muted); display: flex; align-items: center; }
.transfer-filename { font-weight: 600; font-size: 13px; }
.transfer-sub { color: var(--text-muted); font-size: 12px; overflow-wrap: anywhere; }

/* Progress */
.transfer-progress-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px; }
.transfer-progress-row progress { width: 100%; height: 6px; }

/* Actions */
.transfer-actions { display: flex; gap: 6px; }
.transfer-action-btn {
  background: var(--bg-panel);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  color: var(--text-muted);
  cursor: pointer;
  width: 30px; height: 30px;
  display: grid; place-items: center;
}
.transfer-action-btn:hover:not(:disabled) { background: var(--bg-muted); color: var(--text); }
.transfer-action-btn:disabled { opacity: 0.35; cursor: not-allowed; }

/* Logs */
.transfer-logs { margin-top: 2px; }
.transfer-logs pre { white-space: pre-wrap; color: var(--text-muted); font-size: 12px; }
```

- [ ] **Step 3: Run tsc**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Run all unit tests**

```bash
npx vitest run test/unit/
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/screens/TransfersPage.tsx src/renderer/screens/TransfersPage.css
git commit -m "feat: redesign transfer card with VM info, color badges, and icon buttons"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - vmLabel/vmHost on record → Task 1 ✓
  - 0B bug fix → Task 2 ✓
  - Auto-delete partials on fail → Task 3 ✓
  - Lucide React + HostsPage icons → Task 4 ✓
  - Lock icon in Main → Task 4 ✓
  - Chip count CSS fix → Task 4 ✓
  - Transfer card redesign (VM header, color badges, icon actions) → Task 5 ✓
  - Remove Delete partials button → Task 5 ✓

- [x] **Placeholder scan:** No TBDs, all steps have code.

- [x] **Type consistency:**
  - `vmLabel: string`, `vmHost: string` defined in Task 1 and used in Task 5 ✓
  - `applyProgress(event: TransferProgressEvent)` defined in Task 2, called in Task 2 ✓
  - `transfer.vmLabel`, `transfer.vmHost` in Task 5 TSX — these come from `TransferRecord` updated in Task 1 ✓
  - Status values `succeeded/failed/running/paused/stopped/preparing` match `TransferStatus` in types.ts ✓
