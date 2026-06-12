import { create } from 'zustand';
import type { UpdateCheckResult } from '@shared/types';

type AvailableUpdate = Extract<UpdateCheckResult, { status: 'available' }>;

interface UpdatesStore {
  available: AvailableUpdate | null;
  manualFeedback: string | null;
  checking: boolean;
  showAvailable: (update: AvailableUpdate) => void;
  clearAvailable: () => void;
  setManualFeedback: (message: string | null) => void;
  setChecking: (checking: boolean) => void;
}

export const useUpdatesStore = create<UpdatesStore>((set) => ({
  available: null,
  manualFeedback: null,
  checking: false,
  showAvailable: (update) => set({ available: update }),
  clearAvailable: () => set({ available: null }),
  setManualFeedback: (manualFeedback) => set({ manualFeedback }),
  setChecking: (checking) => set({ checking }),
}));
