import { ipcMain, BrowserWindow, clipboard, dialog } from 'electron';
import fs from 'node:fs';
import type Database from 'better-sqlite3';
import { IPC } from '@shared/constants';
import { Vault } from './vault/vault';
import { VmsRepo } from './db/vms-repo';
import { SessionManager } from './ssh/session-manager';
import { SshSession } from './ssh/session';
import { ClipboardService } from './clipboard';
import { logger } from './logger';
import { Vm, VmInput, VaultEntry, Folder, PromptType, ToastPayload } from '@shared/types';
import { decidePromptAction, pickSecretByPrompt } from './ssh/prompt-action';
import type { TransferManager } from './transfer/transfer-manager';
import { RemoteBrowserService } from './transfer/remote-browser-service';
import { basenameForPath } from './transfer/path-utils';
import type { LocalSelection, TransferStartRequest } from '@shared/types';

interface Deps {
  db: Database.Database;
  repo: VmsRepo;
  vault: Vault;
  sessions: SessionManager;
  clip: ClipboardService;
  mainWindow: () => BrowserWindow | null;
  transfers: TransferManager;
  remoteBrowser: RemoteBrowserService;
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
      autoSubmitEnabled: vm.autoSubmitEnabled,
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
      const entry = d.vault.getSecret(vm.vaultRef);
      const action = decidePromptAction(vm, entry, type);

      if (action.secret && action.delivery === 'sent') {
        session.write(`${action.secret}\r`);
        logger.registerSecret(action.secret);
      } else if (action.secret && action.delivery === 'copied') {
        d.clip.copySecret(action.secret);
        logger.registerSecret(action.secret);
      }

      const toast: ToastPayload = {
        sessionId: session.id,
        vmId,
        promptType: type,
        hasSecret: !!action.secret,
        delivery: action.delivery,
      };
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

  // transfers
  ipcMain.handle(IPC.TRANSFER_PICK_UPLOAD_SOURCE, async (): Promise<LocalSelection | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const selectedPath = result.filePaths[0];
    const stat = fs.statSync(selectedPath);
    return {
      path: selectedPath,
      name: basenameForPath(selectedPath),
      type: stat.isDirectory() ? 'directory' : 'file',
      sizeBytes: stat.isFile() ? stat.size : null,
    };
  });

  ipcMain.handle(IPC.TRANSFER_PICK_DOWNLOAD_DESTINATION, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC.TRANSFER_REMOTE_LIST, async (_e, vmId: number, directory: string) => {
    const vm = d.repo.getVm(vmId);
    if (!vm) throw new Error('vm-not-found');
    const entry = d.vault.getSecret(vm.vaultRef);
    return d.remoteBrowser.list(vm, entry, directory);
  });

  ipcMain.handle(IPC.TRANSFER_REMOTE_STAT, async (_e, vmId: number, remotePath: string) => {
    const vm = d.repo.getVm(vmId);
    if (!vm) throw new Error('vm-not-found');
    const entry = d.vault.getSecret(vm.vaultRef);
    return d.remoteBrowser.stat(vm, entry, remotePath);
  });

  ipcMain.handle(IPC.TRANSFER_START, async (_e, request: TransferStartRequest) => d.transfers.start(request));
  ipcMain.handle(IPC.TRANSFER_PAUSE, async (_e, id: string) => d.transfers.pause(id));
  ipcMain.handle(IPC.TRANSFER_RESUME, async (_e, id: string) => d.transfers.resume(id));
  ipcMain.handle(IPC.TRANSFER_STOP, async (_e, id: string) => d.transfers.stop(id));
  ipcMain.handle(IPC.TRANSFER_DELETE_PARTIALS, async (_e, id: string) => d.transfers.deletePartials(id));

  d.transfers.on('state', (record) => d.mainWindow()?.webContents.send(IPC.TRANSFER_STATE, record));
  d.transfers.on('progress', (progress) => d.mainWindow()?.webContents.send(IPC.TRANSFER_PROGRESS, progress));
  d.transfers.on('log', (log) => d.mainWindow()?.webContents.send(IPC.TRANSFER_LOG, log));
  d.transfers.on('toast', (toast) => d.mainWindow()?.webContents.send(IPC.TRANSFER_TOAST, toast));
}
