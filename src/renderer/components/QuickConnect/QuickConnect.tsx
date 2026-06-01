import React, { useEffect, useMemo, useState } from 'react';
import { useVmsStore } from '../../state/vms-store';
import { useSessionsStore } from '../../state/sessions-store';
import './QuickConnect.css';

interface Props { onClose: () => void; }

export function QuickConnect({ onClose }: Props) {
  const vms = useVmsStore((s) => s.vms);
  const addTab = useSessionsStore((s) => s.addTab);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vms
      .filter((v) => !q || v.label.toLowerCase().includes(q) || v.host.toLowerCase().includes(q))
      .slice(0, 10);
  }, [vms, query]);

  async function connect(idx: number) {
    const vm = matches[idx];
    if (!vm) return;
    const sessionId = await window.api.session.start(vm.id, 80, 24);
    addTab({ sessionId, vmId: vm.id, label: vm.label, state: 'connecting' });
    onClose();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') setHighlight((h) => Math.min(h + 1, matches.length - 1));
    else if (e.key === 'ArrowUp') setHighlight((h) => Math.max(h - 1, 0));
    else if (e.key === 'Enter') void connect(highlight);
  }

  return (
    <div className="qc-backdrop" onClick={onClose}>
      <div className="qc-panel" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          placeholder="Search VMs…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
          onKeyDown={onKey}
        />
        <ul>
          {matches.map((vm, i) => (
            <li key={vm.id} className={i === highlight ? 'highlight' : ''} onClick={() => connect(i)}>
              {vm.label} <span className="qc-host">{vm.username}@{vm.host}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
