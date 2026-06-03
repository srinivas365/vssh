import { spawn } from 'node:child_process';
import type { Vm } from '@shared/types';
import { parseCommandExistsExit } from './engine-selection';

function commandSucceeds(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.once('error', () => resolve(false));
    child.once('exit', (code) => resolve(parseCommandExistsExit(code)));
  });
}

export function hasLocalRsync(): Promise<boolean> {
  return commandSucceeds('which', ['rsync']);
}

export function hasRemoteRsync(vm: Vm): Promise<boolean> {
  if (vm.authMethod === 'password') return Promise.resolve(false);
  const args = ['-p', String(vm.port)];
  if (vm.keyPath) args.push('-i', vm.keyPath);
  args.push('-o', 'BatchMode=yes', `${vm.username}@${vm.host}`, 'command -v rsync >/dev/null 2>&1');
  return commandSucceeds('ssh', args);
}
