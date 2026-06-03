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

  const transfers = new TransferManager({ chooseEngine: async () => 'sftp', startEngine: async () => undefined });
  const remoteBrowser = new RemoteBrowserService();

  registerIpc({ db, repo, vault, sessions, clip, mainWindow: () => mainWindow, transfers, remoteBrowser });

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
