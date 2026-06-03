import { create, StoreApi, UseBoundStore } from 'zustand';
import type { TransferLogEvent, TransferProgressEvent, TransferRecord, TransferToastPayload } from '@shared/types';

interface TransfersStore {
  transfers: TransferRecord[];
  logs: Record<string, TransferLogEvent[]>;
  toasts: TransferToastPayload[];
  upsert: (record: TransferRecord) => void;
  applyProgress: (event: TransferProgressEvent) => void;
  pushLog: (event: TransferLogEvent) => void;
  pushToast: (toast: TransferToastPayload) => void;
  dismissToast: (id: string) => void;
}

export function createTransfersStore(): UseBoundStore<StoreApi<TransfersStore>> {
  return create<TransfersStore>((set) => ({
    transfers: [],
    logs: {},
    toasts: [],
    upsert: (record) => set((state) => ({
      transfers: state.transfers.some((x) => x.id === record.id)
        ? state.transfers.map((x) => x.id === record.id ? record : x)
        : [record, ...state.transfers],
    })),
    applyProgress: (event) => set((state) => ({
      transfers: state.transfers.map((x) => x.id === event.id
        ? { ...x, transferredBytes: event.transferredBytes, totalBytes: event.totalBytes, percent: event.percent }
        : x),
    })),
    pushLog: (event) => set((state) => ({
      logs: { ...state.logs, [event.id]: [...(state.logs[event.id] ?? []), event] },
    })),
    pushToast: (toast) => set((state) => ({
      toasts: [...state.toasts.filter((x) => x.id !== toast.id), toast],
    })),
    dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((x) => x.id !== id) })),
  }));
}

export const useTransfersStore = createTransfersStore();
