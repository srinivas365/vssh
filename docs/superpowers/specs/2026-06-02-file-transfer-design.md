# File Transfer Design

## Overview

vssh will add seamless host-level file and folder transfers between the local Mac and saved VMs. Users start transfers from a host, choose upload or download, select local and remote paths through UI, and track work in a dedicated Transfers page. Transfers run independently from terminal tabs and use SSH-based tooling behind the scenes.

The MVP supports files and folders in both directions, remote directory browsing, best-effort progress, pause/resume/stop controls, conflict confirmation, and current-session transfer history.

## Goals

- Let users upload and download files/folders without typing SSH, rsync, sftp, or scp commands.
- Keep transfer UX separate from interactive terminal tabs.
- Prefer `rsync` when available on both local and remote systems.
- Fall back to SFTP when `rsync` is unavailable.
- Use SFTP for remote directory browsing.
- Reuse existing VM connection metadata, vault secrets, and auto-submit/auto-copy policy.
- Preserve the security boundary where plaintext secrets stay in the main process.
- Show clear progress, status, logs, and recovery actions.

## Non-Goals

- No SCP fallback in MVP.
- No bidirectional sync.
- No scheduled sync.
- No mirror/delete mode such as `rsync --delete`.
- No advanced changed-block or incremental-sync UX.
- No persisted transfer history after app restart.
- No rename-on-copy support in MVP.
- No full remote file manager operations such as delete, rename, or create folder.

## UX and Navigation

vssh will add a third top-bar section: **Transfers**, alongside **Hosts** and **Terminal**.

Host cards and sidebar entries expose host-level actions:

- **Upload…** for local to VM
- **Download…** for VM to local

Transfers run independently in the background. They do not create normal terminal tabs. Transfer authentication prompts, progress, and logs are shown in the Transfers page/details UI.

The Transfers page shows current app-session transfers, including active, paused, stopped, succeeded, and failed items. Each row/card includes:

- direction badge: upload or download
- engine badge: `rsync` or `sftp`
- VM label
- source and destination summary
- status
- progress percentage when available
- transferred bytes when percentage is unavailable
- controls appropriate to state: pause, resume, stop, retry, delete partials
- expandable details/logs

Terminal tabs remain only for interactive SSH sessions.

## Transfer Flow

### Upload: Local to VM

1. User clicks **Upload…** on a VM.
2. vssh opens a native macOS dialog to choose a local file or folder.
3. If a folder is selected, vssh asks whether to:
   - copy the folder as-is, which is the default, or
   - copy the folder contents only.
4. vssh opens the SFTP remote browser for that VM.
5. User chooses the remote destination folder.
6. vssh computes the final destination path.
7. vssh checks whether the destination already has a same-name item.
8. If a conflict exists, vssh asks the user to **Overwrite / merge** or **Cancel**.
9. Transfer starts and appears in Transfers.

### Download: VM to Local

1. User clicks **Download…** on a VM.
2. vssh opens the SFTP remote browser for that VM.
3. User chooses a remote file or folder.
4. If a folder is selected, vssh asks whether to:
   - copy the folder as-is, which is the default, or
   - copy the folder contents only.
5. vssh opens a native macOS dialog to choose a local destination folder.
6. vssh computes the final local destination path.
7. vssh checks whether the destination already has a same-name item.
8. If a conflict exists, vssh asks the user to **Overwrite / merge** or **Cancel**.
9. Transfer starts and appears in Transfers.

For files, vssh preserves the source file name inside the selected destination folder. For folders, the default behavior preserves the source folder name. The optional “copy contents only” mode copies the selected folder’s children into the destination folder.

## Transfer Engines

### SFTP

SFTP is used for remote browsing and as the fallback transfer engine. The design allows adding a Node SFTP dependency if it materially improves reliability, progress reporting, pause/resume behavior, and avoids parsing an interactive `sftp` terminal session.

SFTP responsibilities:

- list remote directories
- identify file/folder metadata for remote selections
- check remote destination conflicts
- upload and download when `rsync` is unavailable
- provide byte progress
- support resume from known byte offsets when possible

### rsync

`rsync` is used for transfers when available on both local and remote systems.

Availability checks:

- local: check that `rsync` exists on the Mac
- remote: check over SSH that `rsync` exists on the VM

If both checks pass, the transfer uses `rsync`. Otherwise, it falls back to SFTP. The UI displays the selected engine for each transfer.

