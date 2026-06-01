import { create } from 'zustand';
import { Vm, Folder, VmInput, VaultEntry } from '@shared/types';

interface VmsStore {
  vms: Vm[];
  folders: Folder[];
  refresh: () => Promise<void>;
  create: (input: VmInput, secret: VaultEntry) => Promise<Vm>;
  update: (id: number, input: VmInput, secret: VaultEntry) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const useVmsStore = create<VmsStore>((set, get) => ({
  vms: [],
  folders: [],
  refresh: async () => {
    const [vms, folders] = await Promise.all([window.api.vms.list(), window.api.folders.list()]);
    set({ vms, folders });
  },
  create: async (input, secret) => {
    const vm = await window.api.vms.create(input, secret);
    await get().refresh();
    return vm;
  },
  update: async (id, input, secret) => {
    await window.api.vms.update(id, input, secret);
    await get().refresh();
  },
  remove: async (id) => {
    await window.api.vms.delete(id);
    await get().refresh();
  },
}));
