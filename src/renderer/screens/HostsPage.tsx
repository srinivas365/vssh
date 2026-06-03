import React, { useEffect, useMemo, useState } from 'react';
import { Download, Pencil, Search, Server, Trash2, Upload } from 'lucide-react';
import { useVmsStore } from '../state/vms-store';
import { useSessionsStore } from '../state/sessions-store';
import { Vm } from '@shared/types';
import './HostsPage.css';

interface Props {
  onNewVm: () => void;
  onEditVm: (vm: Vm) => void;
  onUploadVm: (vm: Vm) => void;
  onDownloadVm: (vm: Vm) => void;
}

export function HostsPage({ onNewVm, onEditVm, onUploadVm, onDownloadVm }: Props) {
  const { vms, folders, refresh, remove } = useVmsStore();
  const addTab = useSessionsStore((s) => s.addTab);
  const [query, setQuery] = useState('');
  const [folderId, setFolderId] = useState<number | 'all'>('all');

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vms.filter((v) => {
      if (folderId !== 'all' && v.folderId !== folderId) return false;
      if (!q) return true;
      return v.label.toLowerCase().includes(q) ||
             v.host.toLowerCase().includes(q) ||
             v.username.toLowerCase().includes(q);
    });
  }, [vms, query, folderId]);

  async function connect(vm: Vm) {
    const sessionId = await window.api.session.start(vm.id, 80, 24);
    addTab({ sessionId, vmId: vm.id, label: vm.label, state: 'connecting' });
  }

  const recent = useMemo(
    () => [...filtered].filter(v => v.lastUsedAt).sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)).slice(0, 4),
    [filtered]
  );

  return (
    <div className="hosts-page">
      <header className="hosts-header">
        <div>
          <h1 className="hosts-title">Hosts</h1>
          <p className="hosts-sub">{vms.length} saved · double-click or hit ▶ to connect</p>
        </div>
        <div className="hosts-header-actions">
          <div className="hosts-search-wrap">
            <span className="hosts-search-icon"><Search size={14} /></span>
            <input
              className="hosts-search"
              placeholder="Search hosts, IPs, users…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={onNewVm}>+ New host</button>
        </div>
      </header>

      {folders.length > 0 && (
        <div className="hosts-chips">
          <button
            className={`chip ${folderId === 'all' ? 'chip-active' : ''}`}
            onClick={() => setFolderId('all')}>
            All workspaces <span className="chip-count">{vms.length}</span>
          </button>
          {folders.map((f) => {
            const count = vms.filter((v) => v.folderId === f.id).length;
            return (
              <button
                key={f.id}
                className={`chip ${folderId === f.id ? 'chip-active' : ''}`}
                onClick={() => setFolderId(f.id)}>
                {f.name} <span className="chip-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {recent.length > 0 && query === '' && folderId === 'all' && (
        <section className="hosts-section">
          <h2 className="hosts-section-title">Recent</h2>
          <div className="hosts-grid">
            {recent.map((vm) => (
              <HostCard key={`recent-${vm.id}`} vm={vm}
                onConnect={() => connect(vm)} onEdit={() => onEditVm(vm)} onDelete={() => remove(vm.id)} onUpload={() => onUploadVm(vm)} onDownload={() => onDownloadVm(vm)} />
            ))}
          </div>
        </section>
      )}

      <section className="hosts-section">
        <h2 className="hosts-section-title">All hosts</h2>
        {filtered.length === 0 ? (
          <div className="hosts-empty">
            {vms.length === 0 ? (
              <>
                <div className="hosts-empty-icon"><Server size={26} /></div>
                <h3>No hosts yet</h3>
                <p>Add your first host to get started.</p>
                <button className="btn btn-primary" onClick={onNewVm}>+ New host</button>
              </>
            ) : (
              <p>No hosts match your search.</p>
            )}
          </div>
        ) : (
          <div className="hosts-grid">
            {filtered.map((vm) => (
              <HostCard key={vm.id} vm={vm}
                onConnect={() => connect(vm)} onEdit={() => onEditVm(vm)} onDelete={() => remove(vm.id)} onUpload={() => onUploadVm(vm)} onDownload={() => onDownloadVm(vm)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HostCard({ vm, onConnect, onEdit, onDelete, onUpload, onDownload }: {
  vm: Vm;
  onConnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpload: () => void;
  onDownload: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const authBadge =
    vm.authMethod === 'password' ? 'Password' :
    vm.authMethod === 'key' ? 'Key' : 'Key + password';

  return (
    <>
    <div className="host-card" onDoubleClick={onConnect}>
      <div className="host-card-head">
        <div className="host-card-icon"><Server size={18} /></div>
        <div className="host-card-id">
          <div className="host-card-label">{vm.label}</div>
          <div className="host-card-host">{vm.username}@{vm.host}:{vm.port}</div>
        </div>
      </div>
      <div className="host-card-meta">
        <span className="host-badge">{authBadge}</span>
        {vm.lastUsedAt && <span className="host-meta-time">{relTime(vm.lastUsedAt)}</span>}
      </div>
      <div className="host-card-actions">
        <button className="btn btn-primary host-card-connect" onClick={onConnect}>Connect</button>
        <button className="host-card-icon-btn" onClick={onUpload} title="Upload"><Upload size={14} /></button>
        <button className="host-card-icon-btn" onClick={onDownload} title="Download"><Download size={14} /></button>
        <button className="host-card-icon-btn" onClick={onEdit} title="Edit"><Pencil size={14} /></button>
        <button className="host-card-icon-btn" onClick={() => setConfirmDelete(true)} title="Delete"><Trash2 size={14} /></button>
      </div>
    </div>
    {confirmDelete && (
      <div className="modal-backdrop">
        <div className="modal-card">
          <h2>Delete "{vm.label}"?</h2>
          <div className="modal-actions">
            <button className="btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={onDelete}>Delete</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}
