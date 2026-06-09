import { create } from 'zustand';
import { DEFAULT_APP_SETTINGS } from '@shared/constants';
import type { AppSettings, AppSettingsPatch } from '@shared/types';

interface SettingsStore {
  settings: AppSettings;
  loaded: boolean;
  hydrate: () => Promise<void>;
  update: (patch: AppSettingsPatch) => Promise<void>;
  enrollTouchId: (password: string) => Promise<void>;
  disableTouchId: () => Promise<void>;
}

let settingsListenerRegistered = false;

function applySettings(settings: AppSettings): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', settings.theme);
  document.documentElement.style.setProperty('--app-font-family', settings.appFontFamily);
}

function mergeSettings(next: AppSettings): Pick<SettingsStore, 'settings' | 'loaded'> {
  applySettings(next);
  return { settings: next, loaded: true };
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: DEFAULT_APP_SETTINGS,
  loaded: false,
  hydrate: async () => {
    applySettings(DEFAULT_APP_SETTINGS);

    const settings = await window.api.settings.get();
    set(mergeSettings(settings));

    if (!settingsListenerRegistered) {
      settingsListenerRegistered = true;
      window.api.settings.onChanged((incoming) => {
        set(mergeSettings(incoming));
      });
    }
  },
  update: async (patch) => {
    const settings = await window.api.settings.update(patch);
    set(mergeSettings(settings));
  },
  enrollTouchId: async (password) => {
    const settings = await window.api.touchId.enroll(password);
    set(mergeSettings(settings));
  },
  disableTouchId: async () => {
    const settings = await window.api.touchId.disable();
    set(mergeSettings(settings));
  },
}));
