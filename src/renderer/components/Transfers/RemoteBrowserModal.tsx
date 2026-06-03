import React, { useEffect, useState } from 'react';
import type { RemoteEntry } from '@shared/types';
import './RemoteBrowserModal.css';

interface Props {
  vmId: number;
  select: 'file-or-folder' | 'folder';
  onCancel: () => void;
  onSelect: (entry: RemoteEntry) => void;
}

function buildBreadcrumbs(path: string): { label: string; path: string }[] {
  const parts = path.split('/').filter(Boolean);
  const crumbs: { label: string; path: string }[] = [{ label: '/', path: '/' }];
  for (let i = 0; i < parts.length; i++) {
    crumbs.push({ label: parts[i], path: '/' + parts.slice(0, i + 1).join('/') });
  }
  return crumbs;
}

function currentFolderName(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? '/';
}

export function RemoteBrowserModal({ vmId, select, onCancel, onSelect }: Props) {
  const [directory, setDirectory] = useState('/');
  const [entries, setEntries] = useState<RemoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    window.api.transfer.remoteList(vmId, directory)
      .then((list) => { setEntries(list); setLoading(false); })
      .catch((err) => { setError(err instanceof Error ? err.message : String(err)); setLoading(false); });
  }, [vmId, directory]);

  function navigate(path: string) {
    setDirectory(path);
  }

  function selectCurrentFolder() {
    const name = currentFolderName(directory);
    onSelect({ name, path: directory, type: 'directory', sizeBytes: null, modifiedAt: null });
  }

  function handleEntryClick(entry: RemoteEntry) {
    if (entry.type === 'directory') {
      navigate(entry.path);
    } else if (select === 'file-or-folder') {
      onSelect(entry);
    }
  }

  const breadcrumbs = buildBreadcrumbs(directory);
  const folderLabel = currentFolderName(directory);

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="rbm-panel">
        <div className="rbm-header">
          <div className="rbm-title">
            <span className="rbm-title-icon">⊟</span>
            <span>{select === 'folder' ? 'Choose destination folder' : 'Choose file or folder'}</span>
          </div>
          <button className="rbm-close" onClick={onCancel} title="Cancel">✕</button>
        </div>

        <div className="rbm-breadcrumb">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={crumb.path}>
              {i > 0 && <span className="rbm-sep">›</span>}
              <button
                className={`rbm-crumb ${i === breadcrumbs.length - 1 ? 'rbm-crumb-active' : ''}`}
                onClick={() => navigate(crumb.path)}
                title={crumb.path}
              >
                {crumb.label}
              </button>
            </React.Fragment>
          ))}
        </div>

        {error && <div className="rbm-error">⚠ {error}</div>}

        <div className="rbm-list">
          {loading && (
            <div className="rbm-placeholder">Loading…</div>
          )}
          {!loading && entries.length === 0 && (
            <div className="rbm-placeholder">Empty folder</div>
          )}
          {!loading && entries.map((entry) => {
            const isDir = entry.type === 'directory';
            const clickable = isDir || select === 'file-or-folder';
            return (
              <button
                key={entry.path}
                className={`rbm-entry ${isDir ? 'rbm-entry-dir' : 'rbm-entry-file'} ${!clickable ? 'rbm-entry-disabled' : ''}`}
                onClick={() => clickable && handleEntryClick(entry)}
                disabled={!clickable}
                title={entry.path}
              >
                <span className="rbm-entry-icon">{isDir ? '📁' : '📄'}</span>
                <span className="rbm-entry-name">{entry.name}</span>
                {isDir && <span className="rbm-entry-arrow">›</span>}
              </button>
            );
          })}
        </div>

        <div className="rbm-footer">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={selectCurrentFolder}>
            Select "{folderLabel}"
          </button>
        </div>
      </div>
    </div>
  );
}
