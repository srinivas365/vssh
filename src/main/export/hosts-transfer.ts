import { encryptVault, decryptVault } from '../vault/crypto';
import type { VmsRepo } from '../db/vms-repo';
import type { Vault } from '../vault/vault';
import {
  HOSTS_EXPORT_FORMAT,
  HOSTS_EXPORT_VERSION,
  type HostsExportFile,
  type HostsExportPayload,
} from '@shared/hosts-export';

export function buildExportPayload(
  repo: VmsRepo,
  vault: Vault,
  selection?: import('@shared/hosts-export').HostsExportSelection,
): HostsExportPayload {
  const allFolders = repo.listFolders();
  const allVms = repo.listVms();
  const folderIdSet = new Set(selection?.folderIds ?? allFolders.map((f) => f.id));
  const includeUnassigned = selection?.includeUnassigned ?? allVms.some((v) => v.folderId === null);

  const folders = allFolders.filter((f) => folderIdSet.has(f.id));
  const folderNameById = new Map(folders.map((f) => [f.id, f.name]));
  const vms = allVms.filter((vm) => {
    if (vm.folderId === null) return includeUnassigned;
    return folderIdSet.has(vm.folderId);
  });

  return {
    version: HOSTS_EXPORT_VERSION,
    exportedAt: Date.now(),
    folders: folders.map((f) => ({ name: f.name, sortOrder: f.sortOrder })),
    hosts: vms.map((vm) => ({
      folderName: vm.folderId !== null ? folderNameById.get(vm.folderId) ?? null : null,
      label: vm.label,
      host: vm.host,
      port: vm.port,
      username: vm.username,
      authMethod: vm.authMethod,
      keyPath: vm.keyPath,
      autoSubmitEnabled: vm.autoSubmitEnabled,
      secret: { ...vault.getSecret(vm.vaultRef) },
    })),
  };
}

export async function encryptExportPayload(payload: HostsExportPayload, exportKey: string): Promise<HostsExportFile> {
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  try {
    const blob = await encryptVault(plaintext, exportKey);
    return {
      format: HOSTS_EXPORT_FORMAT,
      version: HOSTS_EXPORT_VERSION,
      ciphertext: blob.toString('base64'),
    };
  } finally {
    plaintext.fill(0);
  }
}

export async function decryptExportFile(file: HostsExportFile, exportKey: string): Promise<HostsExportPayload> {
  if (file.format !== HOSTS_EXPORT_FORMAT || file.version !== HOSTS_EXPORT_VERSION) {
    throw new Error('invalid-export-file');
  }
  const blob = Buffer.from(file.ciphertext, 'base64');
  const plaintext = await decryptVault(blob, exportKey);
  try {
    const payload = JSON.parse(plaintext.toString('utf8')) as HostsExportPayload;
    if (payload.version !== HOSTS_EXPORT_VERSION || !Array.isArray(payload.hosts)) {
      throw new Error('invalid-export-file');
    }
    return payload;
  } finally {
    plaintext.fill(0);
  }
}

export interface ImportHostsResult {
  importedHosts: number;
  createdFolders: number;
}

export async function importHostsPayload(
  repo: VmsRepo,
  vault: Vault,
  payload: HostsExportPayload,
): Promise<ImportHostsResult> {
  const folderIdByName = new Map(repo.listFolders().map((f) => [f.name, f.id]));
  let createdFolders = 0;

  for (const folder of payload.folders ?? []) {
    if (folderIdByName.has(folder.name)) continue;
    const created = repo.createFolder({ name: folder.name, parentId: null, sortOrder: folder.sortOrder });
    folderIdByName.set(folder.name, created.id);
    createdFolders += 1;
  }

  const secretBatch: Record<string, import('@shared/types').VaultEntry> = {};
  let importedHosts = 0;

  for (const host of payload.hosts) {
    const folderId = host.folderName ? folderIdByName.get(host.folderName) ?? null : null;
    const vm = repo.createVm({
      folderId,
      label: host.label,
      host: host.host,
      port: host.port,
      username: host.username,
      authMethod: host.authMethod,
      keyPath: host.keyPath,
      autoSubmitEnabled: host.autoSubmitEnabled,
    });
    secretBatch[vm.vaultRef] = { ...host.secret };
    importedHosts += 1;
  }

  if (Object.keys(secretBatch).length > 0) {
    await vault.setSecretsBatch(secretBatch);
  }

  return { importedHosts, createdFolders };
}

export function parseExportFile(raw: string): HostsExportFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('invalid-export-file');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('invalid-export-file');
  const file = parsed as HostsExportFile;
  if (typeof file.ciphertext !== 'string') throw new Error('invalid-export-file');
  return file;
}
