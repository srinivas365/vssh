export type AuthMethod = 'password' | 'key' | 'key+password';

export interface Folder {
  id: number;
  name: string;
  parentId: number | null;
  sortOrder: number;
}

export interface Vm {
  id: number;
  folderId: number | null;
  label: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  keyPath: string | null;
  vaultRef: string;
  autoCopyDisabled: boolean;
  autoSubmitEnabled: boolean;
  lastUsedAt: number | null;
  createdAt: number;
}

export interface VmInput {
  folderId: number | null;
  label: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  keyPath: string | null;
  autoSubmitEnabled: boolean;
}

export interface VaultEntry {
  password?: string;
  sudoPassword?: string;
  keyPassphrase?: string;
}

export type PromptType = 'login' | 'sudo' | 'key-passphrase' | 'generic';

export interface ToastPayload {
  sessionId: string;
  vmId: number;
  promptType: PromptType;
  hasSecret: boolean;
  delivery: 'copied' | 'sent' | 'none';
}

export interface SessionState {
  sessionId: string;
  vmId: number;
  status: 'connecting' | 'connected' | 'closed' | 'error';
  latencyMs: number | null;
  startedAt: number;
}

declare global {
  interface Window {
    api: import('../preload/preload').Api;
  }
}
