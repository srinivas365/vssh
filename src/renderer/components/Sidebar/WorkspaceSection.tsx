import React, { useState, useRef, useEffect } from 'react';
import { Folder } from '@shared/types';
import { useVmsStore } from '../../state/vms-store';
import { useUiStore } from '../../state/ui-store';
import './WorkspaceSection.css';

interface Props {
  folder: Folder;
  count: number;
  canDelete: boolean;
  children: React.ReactNode;
}

type Mode = 'view' | 'rename' | 'delete-confirm';

export function WorkspaceSection({ folder, count, canDelete, children }: Props) {
  const [mode, setMode] = useState<Mode>('view');
  const [dragOver, setDragOver] = useState(false);
  const collapsed = useUiStore((s) => s.collapsedFolders.has(folder.id));
  const toggle = useUiStore((s) => s.toggleFolderCollapsed);
  const renameFolder = useVmsStore((s) => s.renameFolder);
  const deleteFolder = useVmsStore((s) => s.deleteFolder);
  const moveVmToFolder = useVmsStore((s) => s.moveVmToFolder);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'rename') {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [mode]);

  function onDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes('application/vm-id')) {
      e.preventDefault();
      setDragOver(true);
    }
  }
  function onDragLeave() { setDragOver(false); }
  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const idStr = e.dataTransfer.getData('application/vm-id');
    const vmId = Number(idStr);
    if (!vmId) return;
    await moveVmToFolder(vmId, folder.id);
  }

  function commitRename(value: string) {
    const trimmed = value.trim();
    if (trimmed && trimmed !== folder.name) {
      void renameFolder(folder.id, trimmed);
    }
    setMode('view');
  }

  async function confirmDelete() {
    try {
      await deleteFolder(folder.id);
    } catch (err) {
      console.warn('delete failed', err);
    }
    setMode('view');
  }

  return (
    <div className={`ws-section ${dragOver ? 'ws-dragover' : ''}`}
         onDragOver={onDragOver}
         onDragLeave={onDragLeave}
         onDrop={onDrop}>
      {mode === 'view' && (
        <div className="ws-header" onClick={() => toggle(folder.id)}>
          <span className={`ws-chev ${collapsed ? 'ws-chev-collapsed' : ''}`}>▾</span>
          <span className="ws-name">{folder.name}</span>
          <span className="ws-count">{count}</span>
          <span className="ws-actions" onClick={(e) => e.stopPropagation()}>
            <button title="Rename" aria-label="Rename" onClick={() => setMode('rename')}>✎</button>
            {canDelete && (
              <button title="Delete" aria-label="Delete" onClick={() => setMode('delete-confirm')}>✕</button>
            )}
          </span>
        </div>
      )}
      {mode === 'rename' && (
        <div className="ws-header" onClick={(e) => e.stopPropagation()}>
          <span className={`ws-chev ${collapsed ? 'ws-chev-collapsed' : ''}`}>▾</span>
          <input
            ref={inputRef}
            className="ws-rename-input"
            defaultValue={folder.name}
            onBlur={(e) => commitRename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename((e.target as HTMLInputElement).value);
              else if (e.key === 'Escape') setMode('view');
            }}
          />
        </div>
      )}
      {mode === 'delete-confirm' && (
        <div className="ws-delete-confirm">
          <span className="ws-delete-confirm-msg">Delete? Hosts move to another workspace</span>
          <button className="yes" onClick={confirmDelete}>Yes</button>
          <button onClick={() => setMode('view')}>No</button>
        </div>
      )}
      <div className={`ws-body ${collapsed ? 'ws-body-collapsed' : ''}`}>
        {children}
      </div>
    </div>
  );
}
