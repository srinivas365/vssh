import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAIN_ENTRY = path.join(REPO_ROOT, 'dist', 'main', 'main', 'index.js');
const RENDERER_HTML = path.join(REPO_ROOT, 'dist', 'renderer', 'index.html');
const LAUNCHER = path.join(__dirname, 'electron-launcher.js');

let app: ElectronApplication;
let page: Page;
let userDataDir: string;

test.beforeAll(async () => {
  // Sanity: build outputs must exist.
  if (!fs.existsSync(MAIN_ENTRY)) {
    throw new Error(`Missing main entry: ${MAIN_ENTRY} — run \`npm run build\` first.`);
  }
  if (!fs.existsSync(RENDERER_HTML)) {
    throw new Error(`Missing renderer: ${RENDERER_HTML} — run \`npm run build\` first.`);
  }

  // Isolated userData so each run starts with an empty vault/db.
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'termius-e2e-'));

  app = await electron.launch({
    args: [LAUNCHER, `--user-data-dir=${userDataDir}`],
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      // Workaround: main loads renderer from `../renderer/index.html` relative to its own dir,
      // which the current build does not produce. Force loadURL to the real built renderer.
      VITE_DEV_SERVER_URL: 'file://' + RENDERER_HTML,
      NODE_ENV: 'test',
    },
  });

  page = await app.firstWindow();
  // Surface renderer errors when the test fails — useful for debugging.
  page.on('pageerror', (e) => {
    // eslint-disable-next-line no-console
    console.log('[renderer:pageerror]', e.message);
  });
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  try { await app?.close(); } catch { /* ignore */ }
  if (userDataDir && fs.existsSync(userDataDir)) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

test('create vault, save VM, connect, see password-detected toast', async () => {
  // 1. Unlock screen — create master password.
  const pwInputs = page.locator('input[type="password"]');
  await expect(pwInputs.first()).toBeVisible({ timeout: 30_000 });
  await pwInputs.nth(0).fill('a-very-long-master-pw');
  await pwInputs.nth(1).fill('a-very-long-master-pw');
  await page.getByRole('button', { name: /create vault/i }).click();

  // 2. Main screen — open the "+ New VM" modal.
  const newVmBtn = page.getByRole('button', { name: /\+ New VM/i });
  await expect(newVmBtn).toBeVisible({ timeout: 30_000 });
  await newVmBtn.click();

  // 3. Fill the VM form.
  await page.getByRole('heading', { name: /New VM/i }).waitFor();
  // Form is a <form class="vm-form"> with labels: Label, Host, Port, User, Auth, Password, Sudo password
  // We locate inputs by their label text (the input is the sibling text node inside <label>).
  const form = page.locator('form.vm-form');

  // Order of inputs in the form (when authMethod='password'):
  //   0: Label, 1: Host, 2: Port, 3: User, [select Auth], 4: Password, 5: Sudo password
  const textInputs = form.locator('input:not([type="password"]):not([type="number"])');
  const numberInputs = form.locator('input[type="number"]');
  const pwFormInputs = form.locator('input[type="password"]');

  // Label, Host, User
  await textInputs.nth(0).fill('e2e-vm');         // Label
  await textInputs.nth(1).fill('127.0.0.1');      // Host
  await numberInputs.nth(0).fill('2222');         // Port
  await textInputs.nth(2).fill('testuser');       // User
  // authMethod defaults to 'password' so the Password input is visible.
  await pwFormInputs.nth(0).fill('testpassword12345'); // Password

  await form.getByRole('button', { name: /^Create$/ }).click();

  // 4. VM row appears in the sidebar; click the connect button (▶).
  const vmRow = page.locator('.vm-row', { hasText: 'e2e-vm' });
  await expect(vmRow).toBeVisible({ timeout: 10_000 });
  await vmRow.getByRole('button', { name: '▶' }).click();

  // 5. The SSH session starts. linuxserver/openssh-server will prompt for password.
  // The PromptDetector should fire 'login' → main sends SESSION_TOAST → renderer shows the toast.
  const toast = page.locator('.toast');
  await expect(toast).toBeVisible({ timeout: 45_000 });
  await expect(toast).toContainText(/Login password copied|Password copied/i, { timeout: 5_000 });
});
