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

export interface Identity {
  id: number;
  label: string;
  username: string;
  vaultRef: string;
  createdAt: number;
}

export interface IdentityInput {
  label: string;
  username: string;
}

export interface IdentitySecrets {
  password: string;
  sudoPassword?: string;
}

export interface IdentitySecretsPatch {
  password?: string;
  sudoPassword?: string;
  sudoSameAsPassword?: boolean;
}

export interface IdentityCredentials {
  username: string;
  password: string;
  sudoPassword: string;
}

export interface VaultEntry {
  password?: string;
  sudoPassword?: string;
  keyPassphrase?: string;
}

export interface VmConnectionTestResult {
  ok: boolean;
  latencyMs: number | null;
  message: string;
}

export type ThemeName = 'light' | 'dark' | 'claude' | 'dracula' | 'nord' | 'solarized-dark';

export interface AppSettings {
  theme: ThemeName;
  appFontFamily: string;
  terminalFontFamily: string;
  terminalFontSize: number;
  autoLockMinutes: number;
  touchIdEnabled: boolean;
}

export type AppSettingsPatch = Partial<AppSettings>;

export type UpdateCheckResult =
  | { status: 'current'; currentVersion: string }
  | { status: 'available'; currentVersion: string; latestVersion: string; releaseNotes: string; releaseUrl: string }
  | { status: 'skipped' }
  | { status: 'error'; message: string };

export interface TouchIdStatus {
  supported: boolean;
  available: boolean;
  enrolled: boolean;
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
  vmId: number | null;
  status: 'connecting' | 'connected' | 'closed' | 'error';
  latencyMs: number | null;
  startedAt: number;
}

export type TransferDirection = 'upload' | 'download';
export type TransferEngineName = 'rsync' | 'sftp';
export type TransferStatus = 'preparing' | 'running' | 'paused' | 'stopped' | 'succeeded' | 'failed';
export type TransferEntryType = 'file' | 'directory' | 'symlink' | 'unknown';
export type FolderCopyMode = 'as-is' | 'contents-only';

export interface LocalSelection {
  path: string;
  name: string;
  type: 'file' | 'directory';
  sizeBytes: number | null;
}

export interface RemoteEntry {
  name: string;
  path: string;
  type: TransferEntryType;
  sizeBytes: number | null;
  modifiedAt: number | null;
}

export interface TransferSource {
  path: string;
  name: string;
  type: 'file' | 'directory';
}

export interface TransferDestination {
  directory: string;
  finalPath: string;
}

export interface TransferStartRequest {
  vmId: number;
  vmLabel: string;
  vmHost: string;
  direction: TransferDirection;
  source: TransferSource;
  destination: TransferDestination;
  folderMode: FolderCopyMode;
  overwrite: boolean;
}

export interface TransferRecord {
  id: string;
  vmId: number;
  vmLabel: string;
  vmHost: string;
  direction: TransferDirection;
  engine: TransferEngineName;
  status: TransferStatus;
  source: TransferSource;
  destination: TransferDestination;
  folderMode: FolderCopyMode;
  startedAt: number;
  finishedAt: number | null;
  transferredBytes: number;
  totalBytes: number | null;
  percent: number | null;
  error: string | null;
  partialsKept: boolean;
}

export interface TransferProgressEvent {
  id: string;
  transferredBytes: number;
  totalBytes: number | null;
  percent: number | null;
}

export interface TransferLogEvent {
  id: string;
  line: string;
  level: 'info' | 'warn' | 'error';
  at: number;
}

export interface TransferToastPayload {
  id: string;
  vmId: number;
  status: TransferStatus;
  message: string;
  canResume: boolean;
  canDeletePartials: boolean;
}

declare global {
  interface Window {
    api: import('../preload/preload').Api;
  }
}
