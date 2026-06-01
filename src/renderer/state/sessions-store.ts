import { create } from 'zustand';
import { SessionState, ToastPayload } from '@shared/types';

export interface Tab {
  sessionId: string;
  vmId: number;
  label: string;
  state: SessionState['status'];
}

interface SessionsStore {
  tabs: Tab[];
  activeTabId: string | null;
  toasts: ToastPayload[];
  addTab: (tab: Tab) => void;
  removeTab: (sessionId: string) => void;
  setActive: (sessionId: string) => void;
  updateState: (state: SessionState) => void;
  pushToast: (t: ToastPayload) => void;
  dismissToast: (sessionId: string) => void;
}

export const useSessionsStore = create<SessionsStore>((set) => ({
  tabs: [],
  activeTabId: null,
  toasts: [],
  addTab: (tab) => set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.sessionId })),
  removeTab: (id) => set((s) => ({
    tabs: s.tabs.filter((t) => t.sessionId !== id),
    activeTabId: s.activeTabId === id ? s.tabs.find((t) => t.sessionId !== id)?.sessionId ?? null : s.activeTabId,
  })),
  setActive: (id) => set({ activeTabId: id }),
  updateState: (state) => set((s) => ({
    tabs: s.tabs.map((t) => t.sessionId === state.sessionId ? { ...t, state: state.status } : t),
  })),
  pushToast: (t) => set((s) => ({ toasts: [...s.toasts.filter((x) => x.sessionId !== t.sessionId), t] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.sessionId !== id) })),
}));
