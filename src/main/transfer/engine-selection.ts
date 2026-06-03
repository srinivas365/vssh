import type { TransferEngineName } from '@shared/types';

export interface EngineAvailability {
  localRsync: boolean;
  remoteRsync: boolean;
}

export function chooseTransferEngine(availability: EngineAvailability): TransferEngineName {
  return availability.localRsync && availability.remoteRsync ? 'rsync' : 'sftp';
}

export function parseCommandExistsExit(exitCode: number | null): boolean {
  return exitCode === 0;
}
