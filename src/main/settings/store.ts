import { DEFAULT_APP_SETTINGS } from '@shared/constants';
import type { AppSettings, AppSettingsPatch, ThemeName } from '@shared/types';

const MIN_TERMINAL_FONT_SIZE = 10;
const MAX_TERMINAL_FONT_SIZE = 24;
const MIN_AUTO_LOCK_MINUTES = 1;
const MAX_AUTO_LOCK_MINUTES = 240;

const THEMES: ReadonlySet<ThemeName> = new Set([
  'light',
  'dark',
  'claude',
  'dracula',
  'nord',
  'solarized-dark',
]);

export class SettingsStore {
  private readonly store: {
    get: <T>(key: string, defaultValue: T) => T;
    set: (key: string, value: unknown) => void;
  };

  private constructor(store: { get: <T>(key: string, defaultValue: T) => T; set: (key: string, value: unknown) => void }) {
    this.store = store;
  }

  static async create(): Promise<SettingsStore> {
    const ElectronStore = await loadElectronStore();
    const store = new ElectronStore({
      name: 'settings',
      defaults: DEFAULT_APP_SETTINGS,
    });

    return new SettingsStore(store as unknown as {
      get: <T>(key: string, defaultValue: T) => T;
      set: (key: string, value: unknown) => void;
    });
  }

  get(): AppSettings {
    return sanitizeSettings({
      theme: this.store.get('theme', DEFAULT_APP_SETTINGS.theme),
      appFontFamily: this.store.get('appFontFamily', DEFAULT_APP_SETTINGS.appFontFamily),
      terminalFontFamily: this.store.get('terminalFontFamily', DEFAULT_APP_SETTINGS.terminalFontFamily),
      terminalFontSize: this.store.get('terminalFontSize', DEFAULT_APP_SETTINGS.terminalFontSize),
      autoLockMinutes: this.store.get('autoLockMinutes', DEFAULT_APP_SETTINGS.autoLockMinutes),
    });
  }

  update(patch: AppSettingsPatch): AppSettings {
    const next = sanitizeSettings({ ...this.get(), ...patch });
    this.store.set('theme', next.theme);
    this.store.set('appFontFamily', next.appFontFamily);
    this.store.set('terminalFontFamily', next.terminalFontFamily);
    this.store.set('terminalFontSize', next.terminalFontSize);
    this.store.set('autoLockMinutes', next.autoLockMinutes);
    return next;
  }
}

function sanitizeSettings(input: AppSettings): AppSettings {
  return {
    theme: sanitizeTheme(input.theme),
    appFontFamily: sanitizeFontFamily(input.appFontFamily, DEFAULT_APP_SETTINGS.appFontFamily),
    terminalFontFamily: sanitizeFontFamily(input.terminalFontFamily, DEFAULT_APP_SETTINGS.terminalFontFamily),
    terminalFontSize: sanitizeInteger(input.terminalFontSize, MIN_TERMINAL_FONT_SIZE, MAX_TERMINAL_FONT_SIZE, DEFAULT_APP_SETTINGS.terminalFontSize),
    autoLockMinutes: sanitizeInteger(input.autoLockMinutes, MIN_AUTO_LOCK_MINUTES, MAX_AUTO_LOCK_MINUTES, DEFAULT_APP_SETTINGS.autoLockMinutes),
  };
}

function sanitizeTheme(theme: ThemeName): ThemeName {
  if (THEMES.has(theme)) return theme;
  return DEFAULT_APP_SETTINGS.theme;
}

function sanitizeFontFamily(value: string, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) return fallback;
  return trimmed;
}

function sanitizeInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

async function loadElectronStore(): Promise<new (options: { name: string; defaults: AppSettings }) => unknown> {
  // Keep native dynamic import in CommonJS output to load ESM-only electron-store.
  const dynamicImport = new Function('specifier', 'return import(specifier)') as
    (specifier: string) => Promise<{ default: new (options: { name: string; defaults: AppSettings }) => unknown }>;
  const module = await dynamicImport('electron-store');
  return module.default;
}
