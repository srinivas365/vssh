import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

let app: ElectronApplication;
let page: Page;
let userDataDir: string;

test.beforeAll(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vssh-ws-e2e-'));
  app = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: REPO_ROOT,
    env: { ...process.env, NODE_ENV: 'test' },
  });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  try { await app?.close(); } catch { /* ignore */ }
  if (userDataDir && fs.existsSync(userDataDir)) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

test('workspace create, host assignment, delete cascade', async () => {
  // 1. Unlock (create vault on first run)
  const pwInputs = page.locator('input[type="password"]');
  await expect(pwInputs.first()).toBeVisible({ timeout: 30_000 });
  await pwInputs.nth(0).fill('a-very-long-master-pw');
  await pwInputs.nth(1).fill('a-very-long-master-pw');
  await page.getByRole('button', { name: /create vault/i }).click();

  // 2. Default workspace exists automatically
  await expect(page.locator('.ws-section', { hasText: 'Default' })).toBeVisible({ timeout: 10_000 });

  // 3. Create a "Production" workspace via the sidebar
  await page.getByRole('button', { name: /\+ New workspace/i }).click();
  const wsInput = page.locator('input[placeholder="New workspace name"]');
  await expect(wsInput).toBeVisible();
  await wsInput.fill('Production');
  await wsInput.press('Enter');
  await expect(page.locator('.ws-section', { hasText: 'Production' })).toBeVisible();

  // 4. Add a host under Production
  await page.getByRole('button', { name: /\+ New host/i }).first().click();
  await page.getByRole('heading', { name: /New VM/i }).waitFor();

  // Workspace dropdown shows current pick; choose Production
  const form = page.locator('form.vm-form');
  await form.locator('.rselect-trigger').first().click();
  await page.getByRole('option', { name: 'Production' }).click();
  const textInputs = form.locator('input:not([type="password"]):not([type="number"])');
  const numberInputs = form.locator('input[type="number"]');
  const pwInputsForm = form.locator('input[type="password"]');
  await textInputs.nth(0).fill('e2e-vm');
  await textInputs.nth(1).fill('127.0.0.1');
  await numberInputs.nth(0).fill('2222');
  await textInputs.nth(2).fill('testuser');
  await pwInputsForm.nth(0).fill('testpassword12345');
  await form.getByRole('button', { name: /^Create$/ }).click();

  // 5. Host appears under Production
  const prodSection = page.locator('.ws-section', { hasText: 'Production' });
  await expect(prodSection.locator('.vm-row', { hasText: 'e2e-vm' })).toBeVisible({ timeout: 10_000 });

  // 6. Delete Production — hosts should move to Default
  await prodSection.locator('.ws-header').hover();
  await prodSection.getByRole('button', { name: 'Delete' }).click();
  // Once in delete-confirm mode the section header (with "Production" text) is
  // replaced, so the section locator no longer matches by hasText. Use the
  // page-level confirm dialog instead — only one is ever visible at a time.
  await page.locator('.ws-delete-confirm').getByRole('button', { name: 'Yes' }).click();

  await expect(page.locator('.ws-section', { hasText: 'Production' })).toHaveCount(0);
  await expect(
    page.locator('.ws-section', { hasText: 'Default' }).locator('.vm-row', { hasText: 'e2e-vm' })
  ).toBeVisible();

  // 7. Default's ✕ button should be hidden (last workspace)
  const defaultSection = page.locator('.ws-section', { hasText: 'Default' });
  await defaultSection.locator('.ws-header').hover();
  await expect(defaultSection.getByRole('button', { name: 'Delete' })).toHaveCount(0);
});
