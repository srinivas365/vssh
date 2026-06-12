import React, { useEffect, useState } from 'react';
import type { SelectOption } from '../components/Select/Select';
import { Select } from '../components/Select/Select';
import { useSettingsStore } from '../state/settings-store';
import type { ThemeName, TouchIdStatus } from '@shared/types';
import { APP_VERSION } from '@shared/version';
import './SettingsPage.css';

const THEME_OPTIONS: SelectOption<ThemeName>[] = [
  { value: 'light', label: 'Light', description: 'Bright default palette' },
  { value: 'dark', label: 'Dark', description: 'Low-light, high contrast palette' },
  { value: 'claude', label: 'Claude', description: 'Warm neutral palette with amber accents' },
  { value: 'dracula', label: 'Dracula', description: 'Popular purple-night coding palette' },
  { value: 'nord', label: 'Nord', description: 'Arctic-inspired blue-gray palette' },
  { value: 'solarized-dark', label: 'Solarized Dark', description: 'Classic low-contrast dark theme' },
];

type AppFontId = 'system' | 'inter' | 'serif' | 'mono';
type TerminalFontId = 'menlo' | 'jetbrains' | 'fira' | 'consolas';

const APP_FONT_OPTIONS: Array<SelectOption<AppFontId> & { font: string }> = [
  {
    value: 'system',
    label: 'System UI',
    description: 'Platform default sans-serif stack',
    font: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  },
  {
    value: 'inter',
    label: 'Inter',
    description: 'Modern sans-serif with fallback stack',
    font: '"Inter", "Segoe UI", system-ui, sans-serif',
  },
  {
    value: 'serif',
    label: 'Serif',
    description: 'Readable serif-oriented UI look',
    font: 'Georgia, "Times New Roman", serif',
  },
  {
    value: 'mono',
    label: 'Monospace',
    description: 'Uniform width UI typography',
    font: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
];

const TERMINAL_FONT_OPTIONS: Array<SelectOption<TerminalFontId> & { font: string }> = [
  {
    value: 'menlo',
    label: 'Menlo / Monaco',
    description: 'Native macOS style terminal stack',
    font: 'Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  },
  {
    value: 'jetbrains',
    label: 'JetBrains Mono',
    description: 'Coding-friendly glyph design',
    font: '"JetBrains Mono", Menlo, Monaco, monospace',
  },
  {
    value: 'fira',
    label: 'Fira Code',
    description: 'Popular terminal/editor monospace',
    font: '"Fira Code", Menlo, Monaco, monospace',
  },
  {
    value: 'consolas',
    label: 'Consolas',
    description: 'Classic readable terminal font stack',
    font: 'Consolas, "Liberation Mono", "Courier New", monospace',
  },
];

const MIN_TERMINAL_FONT_SIZE = 10;
const MAX_TERMINAL_FONT_SIZE = 24;
const MIN_AUTO_LOCK_MINUTES = 1;
const MAX_AUTO_LOCK_MINUTES = 240;

function closestAppFontId(fontFamily: string): AppFontId {
  const match = APP_FONT_OPTIONS.find((option) => option.font === fontFamily);
  return match?.value ?? 'system';
}

function closestTerminalFontId(fontFamily: string): TerminalFontId {
  const match = TERMINAL_FONT_OPTIONS.find((option) => option.font === fontFamily);
  return match?.value ?? 'menlo';
}

export function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const loaded = useSettingsStore((s) => s.loaded);
  const update = useSettingsStore((s) => s.update);
  const enrollTouchId = useSettingsStore((s) => s.enrollTouchId);
  const disableTouchId = useSettingsStore((s) => s.disableTouchId);
  const [terminalFontSizeDraft, setTerminalFontSizeDraft] = useState(String(settings.terminalFontSize));
  const [autoLockMinutesDraft, setAutoLockMinutesDraft] = useState(String(settings.autoLockMinutes));
  const [touchIdStatus, setTouchIdStatus] = useState<TouchIdStatus | null>(null);
  const [touchIdPassword, setTouchIdPassword] = useState('');
  const [touchIdErr, setTouchIdErr] = useState<string | null>(null);
  const [touchIdBusy, setTouchIdBusy] = useState(false);
  const [pendingTouchIdEnable, setPendingTouchIdEnable] = useState(false);

  useEffect(() => {
    void window.api.touchId.status().then(setTouchIdStatus);
  }, [settings.touchIdEnabled]);

  useEffect(() => {
    setTerminalFontSizeDraft(String(settings.terminalFontSize));
    setAutoLockMinutesDraft(String(settings.autoLockMinutes));
  }, [settings.terminalFontSize, settings.autoLockMinutes]);

  async function patchSettings(patch: Parameters<typeof update>[0]) {
    await update(patch);
  }

  function clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  async function applyTerminalSizeDraft() {
    const parsed = Number.parseInt(terminalFontSizeDraft, 10);
    if (!Number.isFinite(parsed)) {
      setTerminalFontSizeDraft(String(settings.terminalFontSize));
      return;
    }
    const next = clamp(parsed, MIN_TERMINAL_FONT_SIZE, MAX_TERMINAL_FONT_SIZE);
    setTerminalFontSizeDraft(String(next));
    if (next !== settings.terminalFontSize) {
      await patchSettings({ terminalFontSize: next });
    }
  }

  async function applyAutoLockDraft() {
    const parsed = Number.parseInt(autoLockMinutesDraft, 10);
    if (!Number.isFinite(parsed)) {
      setAutoLockMinutesDraft(String(settings.autoLockMinutes));
      return;
    }
    const next = clamp(parsed, MIN_AUTO_LOCK_MINUTES, MAX_AUTO_LOCK_MINUTES);
    setAutoLockMinutesDraft(String(next));
    if (next !== settings.autoLockMinutes) {
      await patchSettings({ autoLockMinutes: next });
    }
  }

  async function disableTouchIdUnlock() {
    setTouchIdErr(null);
    setTouchIdBusy(true);
    try {
      await disableTouchId();
      setPendingTouchIdEnable(false);
      setTouchIdPassword('');
      setTouchIdStatus(await window.api.touchId.status());
    } catch {
      setTouchIdErr('Could not disable Touch ID.');
    } finally {
      setTouchIdBusy(false);
    }
  }

  async function enrollTouchIdUnlock(e: React.FormEvent) {
    e.preventDefault();
    setTouchIdErr(null);
    setTouchIdBusy(true);
    try {
      await enrollTouchId(touchIdPassword);
      setPendingTouchIdEnable(false);
      setTouchIdPassword('');
      setTouchIdStatus(await window.api.touchId.status());
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setTouchIdErr(message.includes('incorrect-password')
        ? 'Incorrect master password.'
        : 'Could not enable Touch ID on this Mac.');
    } finally {
      setTouchIdBusy(false);
    }
  }

  const showTouchIdSettings = touchIdStatus?.supported && touchIdStatus.available;

  if (!loaded) {
    return (
      <div className="settings-page">
        <div className="settings-card">
          <h1 className="settings-title">Settings</h1>
          <p className="settings-sub">Loading preferences...</p>
        </div>
      </div>
    );
  }

  const appFontId = closestAppFontId(settings.appFontFamily);
  const terminalFontId = closestTerminalFontId(settings.terminalFontFamily);

  return (
    <div className="settings-page">
      <header className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-sub">Customize appearance and security behavior for this app.</p>
      </header>

      <section className="settings-card">
        <h2>Theme</h2>
        <p className="settings-help">Switch the global color palette used by the app and terminal chrome.</p>
        <Select<ThemeName>
          value={settings.theme}
          options={THEME_OPTIONS}
          onChange={(value) => { void patchSettings({ theme: value }); }}
        />
      </section>

      <section className="settings-card">
        <h2>Fonts</h2>
        <div className="settings-grid">
          <label>
            App font
            <Select<AppFontId>
              value={appFontId}
              options={APP_FONT_OPTIONS}
              onChange={(value) => {
                const option = APP_FONT_OPTIONS.find((item) => item.value === value);
                if (!option) return;
                void patchSettings({ appFontFamily: option.font });
              }}
            />
          </label>
          <label>
            Terminal font
            <Select<TerminalFontId>
              value={terminalFontId}
              options={TERMINAL_FONT_OPTIONS}
              onChange={(value) => {
                const option = TERMINAL_FONT_OPTIONS.find((item) => item.value === value);
                if (!option) return;
                void patchSettings({ terminalFontFamily: option.font });
              }}
            />
          </label>
          <label>
            Terminal font size
            <input
              type="number"
              min={MIN_TERMINAL_FONT_SIZE}
              max={MAX_TERMINAL_FONT_SIZE}
              value={terminalFontSizeDraft}
              onChange={(e) => setTerminalFontSizeDraft(e.target.value)}
              onBlur={() => { void applyTerminalSizeDraft(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void applyTerminalSizeDraft();
                }
              }}
            />
          </label>
        </div>
      </section>

      <section className="settings-card">
        <h2>Auto-lock timeout</h2>
        <p className="settings-help">
          Lock the vault after this many minutes without keyboard or mouse input. macOS may turn off the display sooner; the vault follows this timer. Use ⌘L to lock immediately.
        </p>
        <label>
          Minutes
          <input
            type="number"
            min={MIN_AUTO_LOCK_MINUTES}
            max={MAX_AUTO_LOCK_MINUTES}
            value={autoLockMinutesDraft}
            onChange={(e) => setAutoLockMinutesDraft(e.target.value)}
            onBlur={() => { void applyAutoLockDraft(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void applyAutoLockDraft();
              }
            }}
          />
        </label>
      </section>

      {showTouchIdSettings && (
        <section className="settings-card">
          <h2>Touch ID</h2>
          <p className="settings-help">
            Store your master password in the macOS Keychain, protected by Touch ID. You can still unlock with your password anytime.
          </p>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={settings.touchIdEnabled}
              disabled={touchIdBusy}
              onChange={(e) => {
                if (e.target.checked) {
                  setPendingTouchIdEnable(true);
                  setTouchIdErr(null);
                  return;
                }
                void disableTouchIdUnlock();
              }}
            />
            Unlock with Touch ID
          </label>
          {pendingTouchIdEnable && !settings.touchIdEnabled && (
            <form className="settings-touch-id-enroll" onSubmit={(e) => { void enrollTouchIdUnlock(e); }}>
              <label>
                Confirm master password
                <input
                  type="password"
                  value={touchIdPassword}
                  autoFocus
                  placeholder="Enter master password"
                  disabled={touchIdBusy}
                  onChange={(e) => setTouchIdPassword(e.target.value)}
                />
              </label>
              <div className="settings-touch-id-actions">
                <button type="submit" className="settings-btn" disabled={touchIdBusy || !touchIdPassword}>
                  {touchIdBusy ? 'Enabling…' : 'Enable Touch ID'}
                </button>
                <button
                  type="button"
                  className="settings-btn settings-btn-muted"
                  disabled={touchIdBusy}
                  onClick={() => {
                    setPendingTouchIdEnable(false);
                    setTouchIdPassword('');
                    setTouchIdErr(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          {touchIdErr && <div className="settings-error">{touchIdErr}</div>}
        </section>
      )}

      <footer className="settings-about">
        <span className="settings-about-name">vssh</span>
        <span className="settings-about-version">v{APP_VERSION}</span>
      </footer>
    </div>
  );
}
