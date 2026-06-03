import type { TransferStatus } from '@shared/types';

export function canPause(status: TransferStatus): boolean {
  return status === 'running';
}

export function canResume(status: TransferStatus, partialsKept: boolean): boolean {
  return (status === 'paused' || status === 'failed') && partialsKept;
}

export function canStop(status: TransferStatus): boolean {
  return status === 'preparing' || status === 'running' || status === 'paused';
}

export function partialsKeptForOutcome(outcome: 'pause' | 'stop' | 'failure'): boolean {
  return outcome === 'pause' || outcome === 'failure';
}
