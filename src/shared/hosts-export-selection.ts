import type { Folder, Vm } from './types';
import type { HostsExportSelection } from './hosts-export';

export function countExportHosts(vms: Vm[], selection: HostsExportSelection): number {
  const folderIds = new Set(selection.folderIds);
  return vms.filter((vm) => {
    if (vm.folderId === null) return selection.includeUnassigned;
    return folderIds.has(vm.folderId);
  }).length;
}

export function defaultExportSelection(folders: Folder[], vms: Vm[]): HostsExportSelection {
  return {
    folderIds: folders.map((f) => f.id),
    includeUnassigned: vms.some((v) => v.folderId === null),
  };
}

export function workspaceHostCounts(folders: Folder[], vms: Vm[]): Map<number | null, number> {
  const counts = new Map<number | null, number>();
  for (const vm of vms) {
    counts.set(vm.folderId, (counts.get(vm.folderId) ?? 0) + 1);
  }
  for (const folder of folders) {
    if (!counts.has(folder.id)) counts.set(folder.id, 0);
  }
  return counts;
}
