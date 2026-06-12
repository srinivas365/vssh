import React from 'react';
import type { UpdateCheckResult } from '@shared/types';
import { dismissUpdate } from '../../updates-dismiss';
import '../VmEditForm/VmEditForm.css';
import './UpdateAvailableModal.css';

type AvailableUpdate = Extract<UpdateCheckResult, { status: 'available' }>;

interface Props {
  update: AvailableUpdate;
  onClose: () => void;
}

export function UpdateAvailableModal({ update, onClose }: Props) {
  function handleLater() {
    dismissUpdate(update.latestVersion);
    onClose();
  }

  function handleDownload() {
    void window.api.shell.openExternal(update.releaseUrl);
  }

  return (
    <div className="modal-backdrop" onClick={handleLater}>
      <div
        className="update-modal"
        role="dialog"
        aria-labelledby="update-modal-title"
        onClick={(e) => e.stopPropagation()}>
        <h2 id="update-modal-title">Update available — v{update.latestVersion}</h2>
        <p className="update-modal-sub">
          You are on v{update.currentVersion}. Download the latest release from GitHub.
        </p>
        <pre className="update-modal-notes">{update.releaseNotes}</pre>
        <div className="update-modal-actions">
          <button type="button" className="update-modal-later" onClick={handleLater}>
            Later
          </button>
          <button type="button" className="update-modal-download" onClick={handleDownload}>
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
