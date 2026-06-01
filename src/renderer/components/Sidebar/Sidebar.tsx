import React, { useEffect, useMemo, useState } from 'react';
import { useVmsStore } from '../../state/vms-store';
import { useSessionsStore } from '../../state/sessions-store';
import { Vm } from '@shared/types';
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

  const uncategorized = grouped.get(null) ?? [];
  const hasAny = vms.length > 0;

  return (
    <aside className="sidebar">
      <div className="sidebar-section-label">Hosts</div>
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
        {folders.map((f) => {
          const items = grouped.get(f.id) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={f.id} className="sidebar-folder">
              <div className="sidebar-folder-name">
                <span className="sidebar-folder-chev">▾</span>
                {f.name}
                <span className="sidebar-folder-count">{items.length}</span>
              </div>
              {items.map((vm) => (
                <VmRow key={vm.id} vm={vm} onConnect={() => connect(vm)} onEdit={() => onEditVm(vm)} onDelete={() => remove(vm.id)} />
              ))}
            </div>
          );
        })}
        {uncategorized.length > 0 && (
          <div className="sidebar-folder">
            <div className="sidebar-folder-name">
              <span className="sidebar-folder-chev">▾</span>
              All hosts
              <span className="sidebar-folder-count">{uncategorized.length}</span>
            </div>
            {uncategorized.map((vm) => (
              <VmRow key={vm.id} vm={vm} onConnect={() => connect(vm)} onEdit={() => onEditVm(vm)} onDelete={() => remove(vm.id)} />
            ))}
          </div>
        )}
        {!hasAny && (
          <div className="sidebar-empty">
            <p>No saved hosts yet.</p>
            <p>Add one to get started.</p>
          </div>
        )}
      </div>

      <button className="sidebar-new" onClick={onNewVm}>
        <span className="sidebar-new-plus">+</span> New host
      </button>
    </aside>
  );
}

function VmRow({ vm, onConnect, onEdit, onDelete }: { vm: Vm; onConnect: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="vm-row" onDoubleClick={onConnect} title={`${vm.username}@${vm.host}:${vm.port}`}>
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
