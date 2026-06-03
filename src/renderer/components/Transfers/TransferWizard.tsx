import React, { useEffect, useState } from 'react';
import type { FolderCopyMode, LocalSelection, RemoteEntry, TransferDirection, Vm } from '@shared/types';
import { useTransfersStore } from '../../state/transfers-store';
import { FolderModeModal } from './FolderModeModal';
import { RemoteBrowserModal } from './RemoteBrowserModal';

interface Props { vm: Vm; direction: TransferDirection; onClose: () => void; }

type Stage = 'local' | 'folder-mode' | 'remote-source' | 'remote-destination' | 'local-destination';

function basename(input: string): string { return input.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? input; }
function joinPath(dir: string, name: string): string { return dir === '/' ? `/${name}` : `${dir.replace(/\/+$/, '')}/${name}`; }

export function TransferWizard({ vm, direction, onClose }: Props) {
  const pushToast = useTransfersStore((s) => s.pushToast);
  const [stage, setStage] = useState<Stage>(direction === 'upload' ? 'local' : 'remote-source');
  const [local, setLocal] = useState<LocalSelection | null>(null);
  const [remote, setRemote] = useState<RemoteEntry | null>(null);
  const [folderMode, setFolderMode] = useState<FolderCopyMode>('as-is');

  useEffect(() => {
    if (stage !== 'local') return;
    window.api.transfer.pickUploadSource().then((selected) => {
      if (!selected) { onClose(); return; }
      setLocal(selected);
      setStage(selected.type === 'directory' ? 'folder-mode' : 'remote-destination');
    });
  }, [stage, onClose]);

  if (stage === 'folder-mode') {
    return <FolderModeModal onChoose={(mode) => { setFolderMode(mode); setStage(direction === 'upload' ? 'remote-destination' : 'local-destination'); }} />;
  }

  if (stage === 'remote-source') {
    return <RemoteBrowserModal vmId={vm.id} select="file-or-folder" onCancel={onClose} onSelect={(entry) => {
      setRemote(entry);
      setStage(entry.type === 'directory' ? 'folder-mode' : 'local-destination');
    }} />;
  }

  if (stage === 'remote-destination') {
    return <RemoteBrowserModal vmId={vm.id} select="folder" onCancel={onClose} onSelect={(entry) => {
      if (!local) return;
      const finalPath = local.type === 'directory' && folderMode === 'contents-only' ? entry.path : joinPath(entry.path, local.name);
      void window.api.transfer.start({
        vmId: vm.id,
        vmLabel: vm.label,
        vmHost: vm.host,
        direction: 'upload',
        source: { path: local.path, name: local.name, type: local.type },
        destination: { directory: entry.path, finalPath },
        folderMode,
        overwrite: false,
      }).then((record) => pushToast({ id: record.id, vmId: record.vmId, status: 'preparing', message: `Uploading ${record.source.name} → ${vm.label}`, canResume: false, canDeletePartials: false }));
      onClose();
    }} />;
  }

  if (stage === 'local-destination') {
    void window.api.transfer.pickDownloadDestination().then((dir) => {
      if (!dir || !remote) { onClose(); return; }
      const finalPath = remote.type === 'directory' && folderMode === 'contents-only' ? dir : joinPath(dir, basename(remote.path));
      void window.api.transfer.start({
        vmId: vm.id,
        vmLabel: vm.label,
        vmHost: vm.host,
        direction: 'download',
        source: { path: remote.path, name: remote.name, type: remote.type === 'directory' ? 'directory' : 'file' },
        destination: { directory: dir, finalPath },
        folderMode,
        overwrite: false,
      }).then((record) => pushToast({ id: record.id, vmId: record.vmId, status: 'preparing', message: `Downloading ${record.source.name} from ${vm.label}`, canResume: false, canDeletePartials: false }));
      onClose();
    });
  }

  return null;
}
