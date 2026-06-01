import { ipcMain, BrowserWindow, clipboard } from 'electron';
import type Database from 'better-sqlite3';
import { IPC } from '@shared/constants';
import { Vault } from './vault/vault';
import { VmsRepo } from './db/vms-repo';
import { SessionManager } from './ssh/session-manager';
import { SshSession } from './ssh/session';
import { ClipboardService } from './clipboard';
import { logger } from './logger';
import { Vm, VmInput, VaultEntry, Folder, PromptType, ToastPayload } from '@shared/types';

interface Deps {
  db: Database.Database;
  repo: VmsRepo;
  vault: Vault;
  sessions: SessionManager;
  clip: ClipboardService;
  mainWindow: () => BrowserWindow | null;
}

function pickSecretByPrompt(entry: VaultEntry, type: PromptType): string | undefined {
  switch (type) {
    case 'login':
    case 'generic':       return entry.password;
    case 'sudo':          return entry.sudoPassword;
    case 'key-passphrase':return entry.keyPassphrase;
  }
}

export function registerIpc(d: Deps): void {
  // vault
  ipcMain.handle(IPC.VAULT_STATE, () => d.vault.state());
  ipcMain.handle(IPC.VAULT_INIT, async (_e, pw: string) => { await d.vault.init(pw); });
  ipcMain.handle(IPC.VAULT_UNLOCK, async (_e, pw: string) => { await d.vault.unlock(pw); });
  ipcMain.handle(IPC.VAULT_LOCK, async () => { await d.vault.lock(); });
  ipcMain.handle(IPC.VAULT_SET_SECRET, async (_e, vmId: number, entry: VaultEntry) => {
    const vm = d.repo.getVm(vmId);
    if (!vm) throw new Error('vm not found');
    await d.vault.setSecret(vm.vaultRef, entry);
  });

  // vms
  ipcMain.handle(IPC.VMS_LIST, () => d.repo.listVms());
  ipcMain.handle(IPC.VMS_CREATE, async (_e, input: VmInput, secret: VaultEntry): Promise<Vm> => {
    const vm = d.repo.createVm(input);
    await d.vault.setSecret(vm.vaultRef, secret);
    return vm;
  });
  ipcMain.handle(IPC.VMS_UPDATE, async (_e, id: number, input: VmInput, secret: VaultEntry) => {
    const before = d.repo.getVm(id);
    if (!before) throw new Error('vm not found');
    d.repo.updateVm(id, input);
    await d.vault.setSecret(before.vaultRef, secret);
  });
  ipcMain.handle(IPC.VMS_DELETE, async (_e, id: number) => {
    const vm = d.repo.getVm(id);
    if (!vm) return;
    await d.vault.deleteSecret(vm.vaultRef);
    d.repo.deleteVm(id);
  });
  ipcMain.handle(IPC.VMS_TOUCH_USED, (_e, id: number) => d.repo.touchUsed(id));

  // folders
  ipcMain.handle(IPC.FOLDERS_LIST, () => d.repo.listFolders());
  ipcMain.handle(IPC.FOLDERS_CREATE, (_e, f: Omit<Folder, 'id'>) => d.repo.createFolder(f));
  ipcMain.handle(IPC.FOLDERS_DELETE, (_e, id: number) => {
    const all = d.repo.listFolders();
    if (all.length <= 1) {
      throw new Error('cannot-delete-last-workspace');
    }
    const fallback = all.find((f) => f.id !== id && f.name === 'Default')
                   ?? all.find((f) => f.id !== id);
    if (!fallback) throw new Error('cannot-delete-last-workspace');
    d.repo.reassignVmsFromFolder(id, fallback.id);
    d.repo.deleteFolder(id);
  });

  ipcMain.handle(IPC.FOLDERS_RENAME, (_e, id: number, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('empty-workspace-name');
    d.repo.renameFolder(id, trimmed);
  });

  ipcMain.handle(IPC.VMS_MOVE_TO_FOLDER, (_e, vmId: number, folderId: number) => {
    const vm = d.repo.getVm(vmId);
    if (!vm) throw new Error('vm-not-found');
    d.repo.updateVm(vmId, {
      folderId,
      label: vm.label,
      host: vm.host,
      port: vm.port,
      username: vm.username,
      authMethod: vm.authMethod,
      keyPath: vm.keyPath,
    });
  });

  // sessions
  ipcMain.handle(IPC.SESSION_START, async (_e, vmId: number, cols: number, rows: number) => {
    const vm = d.repo.getVm(vmId);
    if (!vm) throw new Error('vm not found');
    const session = new SshSession(vm, cols, rows);
    d.sessions.register(session);
    d.repo.touchUsed(vmId);

    session.on('data', (chunk: string) => {
      d.mainWindow()?.webContents.send(IPC.SESSION_OUTPUT, session.id, chunk);
    });
    session.on('state', (state) => {
      d.mainWindow()?.webContents.send(IPC.SESSION_STATE, state);
    });
    session.on('promptDetected', (type: PromptType) => {
      if (vm.autoCopyDisabled) {
        const toast: ToastPayload = { sessionId: session.id, vmId, promptType: type, hasSecret: false };
        d.mainWindow()?.webContents.send(IPC.SESSION_TOAST, toast);
        return;
      }
      const entry = d.vault.getSecret(vm.vaultRef);
      const secret = pickSecretByPrompt(entry, type);
      if (secret) {
        d.clip.copySecret(secret);
        logger.registerSecret(secret);
      }
      const toast: ToastPayload = { sessionId: session.id, vmId, promptType: type, hasSecret: !!secret };
      d.mainWindow()?.webContents.send(IPC.SESSION_TOAST, toast);
    });

    return session.id;
  });

  ipcMain.handle(IPC.SESSION_INPUT, (_e, sessionId: string, data: string) =>
    d.sessions.write(sessionId, data));
  ipcMain.handle(IPC.SESSION_RESIZE, (_e, sessionId: string, cols: number, rows: number) =>
    d.sessions.resize(sessionId, cols, rows));
  ipcMain.handle(IPC.SESSION_CLOSE, (_e, sessionId: string) => d.sessions.close(sessionId));

  ipcMain.handle(IPC.PASTE_PASSWORD, (_e, sessionId: string, type: PromptType) => {
    const session = d.sessions.get(sessionId);
    if (!session) return;
    const vm = d.repo.getVm(session.vmId);
    if (!vm) return;
    const entry = d.vault.getSecret(vm.vaultRef);
    const secret = pickSecretByPrompt(entry, type);
    if (secret) d.clip.copySecret(secret);
  });
}
