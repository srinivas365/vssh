import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** Playwright launch args; adds --no-sandbox on Linux when chrome-sandbox is not setuid. */
export function electronLaunchArgs(args: string[]): string[] {
  const out = [...args];
  if (process.platform !== 'linux') return out;
  const sandbox = path.join(REPO_ROOT, 'node_modules/electron/dist/chrome-sandbox');
  try {
    const mode = fs.statSync(sandbox).mode;
    if (!(mode & 0o4000)) out.push('--no-sandbox');
  } catch {
    /* electron not installed */
  }
  return out;
}
