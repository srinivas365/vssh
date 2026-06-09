import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { app } from 'electron';
import type { TouchIdStatus } from '@shared/types';

const execFileAsync = promisify(execFile);

const UNSUPPORTED: TouchIdStatus = {
  supported: false,
  available: false,
  enrolled: false,
};

function binaryPath(): string | null {
  if (process.platform !== 'darwin') return null;
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'vssh-keychain');
  }
  return path.join(app.getAppPath(), 'native/macos-keychain/vssh-keychain');
}

async function run(args: string[], stdin?: string): Promise<string> {
  const bin = binaryPath();
  if (!bin) throw new Error('touch-id-unavailable');

  if (stdin !== undefined) {
    return await new Promise((resolve, reject) => {
      const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve(stdout.trim());
        else reject(mapExitError(code, stderr.trim()));
      });
      child.stdin.write(stdin);
      child.stdin.end();
    });
  }

  const { stdout } = await execFileAsync(bin, args, { maxBuffer: 1024 * 1024 });
  return stdout.trim();
}

function mapExitError(code: number | null, stderr: string): Error {
  if (code === 2 || stderr.includes('touch-id-cancelled')) {
    return new Error('touch-id-cancelled');
  }
  if (code === 3 || stderr.includes('touch-id-unavailable')) {
    return new Error('touch-id-unavailable');
  }
  if (code === 4 || stderr.includes('touch-id-not-enrolled')) {
    return new Error('touch-id-not-enrolled');
  }
  const match = stderr.match(/touch-id-failed:(-?\d+)/);
  if (match?.[1] === '-34018') {
    return new Error('touch-id-missing-entitlement');
  }
  return new Error(stderr.includes('touch-id-failed') ? stderr : 'touch-id-failed');
}

export async function getTouchIdStatus(): Promise<TouchIdStatus> {
  if (process.platform !== 'darwin') return UNSUPPORTED;
  try {
    const raw = await run(['status']);
    const parsed = JSON.parse(raw) as TouchIdStatus;
    return {
      supported: parsed.supported === true,
      available: parsed.available === true,
      enrolled: parsed.enrolled === true,
    };
  } catch {
    return UNSUPPORTED;
  }
}

export async function saveTouchIdPassword(password: string): Promise<void> {
  await run(['save'], password);
}

export async function loadTouchIdPassword(): Promise<string> {
  return await run(['load']);
}

export async function clearTouchIdPassword(): Promise<void> {
  if (process.platform !== 'darwin') return;
  try {
    await run(['clear']);
  } catch (err) {
    if (err instanceof Error && err.message === 'touch-id-not-enrolled') return;
    throw err;
  }
}
