import type { AuthMethod, VaultEntry } from './types';

export const HOSTS_EXPORT_FORMAT = 'vssh-hosts-v1' as const;
export const HOSTS_EXPORT_VERSION = 1 as const;
export const MIN_EXPORT_KEY_LEN = 8;

export interface HostsExportFolder {
  name: string;
  sortOrder: number;
}

export interface HostsExportHost {
  folderName: string | null;
  label: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  keyPath: string | null;
  autoSubmitEnabled: boolean;
  secret: VaultEntry;
}

export interface HostsExportPayload {
  version: typeof HOSTS_EXPORT_VERSION;
  exportedAt: number;
  folders: HostsExportFolder[];
  hosts: HostsExportHost[];
}

export interface HostsExportFile {
  format: typeof HOSTS_EXPORT_FORMAT;
  version: typeof HOSTS_EXPORT_VERSION;
  ciphertext: string;
}

export interface HostsExportResult {
  cancelled?: boolean;
  path?: string;
  hostCount?: number;
}

export interface HostsImportResult {
  cancelled?: boolean;
  importedHosts?: number;
  createdFolders?: number;
}
