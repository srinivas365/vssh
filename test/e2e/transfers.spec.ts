import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAIN_ENTRY = path.join(REPO_ROOT, 'dist', 'main', 'index.js');
const RENDERER_HTML = path.join(REPO_ROOT, 'dist', 'renderer', 'index.html');

let app: ElectronApplication;
let page: Page;
let userDataDir: string;

test.beforeAll(async () => {
  if (!fs.existsSync(MAIN_ENTRY)) {
    throw new Error(`Missing main entry: ${MAIN_ENTRY} — run \`npm run build\` first.`);
  }
  if (!fs.existsSync(RENDERER_HTML)) {
    throw new Error(`Missing renderer: ${RENDERER_HTML} — run \`npm run build\` first.`);
  }

  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vssh-transfers-e2e-'));

  app = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: REPO_ROOT,
    env: { ...process.env, NODE_ENV: 'test' },
  });

  page = await app.firstWindow();
  page.on('pageerror', (e) => { console.log('[renderer:pageerror]', e.message); });
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  try { await app?.close(); } catch { /* ignore */ }
  if (userDataDir && fs.existsSync(userDataDir)) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

test('shows Transfers top nav button after vault setup', async () => {
  const pwInputs = page.locator('input[type="password"]');
  await expect(pwInputs.first()).toBeVisible({ timeout: 30_000 });
  await pwInputs.nth(0).fill('a-very-long-master-pw');
  await pwInputs.nth(1).fill('a-very-long-master-pw');
  await page.getByRole('button', { name: /create vault/i }).click();

  await expect(page.getByRole('button', { name: /Transfers/i })).toBeVisible({ timeout: 30_000 });
});

test('Transfers nav button navigates to transfers page', async () => {
  await page.getByRole('button', { name: /Transfers/i }).click();
  await expect(page.getByRole('heading', { name: /Transfers/i })).toBeVisible();
});

test('shows upload and download buttons on host cards when a host exists', async () => {
  await page.getByRole('button', { name: /Hosts/i }).click();
  await page.getByRole('button', { name: /\+ New host/i }).first().click();

  const form = page.locator('form.vm-form');
  const textInputs = form.locator('input:not([type="password"]):not([type="number"])');
  const numberInputs = form.locator('input[type="number"]');
  const pwFormInputs = form.locator('input[type="password"]');

  await textInputs.nth(0).fill('transfers-test-vm');
  await textInputs.nth(1).fill('127.0.0.1');
  await numberInputs.nth(0).fill('2222');
  await textInputs.nth(2).fill('testuser');
  await pwFormInputs.nth(0).fill('testpass');
  await page.getByRole('button', { name: /save/i }).click();

  await expect(page.getByTitle('Upload')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTitle('Download')).toBeVisible({ timeout: 10_000 });
});
