import React, { useEffect, useMemo, useState } from 'react';
import { useVmsStore } from '../../state/vms-store';
import { useSessionsStore } from '../../state/sessions-store';
import { useUiStore } from '../../state/ui-store';
import { Vm } from '@shared/types';
import { WorkspaceSection } from './WorkspaceSection';
import { NewWorkspaceButton } from './NewWorkspaceButton';
import './Sidebar.css';

interface Props {
  onNewVm: () => void;
  onEditVm: (vm: Vm) => void;
}

export function Sidebar({ onNewVm, onEditVm }: Props) {
  const { vms, folders, refresh, remove } = useVmsStore();
  const addTab = useSessionsStore((s) => s.addTab);
  const [query, setQuery] = useState('');

  useEffect(() => { refresh(); }, [refresh]);

  const forgetFolders = useUiStore((s) => s.forgetFolders);
  useEffect(() => {
    forgetFolders(folders.map((f) => f.id));
  }, [folders, forgetFolders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vms;
    return vms.filter((v) =>
      v.label.toLowerCase().includes(q) ||
      v.host.toLowerCase().includes(q) ||
      v.username.toLowerCase().includes(q)
    );
  }, [vms, query]);

  const grouped = useMemo(() => {
    const map = new Map<number | null, Vm[]>();
    for (const v of filtered) {
      const list = map.get(v.folderId) ?? [];
      list.push(v);
      map.set(v.folderId, list);
    }
    return map;
  }, [filtered]);

  async function connect(vm: Vm) {
    const sessionId = await window.api.session.start(vm.id, 80, 24);
    addTab({ sessionId, vmId: vm.id, label: vm.label, state: 'connecting' });
  }

  // folders come from listFolders() pre-sorted by sort_order, name
  const sortedFolders = folders;
  const onlyOneWorkspace = folders.length === 1;
  const ungrouped = grouped.get(null) ?? [];

  return (
    <aside className="sidebar">
      <div className="sidebar-section-label">Workspaces</div>
      <div className="sidebar-search-wrap">
        <span className="sidebar-search-icon">⌕</span>
        <input
          className="sidebar-search"
          placeholder="Search hosts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="sidebar-list">
        {sortedFolders.map((f) => {
          const items = grouped.get(f.id) ?? [];
          return (
            <WorkspaceSection
              key={f.id}
              folder={f}
              count={items.length}
              canDelete={!onlyOneWorkspace}>
              {items.map((vm) => (
                <VmRow key={vm.id} vm={vm}
                  onConnect={() => connect(vm)}
                  onEdit={() => onEditVm(vm)}
                  onDelete={() => remove(vm.id)} />
              ))}
            </WorkspaceSection>
          );
        })}

        {ungrouped.length > 0 && (
          <div className="sidebar-folder">
            <div className="sidebar-folder-name">Unassigned</div>
            {ungrouped.map((vm) => (
              <VmRow key={vm.id} vm={vm}
                onConnect={() => connect(vm)}
                onEdit={() => onEditVm(vm)}
                onDelete={() => remove(vm.id)} />
            ))}
          </div>
        )}

        {folders.length === 0 && ungrouped.length === 0 && (
          <div className="sidebar-empty">
            <p>No saved hosts yet.</p>
            <p>Add one to get started.</p>
          </div>
        )}
      </div>

      <NewWorkspaceButton />
      <button className="sidebar-new" onClick={onNewVm} style={{ marginTop: 4 }}>
        <span className="sidebar-new-plus">+</span> New host
      </button>
    </aside>
  );
}

function VmRow({ vm, onConnect, onEdit, onDelete }: {
  vm: Vm;
  onConnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('application/vm-id', String(vm.id));
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div className="vm-row"
         draggable
         onDragStart={onDragStart}
         onDoubleClick={onConnect}
         title={`${vm.username}@${vm.host}:${vm.port}`}>
      <div className="vm-row-main">
        <span className="vm-row-icon">⊟</span>
        <div className="vm-row-text">
          <div className="vm-row-label">{vm.label}</div>
          <div className="vm-row-host">{vm.username}@{vm.host}</div>
        </div>
      </div>
      <div className="vm-actions">
        <button onClick={onConnect} title="Connect">▶</button>
        <button onClick={onEdit} title="Edit">✎</button>
        <button onClick={onDelete} title="Delete">✕</button>
      </div>
    </div>
  );
}
