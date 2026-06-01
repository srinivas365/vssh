import { create } from 'zustand';

type VaultState = 'empty' | 'locked' | 'unlocked' | 'unknown';

interface VaultStore {
  state: VaultState;
  refresh: () => Promise<void>;
  init: (pw: string) => Promise<void>;
  unlock: (pw: string) => Promise<void>;
  lock: () => Promise<void>;
}

export const useVaultStore = create<VaultStore>((set) => ({
  state: 'unknown',
  refresh: async () => set({ state: await window.api.vault.state() }),
  init: async (pw) => { await window.api.vault.init(pw); set({ state: 'unlocked' }); },
  unlock: async (pw) => { await window.api.vault.unlock(pw); set({ state: 'unlocked' }); },
  lock: async () => { await window.api.vault.lock(); set({ state: 'locked' }); },
}));
