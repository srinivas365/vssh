import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAIN_ENTRY = path.join(REPO_ROOT, 'dist', 'main', 'index.js');
const RENDERER_HTML = path.join(REPO_ROOT, 'dist', 'renderer', 'index.html');
const SCREENSHOT_DIR = path.join(REPO_ROOT, 'docs', 'screenshots');

let app: ElectronApplication;
let page: Page;
let userDataDir: string;

async function capture(name: string) {
  await page.waitForTimeout(350);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, name),
    fullPage: true,
  });
}

test.beforeAll(async () => {
  if (!fs.existsSync(MAIN_ENTRY)) {
    throw new Error(`Missing main entry: ${MAIN_ENTRY} — run \`npm run build\` first.`);
  }
  if (!fs.existsSync(RENDERER_HTML)) {
    throw new Error(`Missing renderer: ${RENDERER_HTML} — run \`npm run build\` first.`);
  }

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vssh-readme-shot-'));

  app = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  page = await app.firstWindow();
  await page.setViewportSize({ width: 1560, height: 980 });
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  try { await app?.close(); } catch { /* ignore */ }
  if (userDataDir && fs.existsSync(userDataDir)) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

test('capture screenshots for README feature tour', async () => {
  const unlockHeading = page.getByRole('heading', { name: /Create master password|Unlock vault/i });
  await expect(unlockHeading).toBeVisible({ timeout: 30_000 });
  await capture('unlock.png');

  const pwInputs = page.locator('input[type="password"]');
  await pwInputs.nth(0).fill('a-very-long-master-pw');
  await pwInputs.nth(1).fill('a-very-long-master-pw');
  await page.getByRole('button', { name: /create vault/i }).click();

  await expect(page.locator('.hosts-title')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: /\+ New workspace/i }).click();
  const wsInput = page.locator('input[placeholder="New workspace name"]');
  await expect(wsInput).toBeVisible();
  await wsInput.fill('Production');
  await wsInput.press('Enter');

  await page.getByRole('button', { name: /\+ New host/i }).first().click();
  await page.getByRole('heading', { name: /New VM/i }).waitFor();

  const form = page.locator('form.vm-form');
  await form.locator('.rselect-trigger').first().click();
  await page.getByRole('option', { name: 'Production' }).click();

  const textInputs = form.locator('input:not([type="password"]):not([type="number"])');
  const numberInputs = form.locator('input[type="number"]');
  const pwInputsForm = form.locator('input[type="password"]');

  await textInputs.nth(0).fill('docs-vm');
  await textInputs.nth(1).fill('127.0.0.1');
  await numberInputs.nth(0).fill('2222');
  await textInputs.nth(2).fill('testuser');
  await pwInputsForm.nth(0).fill('testpassword12345');
  await form.getByRole('button', { name: /^Create$/ }).click();

  const hostCard = page.locator('.host-card', { hasText: 'docs-vm' });
  await expect(hostCard).toBeVisible({ timeout: 10_000 });
  await capture('hosts.png');

  await page.keyboard.press('Control+k');
  await expect(page.locator('.qc-panel')).toBeVisible();
  await page.locator('.qc-panel input').fill('docs');
  await capture('quick-connect.png');
  await page.keyboard.press('Escape');

  await hostCard.getByRole('button', { name: /connect/i }).click();
  await page.getByRole('button', { name: /Terminal/i }).click();
  await expect(page.locator('.xterm-screen')).toBeVisible({ timeout: 45_000 });

  await page.locator('.toast').first().waitFor({ timeout: 5_000 }).catch(() => undefined);
  await capture('terminal.png');

  await page.getByRole('button', { name: /Transfers/i }).click();
  await expect(page.getByRole('heading', { name: /Transfers/i })).toBeVisible();
  await capture('transfers.png');

  await page.getByRole('button', { name: /Settings/i }).click();
  await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible();
  await capture('settings.png');

  // Apply a non-default visual profile and capture how it changes the UI.
  const settingsCards = page.locator('.settings-card');
  const themeTrigger = settingsCards.nth(0).locator('.rselect-trigger');
  await themeTrigger.click();
  await page.getByRole('option', { name: 'Dracula' }).click();
  await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dracula');

  const fontsCard = settingsCards.nth(1);
  await fontsCard.locator('.rselect-trigger').nth(0).click(); // App font
  await page.getByRole('option', { name: 'Monospace' }).click();
  await fontsCard.locator('.rselect-trigger').nth(1).click(); // Terminal font
  await page.getByRole('option', { name: 'JetBrains Mono' }).click();

  await capture('settings-theme-font.png');

  await page.getByRole('button', { name: /Hosts/i }).click();
  await expect(page.locator('.hosts-title')).toBeVisible();
  await capture('hosts-theme-font.png');

  await page.getByRole('button', { name: /Terminal/i }).click();
  await expect(page.locator('.xterm-screen')).toBeVisible();
  await capture('terminal-theme-font.png');
});
