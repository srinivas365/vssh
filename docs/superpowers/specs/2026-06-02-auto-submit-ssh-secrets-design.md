# Auto-submit SSH login and key secrets design

## Context

vssh currently detects SSH login, sudo, and key-passphrase prompts in PTY output. When a saved secret is available, the main process copies it to the clipboard and the user presses `⌘V`. The requested behavior is Termius-style seamless login: saved SSH login passwords and key passphrases should be sent automatically without copy/paste.

## Goals

- Automatically send saved SSH login passwords to the active PTY and press Enter.
- Automatically send saved SSH key passphrases to the active PTY and press Enter.
- Keep sudo prompts on the current clipboard/manual flow.
- Keep plaintext secrets inside the main process; the renderer must not receive secret values.
- Add a separate per-host setting for auto-submit behavior instead of reusing the existing auto-copy setting.

## Non-goals

- Auto-submitting sudo passwords.
- Replacing the manual password-copy fallback.
- Adding cloud sync, Touch ID, or other authentication features.
- Adding broad new test infrastructure if the repository has no relevant existing coverage.

## Recommended approach

Add a per-host `autoSubmitEnabled` flag and use it when handling prompt detections. For eligible prompts, the main process writes `<secret>\r` to the PTY. If auto-submit is disabled, the prompt is ineligible, or no secret is available, vssh falls back to the current clipboard/no-secret behavior.

This is preferred over reusing `autoCopyDisabled` because copying a secret to the clipboard and typing it into a live terminal are different risk profiles. A separate setting makes the behavior explicit and gives users a targeted escape hatch for unusual hosts.

## Behavior

When `PromptDetector` identifies an SSH login password prompt or SSH key passphrase prompt:

1. The main process resolves the VM for the session.
2. It reads the matching saved secret from the unlocked vault.
3. If `autoSubmitEnabled` is true and the secret exists, it writes `secret + '\r'` to the session PTY.
4. The renderer receives a notification such as “Login password sent” or “Key passphrase sent” without receiving the secret value.

Sudo prompts are excluded from auto-submit even when `autoSubmitEnabled` is true. They continue to use the current clipboard/manual behavior.

If `autoSubmitEnabled` is false, vssh keeps the current clipboard-copy behavior for login and key-passphrase prompts.

## Data model and UI

Add `autoSubmitEnabled: boolean` to `Vm` and persist it in SQLite with a default enabled value. Existing hosts should receive the enabled default during migration so the app behaves seamlessly after upgrade.

Expose the setting in the VM edit/create form near the existing password automation controls. The label should distinguish it from clipboard behavior, for example: “Automatically submit login/key secrets”.

## Main-process architecture

The main process remains the only place where plaintext secrets are handled.

Prompt flow:

1. `SshSession` detects a prompt and emits `promptDetected(type)`.
2. The existing main-process prompt handler determines which secret is needed for the prompt type.
3. For `login` and `key-passphrase`, if `vm.autoSubmitEnabled` is true and a saved secret exists, the handler calls `session.write(secret + '\r')`.
4. For `sudo`, disabled hosts, missing secrets, or locked vault cases, the handler follows the current fallback behavior.

The renderer only receives prompt/notification metadata. No new renderer API should expose plaintext secrets.

## Error handling and safety

- Missing secret: do not write to the PTY; show the current no-secret style notification.
- Locked vault: do not auto-submit; preserve existing locked-vault behavior.
- Duplicate prompt output: rely on the existing prompt detector debounce to avoid repeated sends.
- Logging: never log secret values. If needed, log only prompt type, VM ID, and session ID.
- Manual fallback: keep the existing manual copy shortcut available.

## Testing scope

Use existing relevant tests only. This repository already includes unit coverage for prompt detection, migrations, session management, and VM repository behavior, so update those where they naturally cover the new field or decision path. Do not introduce a new unrelated testing framework or broad new test suite solely for this feature.

## Success criteria

- Connecting to a password-auth host with a saved password reaches the remote shell without the user copying or pasting.
- Connecting with a key that needs a saved passphrase submits the passphrase automatically.
- Sudo password prompts are not auto-submitted.
- Disabling auto-submit for a host restores the current clipboard/manual behavior.
- Plaintext secrets remain confined to the main process.