`rsync` should be invoked in a way that supports partial-file resume. The MVP does not expose mirror/delete or sync semantics.

## Authentication

Transfers follow the same host policy as terminal sessions.

- If the host’s auto-submit setting is enabled and the vault has the required secret, vssh sends the secret into the transfer auth flow.
- Otherwise, vssh copies the secret or offers manual send, matching existing terminal behavior.
- The renderer never receives plaintext secrets.
- Logs and auth state are exposed as safe events; secret values are redacted.

The transfer subsystem should reuse the existing prompt detection and prompt action policy where applicable, while keeping transfer sessions separate from terminal tabs.

## Pause, Stop, Failure, and Partials

### Pause

Pause is available while a transfer is running. It stops or suspends the active transfer while keeping partial files. The transfer moves to `paused`, and the user can click **Resume**.

- For `rsync`, resume restarts rsync with partial-file support.
- For SFTP, resume continues from the known byte offset when possible.

### Stop

Stop is available while a transfer is preparing, running, or paused. Stop is intentional cancellation. vssh deletes partial files it created for that transfer where safe, then moves the transfer to `stopped`.

### Unexpected Failure

Unexpected failures include network drops, process errors, remote command failures, and authentication failure after a transfer has started.

On unexpected failure:

- vssh keeps partial files.
- transfer moves to `failed`.
- vssh shows a toast.
- user can choose **Resume**, **Delete partials**, or view details/logs.

### App Quit or Crash

MVP transfer history is current-session only. If the app quits or crashes, active transfer state is not restored on restart. Partial files may remain. Persisted recovery is out of scope for MVP.

## Concurrency

vssh allows transfers on different VMs to run concurrently. For a single VM, only one transfer may run at a time. If the user starts another transfer for a VM that already has a running or paused transfer, vssh blocks the new transfer and shows clear UI feedback. Queueing same-VM transfers is out of scope for MVP.

## Main Process Architecture

### TransferManager

Owns active and current-session transfers. Responsibilities:

- create transfer records
- enforce one active transfer per VM
- select transfer engine
- manage state transitions
- expose pause/resume/stop/delete-partials actions
- emit safe progress, state, and log events to the renderer

### TransferEngine Interface

Defines a common contract for transfer implementations:

- start
- pause
- resume
- stop
- cleanup partials
- progress events
- log events
- completion/failure events

Implementations:

- `RsyncTransferEngine`
- `SftpTransferEngine`

### RemoteBrowserService

Uses SFTP to browse remote paths. Responsibilities:

- connect to a VM using saved SSH metadata
- list directory entries
- report entry type and basic metadata
- support navigation
- check remote conflicts

The MVP browser is browse/select only. It does not create, delete, or rename remote items.

### TransferAuthService

Coordinates transfer authentication with existing vault and prompt policy. It keeps secrets in the main process and emits only redacted/safe information to renderer UI.

## Renderer Architecture

New renderer pieces:

- Transfers page
- transfer row/card component
- transfer details/log drawer
- upload/download wizard
- remote browser modal
- folder mode selector
- conflict confirmation modal

The renderer stores current-session transfer state, subscribes to main-process transfer events, and sends user commands through typed IPC.

## IPC Surface

Typed IPC will be added for:

- opening native local file/folder dialogs
- opening native local destination-folder dialog
- listing remote directories
- starting upload/download transfers
- pausing transfers
- resuming transfers
- stopping transfers
- deleting partials
- receiving transfer state/progress/log events

IPC payloads must not include plaintext secrets.

## Testing

### Unit Tests

Cover:

- destination path calculation for file/folder and as-is vs contents-only modes
- transfer engine selection: rsync available vs SFTP fallback
- transfer state transitions: preparing, running, paused, stopped, succeeded, failed
- one-active-transfer-per-VM enforcement
- partial cleanup rules:
  - pause keeps partials
  - stop deletes partials
  - unexpected failure keeps partials
- conflict detection decision logic

### Integration and E2E Tests

Use the existing Docker SSH test setup where possible. Cover:

- remote browser lists a test directory
- upload file
- upload folder as-is
- upload folder contents only
- download file
- download folder as-is
- conflict prompt appears before overwrite/merge
- stop cancels transfer and removes partial output where safe
- rsync unavailable path falls back to SFTP

## Success Criteria

The feature is successful when a user can click a host, upload or download files/folders without typing SSH commands, choose local and remote paths through UI, see that work is progressing, pause/resume or stop intentionally, and understand failures without needing a terminal tab.
