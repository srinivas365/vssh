import React, { useState, useRef, useEffect } from 'react';
import { useVmsStore } from '../../state/vms-store';

export function NewWorkspaceButton() {
  const [editing, setEditing] = useState(false);
  const createFolder = useVmsStore((s) => s.createFolder);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  async function commit(value: string) {
    const trimmed = value.trim();
    if (trimmed) await createFolder(trimmed);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={ref}
        className="ws-rename-input"
        placeholder="New workspace name"
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
          else if (e.key === 'Escape') setEditing(false);
        }}
        style={{ width: '100%', margin: '8px 0', padding: '7px 10px', boxSizing: 'border-box' }}
      />
    );
  }

  return (
    <button className="sidebar-new" onClick={() => setEditing(true)}>
      <span className="sidebar-new-plus">+</span> New workspace
    </button>
  );
}
