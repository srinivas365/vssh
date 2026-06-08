import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/constants';
import { Vm, VmInput, Folder, VaultEntry, SessionState, ToastPayload, PromptType, LocalSelection, RemoteEntry, TransferStartRequest, TransferRecord, TransferProgressEvent, TransferLogEvent, TransferToastPayload, VmConnectionTestResult, AppSettings, AppSettingsPatch } from '@shared/types';

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
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET),
    update: (patch: AppSettingsPatch): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_UPDATE, patch),
    onChanged: (cb: (settings: AppSettings) => void) =>
      ipcRenderer.on(IPC.SETTINGS_CHANGED, (_e, settings) => cb(settings)),
  },
  vms: {
    list: (): Promise<Vm[]> => ipcRenderer.invoke(IPC.VMS_LIST),
    create: (input: VmInput, secret: VaultEntry): Promise<Vm> => ipcRenderer.invoke(IPC.VMS_CREATE, input, secret),
    update: (id: number, input: VmInput, secret: VaultEntry) => ipcRenderer.invoke(IPC.VMS_UPDATE, id, input, secret),
    delete: (id: number) => ipcRenderer.invoke(IPC.VMS_DELETE, id),
    touchUsed: (id: number) => ipcRenderer.invoke(IPC.VMS_TOUCH_USED, id),
    testConnection: (input: VmInput, secret: VaultEntry): Promise<VmConnectionTestResult> =>
      ipcRenderer.invoke(IPC.VMS_TEST_CONNECTION, input, secret),
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
  transfer: {
    pickUploadSource: (): Promise<LocalSelection | null> => ipcRenderer.invoke(IPC.TRANSFER_PICK_UPLOAD_SOURCE),
    pickDownloadDestination: (): Promise<string | null> => ipcRenderer.invoke(IPC.TRANSFER_PICK_DOWNLOAD_DESTINATION),
    remoteList: (vmId: number, directory: string): Promise<RemoteEntry[]> => ipcRenderer.invoke(IPC.TRANSFER_REMOTE_LIST, vmId, directory),
    remoteStat: (vmId: number, remotePath: string): Promise<RemoteEntry | null> => ipcRenderer.invoke(IPC.TRANSFER_REMOTE_STAT, vmId, remotePath),
    start: (request: TransferStartRequest): Promise<TransferRecord> => ipcRenderer.invoke(IPC.TRANSFER_START, request),
    pause: (id: string) => ipcRenderer.invoke(IPC.TRANSFER_PAUSE, id),
    resume: (id: string) => ipcRenderer.invoke(IPC.TRANSFER_RESUME, id),
    stop: (id: string) => ipcRenderer.invoke(IPC.TRANSFER_STOP, id),
    deletePartials: (id: string) => ipcRenderer.invoke(IPC.TRANSFER_DELETE_PARTIALS, id),
    onState: (cb: (record: TransferRecord) => void) => ipcRenderer.on(IPC.TRANSFER_STATE, (_e, r) => cb(r)),
    onProgress: (cb: (event: TransferProgressEvent) => void) => ipcRenderer.on(IPC.TRANSFER_PROGRESS, (_e, p) => cb(p)),
    onLog: (cb: (event: TransferLogEvent) => void) => ipcRenderer.on(IPC.TRANSFER_LOG, (_e, l) => cb(l)),
    onToast: (cb: (toast: TransferToastPayload) => void) => ipcRenderer.on(IPC.TRANSFER_TOAST, (_e, t) => cb(t)),
  },
  clipboard: {
    readText: (): Promise<string> => ipcRenderer.invoke(IPC.CLIPBOARD_READ_TEXT),
    writeText: (text: string): Promise<void> => ipcRenderer.invoke(IPC.CLIPBOARD_WRITE_TEXT, text),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
