# Transfers UI Redesign + Icon Pack

**Date:** 2026-06-03  
**Branch:** feat/file-transfers  
**Status:** Approved

## Overview

Four areas of improvement: fix a progress-byte tracking bug, add a proper icon pack app-wide, redesign the transfer card UI, and fix a minor chip CSS issue on the Hosts page.

---

## Section 1: Data model + progress bug fix

### VM info snapshot

Add two fields to `TransferRecord` in `src/shared/types.ts`:

```ts
vmLabel: string;
vmHost: string;
```

The IPC handler that calls `manager.start()` looks up the VM by `vmId` before creating the record and passes `vmLabel` and `vmHost` in the `TransferStartRequest`. The manager stores them on the record from the start.

### 0B bug fix

**Root cause:** `TransferManager` initialises `transferredBytes: 0, totalBytes: null, percent: null` on the record and never updates these internally. When `updateStatus('succeeded')` fires, it emits a `'state'` event with the stale 0-byte record, which `upsert` in the renderer store overwrites the progress bytes accumulated via `applyProgress`.

**Fix:** Add an `applyProgress(event: TransferProgressEvent)` method to `TransferManager` that updates the stored record's `transferredBytes`, `totalBytes`, and `percent`. The engine context's `emitProgress` callback calls both `manager.applyProgress()` AND emits the IPC `'progress'` event to the renderer. This way, when the final `'state'` event fires, the record already carries the correct final bytes.

---

## Section 2: Icon pack

Install `lucide-react`. No wrapper component — use Lucide icons directly at each callsite.

**Icon sizing:**
- `14px` — buttons (host card actions)
- `16px` — card headers
- `18px` — empty states

**Replacement map:**

| Unicode | Lucide | Location |
|---------|--------|----------|
| ⊟ | `Server` | Host card icon, empty state icon |
| ⇧ | `Upload` | Host card upload button, nav |
| ⇩ | `Download` | Host card download button, nav |
| ✎ | `Pencil` | Host card edit button |
| ✕ | `X` | Host card delete button |
| ⌕ | `Search` | Hosts search field prefix |
| lock text / emoji | `Lock` / `Unlock` | App header lock button |
| Pause/Resume/Stop text | `PauseCircle` / `PlayCircle` / `StopCircle` | Transfer card actions |

---

## Section 3: Transfer card redesign

### Card layout

```
┌─────────────────────────────────────────────────┐
│ [Server icon] vmLabel          [sftp] [succeeded]│
│               user@10.x.x.x:22                  │
│ source/path → destination/path                   │
│ ████████████████░░░░░░░░  87%                    │
│ [⏸] [▶] [⏹]                                      │
│ ▶ Details                                        │
└─────────────────────────────────────────────────┘
```

### VM header row

- Left: `Server` icon (16px, accent color) + `vmLabel` (bold 14px) stacked above `vmHost` (monospace, muted 12px) — mirrors the host card head pattern.
- Right: engine badge (neutral `.host-badge` style).

### Status badge (color-coded)

Same rectangular shape as `.host-badge`. Background tint + text color per status:

| Status | Background | Text |
|--------|-----------|------|
| succeeded | `--success` tint | `--success` |
| failed | `--danger` tint | `--danger` |
| running | `--warn` tint | `--warn` |
| paused | `--warn` tint | `--warn` |
| stopped / preparing | `--bg-muted` | `--text-faint` |

Use inline styles or scoped CSS vars for the tints (`rgba` of the base color at 12% opacity for bg, full color for text).

### Progress row

Unchanged layout. The byte/percent display:
- While running: show `percent` if available, else `transferredBytes`
- On completion (`succeeded`): always show final `transferredBytes` (now correctly populated by Section 1 fix)

### Action buttons

Replace text buttons with icon-only buttons using `.host-card-icon-btn` style:
- Pause → `PauseCircle` (14px), disabled when status ≠ `running`
- Resume → `PlayCircle` (14px), disabled when status ∉ `['paused', 'failed']`
- Stop → `StopCircle` (14px), disabled when status ∉ `['preparing', 'running', 'paused']`

**Remove** the "Delete partials" button entirely.

### Auto-delete partials on fail

In `TransferManager.fail()`, add the same two calls that `stop()` already makes:

```ts
this.markPartials(id, false);
// (existing fail logic...)
this.emit('delete-partials', id);
```

Partials are now always cleaned up on both stop and fail. Resume after fail starts fresh (writes with `'w'` flag). Pause still keeps partials for append-resume.

---

## Section 4: HostsPage chip CSS

Single fix in `HostsPage.css`:

```css
/* before */
.chip-count { background: rgba(15, 23, 42, 0.08); }

/* after */
.chip-count { background: var(--bg-muted); }
```

The hardcoded `rgba` doesn't adapt to dark mode; `--bg-muted` is already defined for both themes.

---

## Files to touch

| File | Change |
|------|--------|
| `src/shared/types.ts` | Add `vmLabel`, `vmHost` to `TransferRecord` and `TransferStartRequest` |
| `src/main/transfer/transfer-manager.ts` | Add `applyProgress()`; update `fail()` to auto-delete partials |
| `src/main/transfer/sftp-engine.ts` | Call `manager.applyProgress()` in `emitProgress` callback |
| `src/main/transfer/rsync-engine.ts` | Same as sftp-engine |
| IPC handler for transfer start | Look up VM; pass `vmLabel`/`vmHost` in request |
| `package.json` | Add `lucide-react` |
| `src/renderer/screens/HostsPage.tsx` | Replace Unicode icons with Lucide |
| `src/renderer/screens/HostsPage.css` | Fix `.chip-count` background |
| `src/renderer/screens/TransfersPage.tsx` | Full card redesign |
| `src/renderer/screens/TransfersPage.css` | New badge + action styles |
| `src/renderer/screens/Main.tsx` | Replace lock icon |
