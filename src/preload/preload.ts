import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/constants';
import { Vm, VmInput, Folder, VaultEntry, SessionState, ToastPayload, PromptType } from '@shared/types';

const api = {
  vault: {
    state: (): Promise<'empty' | 'locked' | 'unlocked'> => ipcRenderer.invoke(IPC.VAULT_STATE),
    init: (masterPw: string) => ipcRenderer.invoke(IPC.VAULT_INIT, masterPw),
    unlock: (masterPw: string) => ipcRenderer.invoke(IPC.VAULT_UNLOCK, masterPw),
    lock: () => ipcRenderer.invoke(IPC.VAULT_LOCK),
    setSecret: (vmId: number, entry: VaultEntry) => ipcRenderer.invoke(IPC.VAULT_SET_SECRET, vmId, entry),
    onStateChanged: (cb: (state: 'empty' | 'locked' | 'unlocked') => void) =>
      ipcRenderer.on(IPC.VAULT_STATE_CHANGED, (_e, s) => cb(s)),
  },
  vms: {
    list: (): Promise<Vm[]> => ipcRenderer.invoke(IPC.VMS_LIST),
    create: (input: VmInput, secret: VaultEntry): Promise<Vm> => ipcRenderer.invoke(IPC.VMS_CREATE, input, secret),
    update: (id: number, input: VmInput, secret: VaultEntry) => ipcRenderer.invoke(IPC.VMS_UPDATE, id, input, secret),
    delete: (id: number) => ipcRenderer.invoke(IPC.VMS_DELETE, id),
    touchUsed: (id: number) => ipcRenderer.invoke(IPC.VMS_TOUCH_USED, id),
    moveToFolder: (vmId: number, folderId: number) =>
      ipcRenderer.invoke(IPC.VMS_MOVE_TO_FOLDER, vmId, folderId),
  },
  folders: {
    list: (): Promise<Folder[]> => ipcRenderer.invoke(IPC.FOLDERS_LIST),
    create: (f: Omit<Folder, 'id'>) => ipcRenderer.invoke(IPC.FOLDERS_CREATE, f),
    delete: (id: number) => ipcRenderer.invoke(IPC.FOLDERS_DELETE, id),
    rename: (id: number, name: string) => ipcRenderer.invoke(IPC.FOLDERS_RENAME, id, name),
  },
  session: {
    start: (vmId: number, cols: number, rows: number): Promise<string> =>
      ipcRenderer.invoke(IPC.SESSION_START, vmId, cols, rows),
    input: (sessionId: string, data: string) => ipcRenderer.invoke(IPC.SESSION_INPUT, sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.invoke(IPC.SESSION_RESIZE, sessionId, cols, rows),
    close: (sessionId: string) => ipcRenderer.invoke(IPC.SESSION_CLOSE, sessionId),
    pastePassword: (sessionId: string, type: PromptType) =>
      ipcRenderer.invoke(IPC.PASTE_PASSWORD, sessionId, type),
    onOutput: (cb: (sessionId: string, chunk: string) => void) =>
      ipcRenderer.on(IPC.SESSION_OUTPUT, (_e, sid, c) => cb(sid, c)),
    onState: (cb: (state: SessionState) => void) =>
      ipcRenderer.on(IPC.SESSION_STATE, (_e, s) => cb(s)),
    onToast: (cb: (toast: ToastPayload) => void) =>
      ipcRenderer.on(IPC.SESSION_TOAST, (_e, t) => cb(t)),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
