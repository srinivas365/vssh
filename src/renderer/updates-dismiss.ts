const DISMISS_KEY = 'vssh.dismissedUpdateVersion';

export function isUpdateDismissed(version: string): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === version;
  } catch {
    return false;
  }
}

export function dismissUpdate(version: string): void {
  try {
    localStorage.setItem(DISMISS_KEY, version);
  } catch {
    // ignore storage errors
  }
}

export function clearDismissedUpdate(): void {
  try {
    localStorage.removeItem(DISMISS_KEY);
  } catch {
    // ignore storage errors
  }
}
