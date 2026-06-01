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

  return (
    <aside className="sidebar">
      <input
        className="sidebar-search"
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {folders.map((f) => (
        <div key={f.id} className="sidebar-folder">
          <div className="sidebar-folder-name">▼ {f.name}</div>
          {(grouped.get(f.id) ?? []).map((vm) => (
            <VmRow key={vm.id} vm={vm} onConnect={() => connect(vm)} onEdit={() => onEditVm(vm)} onDelete={() => remove(vm.id)} />
          ))}
        </div>
      ))}
      {(grouped.get(null) ?? []).length > 0 && (
        <div className="sidebar-folder">
          <div className="sidebar-folder-name">▼ Uncategorized</div>
          {(grouped.get(null) ?? []).map((vm) => (
            <VmRow key={vm.id} vm={vm} onConnect={() => connect(vm)} onEdit={() => onEditVm(vm)} onDelete={() => remove(vm.id)} />
          ))}
        </div>
      )}
      <button className="sidebar-new" onClick={onNewVm}>+ New VM</button>
    </aside>
  );
}

function VmRow({ vm, onConnect, onEdit, onDelete }: { vm: Vm; onConnect: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="vm-row" onDoubleClick={onConnect}>
      <span className="vm-label">{vm.label}</span>
      <span className="vm-actions">
        <button onClick={onConnect} title="Connect">▶</button>
        <button onClick={onEdit} title="Edit">✎</button>
        <button onClick={onDelete} title="Delete">✕</button>
      </span>
    </div>
  );
}
