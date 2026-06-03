import { app, BrowserWindow, clipboard, powerMonitor, Menu, globalShortcut } from 'electron';
import path from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from './db/migrations';
import { ensureDefaultWorkspace } from './startup-hygiene';
import { VmsRepo } from './db/vms-repo';
import { Vault } from './vault/vault';
import { SessionManager } from './ssh/session-manager';
import { ClipboardService } from './clipboard';
import { registerIpc } from './ipc';
import { DEFAULTS, IPC } from '@shared/constants';
import { TransferManager } from './transfer/transfer-manager';
import { RemoteBrowserService } from './transfer/remote-browser-service';
import { chooseTransferEngine } from './transfer/engine-selection';
import { hasLocalRsync, hasRemoteRsync } from './transfer/rsync-availability';
import { SftpTransferEngine } from './transfer/sftp-engine';
import { RsyncTransferEngine } from './transfer/rsync-engine';

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '../renderer/index.html'));
  return win;
}

app.whenReady().then(() => {
  const userData = app.getPath('userData');
  const db = new Database(path.join(userData, 'vms.db'));
  migrate(db);
  const repo = new VmsRepo(db);
  ensureDefaultWorkspace(db, repo);
  const vault = new Vault(path.join(userData, 'vault.enc'));
  const sessions = new SessionManager();
  const clip = new ClipboardService({
    writeText: (t) => clipboard.writeText(t),
    clear: () => clipboard.clear(),
  });

  const sftpEngine = new SftpTransferEngine();
  const rsyncEngine = new RsyncTransferEngine();
  const transfers = new TransferManager({
    chooseEngine: async (request) => {
      const vm = repo.getVm(request.vmId);
      if (!vm) throw new Error('vm-not-found');
      const engine = chooseTransferEngine({
        localRsync: await hasLocalRsync(),
        remoteRsync: await hasRemoteRsync(vm),
      });
      if (engine === 'sftp' && vm.authMethod === 'password') {
        transfers.emit('log', { id: request.vmId.toString(), line: 'Password-based transfers use SFTP fallback for secure prompt handling', level: 'info', at: Date.now() });
      }
      return engine;
    },
    startEngine: async (record) => {
      const vm = repo.getVm(record.vmId);
      if (!vm) { transfers.fail(record.id, 'vm-not-found', false); return; }
      const context = {
        vm,
        secret: vault.getSecret(vm.vaultRef),
        emitProgress: (event: import('@shared/types').TransferProgressEvent) => transfers.emit('progress', event),
        emitLog: (line: string, level: 'info' | 'warn' | 'error' = 'info') => transfers.emit('log', { id: record.id, line, level, at: Date.now() }),
        markRunning: () => transfers.updateStatus(record.id, 'running'),
        markSucceeded: () => transfers.updateStatus(record.id, 'succeeded'),
        markFailed: (error: string, partialsKept: boolean) => transfers.fail(record.id, error, partialsKept),
      };
      if (record.engine === 'sftp') {
        await sftpEngine.start(record, context);
      } else if (record.engine === 'rsync') {
        rsyncEngine.start(record, context);
      }
    },
  });
  const remoteBrowser = new RemoteBrowserService();

  registerIpc({ db, repo, vault, sessions, clip, mainWindow: () => mainWindow, transfers, remoteBrowser });

  transfers.on('engine-stop', (id: string) => { rsyncEngine.stop(id); sftpEngine.abort(id); });
  transfers.on('engine-pause', (id: string) => { rsyncEngine.stop(id); sftpEngine.abort(id); });

  mainWindow = createWindow();

  // auto-lock on system events
  const lockAll = async () => {
    await vault.lock();
    sessions.closeAll();
    mainWindow?.webContents.send(IPC.VAULT_STATE_CHANGED, vault.state());
  };
  powerMonitor.on('lock-screen', () => { void lockAll(); });
  powerMonitor.on('suspend', () => { void lockAll(); });

  // ⌘L global shortcut (only when our window is focused)
  globalShortcut.register('CommandOrControl+L', () => {
    if (BrowserWindow.getFocusedWindow() === mainWindow) void lockAll();
  });

  // idle auto-lock — poll every 30s, lock if idleSeconds > AUTO_LOCK_MS / 1000
  setInterval(() => {
    if (vault.state() !== 'unlocked') return;
    if (powerMonitor.getSystemIdleTime() * 1000 > DEFAULTS.AUTO_LOCK_MS) void lockAll();
  }, 30_000);
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => globalShortcut.unregisterAll());
