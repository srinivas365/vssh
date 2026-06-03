import React, { useEffect, useState } from 'react';
import type { RemoteEntry } from '@shared/types';

interface Props {
  vmId: number;
  select: 'file-or-folder' | 'folder';
  onCancel: () => void;
  onSelect: (entry: RemoteEntry) => void;
}

export function RemoteBrowserModal({ vmId, select, onCancel, onSelect }: Props) {
  const [directory, setDirectory] = useState('/');
  const [entries, setEntries] = useState<RemoteEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.api.transfer.remoteList(vmId, directory)
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [vmId, directory]);

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-card-wide">
        <h2>Remote browser</h2>
        <p>{directory}</p>
        {error && <p className="error-text">{error}</p>}
        <div className="remote-list">
          {directory !== '/' && <button onClick={() => setDirectory(directory.replace(/\/[^/]+\/?$/, '') || '/')}>..</button>}
          {entries.map((entry) => (
            <button key={entry.path} onDoubleClick={() => entry.type === 'directory' ? setDirectory(entry.path) : undefined} onClick={() => {
              if (select === 'folder' && entry.type !== 'directory') return;
              onSelect(entry);
            }}>
              {entry.type === 'directory' ? '📁' : '📄'} {entry.name}
            </button>
          ))}
        </div>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
