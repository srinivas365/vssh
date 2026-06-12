export function shouldIdleAutoLock(idleSeconds: number, autoLockMinutes: number): boolean {
  return idleSeconds >= autoLockMinutes * 60;
}
