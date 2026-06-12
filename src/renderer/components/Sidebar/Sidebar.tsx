import React, { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Pencil,
  Play,
  Plus,
  Search,
  Server,
  PanelLeftClose,
  Settings,
  Terminal as TerminalIcon,
  Trash2,
  X,
} from 'lucide-react';
import { useVmsStore } from '../../state/vms-store';
import { useSessionsStore } from '../../state/sessions-store';
import { useUiStore } from '../../state/ui-store';
import { Vm } from '@shared/types';
import { connectVm } from '../../connect-vm';
import { WorkspaceSection } from './WorkspaceSection';
import { NewWorkspaceButton } from './NewWorkspaceButton';
import './Sidebar.css';

interface Props {
  onNewVm: () => void;
  onEditVm: (vm: Vm) => void;
  onCloneVm: (vm: Vm) => void;
  onOpenSettings: () => void;
  onOpenLocalTerminal: () => void;
}

export function Sidebar({ onNewVm, onEditVm, onCloneVm, onOpenSettings, onOpenLocalTerminal }: Props) {
  const { vms, folders, refresh, remove } = useVmsStore();
  const addTab = useSessionsStore((s) => s.addTab);
  const [query, setQuery] = useState('');

  useEffect(() => { refresh(); }, [refresh]);

  const forgetFolders = useUiStore((s) => s.forgetFolders);
  const toggleSidebarCollapsed = useUiStore((s) => s.toggleSidebarCollapsed);
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
    await connectVm(vm, addTab);
  }

  // folders come from listFolders() pre-sorted by sort_order, name
  const sortedFolders = folders;
  const onlyOneWorkspace = folders.length === 1;
  const ungrouped = grouped.get(null) ?? [];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-section-label">Workspaces</div>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={toggleSidebarCollapsed}
          title="Hide sidebar"
          aria-label="Hide sidebar">
          <PanelLeftClose size={14} strokeWidth={2} />
        </button>
      </div>
      <div className="sidebar-search-wrap">
        <span className="sidebar-search-icon"><Search size={14} strokeWidth={2} /></span>
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
                  onClone={() => onCloneVm(vm)}
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
                onClone={() => onCloneVm(vm)}
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

      <div className="sidebar-footer">
        <NewWorkspaceButton />
        <button className="sidebar-new" onClick={onOpenLocalTerminal}>
          <TerminalIcon size={14} strokeWidth={2.2} /> Local terminal
        </button>
        <button className="sidebar-new" onClick={onNewVm}>
          <Plus size={14} strokeWidth={2.2} /> New host
        </button>
        <button className="sidebar-new sidebar-settings-button" onClick={onOpenSettings}>
          <Settings size={14} strokeWidth={2} /> Settings
        </button>
      </div>
    </aside>
  );
}

function VmRow({ vm, onConnect, onEdit, onClone, onDelete }: {
  vm: Vm;
  onConnect: () => void;
  onEdit: () => void;
  onClone: () => void;
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
        <span className="vm-row-icon"><Server size={14} strokeWidth={2} /></span>
        <div className="vm-row-text">
          <div className="vm-row-label">{vm.label}</div>
          <div className="vm-row-host">{vm.username}@{vm.host}</div>
        </div>
      </div>
      <div className="vm-actions">
        <button onClick={onConnect} title="Connect"><Play size={12} strokeWidth={2.2} /></button>
        <button onClick={onClone} title="Clone"><Copy size={12} strokeWidth={2} /></button>
        <button onClick={onEdit} title="Edit"><Pencil size={12} strokeWidth={2} /></button>
        <button onClick={onDelete} title="Delete"><X size={12} strokeWidth={2.2} /></button>
      </div>
    </div>
  );
}
