import React from 'react';
import type { FolderCopyMode } from '@shared/types';

export function FolderModeModal({ onChoose }: { onChoose: (mode: FolderCopyMode) => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2>Copy folder</h2>
        <p>Choose how this folder should be copied.</p>
        <button className="btn btn-primary" onClick={() => onChoose('as-is')}>Copy folder as-is</button>
        <button className="btn" onClick={() => onChoose('contents-only')}>Copy contents only</button>
      </div>
    </div>
  );
}
