import { create } from 'zustand';

const STORAGE_KEY = 'vssh.collapsedWorkspaces';

function load(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((n): n is number => typeof n === 'number'));
  } catch {
    return new Set();
  }
}

function save(s: Set<number>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
  } catch {
    // ignore storage errors
  }
}

interface UiStore {
  collapsedFolders: Set<number>;
  toggleFolderCollapsed: (id: number) => void;
  isFolderCollapsed: (id: number) => boolean;
}

export const useUiStore = create<UiStore>((set, get) => ({
  collapsedFolders: load(),
  toggleFolderCollapsed: (id: number) => {
    const next = new Set(get().collapsedFolders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    save(next);
    set({ collapsedFolders: next });
  },
  isFolderCollapsed: (id: number) => get().collapsedFolders.has(id),
}));
