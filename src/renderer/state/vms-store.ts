import { create } from 'zustand';
import { Vm, Folder, VmInput, VaultEntry } from '@shared/types';

interface VmsStore {
  vms: Vm[];
  folders: Folder[];
  refresh: () => Promise<void>;
  create: (input: VmInput, secret: VaultEntry) => Promise<Vm>;
  clone: (sourceId: number, input: VmInput) => Promise<Vm>;
  update: (id: number, input: VmInput, secret: VaultEntry) => Promise<void>;
  remove: (id: number) => Promise<void>;
  createFolder: (name: string) => Promise<Folder>;
  renameFolder: (id: number, name: string) => Promise<void>;
  deleteFolder: (id: number) => Promise<void>;
  moveVmToFolder: (vmId: number, folderId: number) => Promise<void>;
}

export const useVmsStore = create<VmsStore>((set, get) => ({
  vms: [],
  folders: [],
  refresh: async () => {
    const [vms, folders] = await Promise.all([
      window.api.vms.list(),
      window.api.folders.list(),
    ]);
    set({ vms, folders });
  },
  create: async (input, secret) => {
    const vm = await window.api.vms.create(input, secret);
    await get().refresh();
    return vm;
  },
  clone: async (sourceId, input) => {
    const vm = await window.api.vms.clone(sourceId, input);
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
  createFolder: async (name) => {
    const folder = await window.api.folders.create({
      name,
      parentId: null,
      sortOrder: 0,
    });
    await get().refresh();
    return folder;
  },
  renameFolder: async (id, name) => {
    await window.api.folders.rename(id, name);
    await get().refresh();
  },
  deleteFolder: async (id) => {
    await window.api.folders.delete(id);
    await get().refresh();
  },
  moveVmToFolder: async (vmId, folderId) => {
    await window.api.vms.moveToFolder(vmId, folderId);
    await get().refresh();
  },
}));
