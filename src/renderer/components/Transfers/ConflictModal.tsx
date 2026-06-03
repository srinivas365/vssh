import React from 'react';

export function ConflictModal({ path, onOverwrite, onCancel }: { path: string; onOverwrite: () => void; onCancel: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2>Destination exists</h2>
        <p>{path} already exists.</p>
        <button className="btn btn-primary" onClick={onOverwrite}>Overwrite / merge</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
