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
  forgetFolders: (keepIds: number[]) => void;
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
  forgetFolders: (keepIds: number[]) => {
    const keep = new Set(keepIds);
    const current = get().collapsedFolders;
    let changed = false;
    const next = new Set<number>();
    for (const id of current) {
      if (keep.has(id)) next.add(id);
      else changed = true;
    }
    if (changed) {
      save(next);
      set({ collapsedFolders: next });
    }
  },
}));
