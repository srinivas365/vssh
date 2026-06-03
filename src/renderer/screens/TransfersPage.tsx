import React from 'react';
import { Download, PauseCircle, PlayCircle, Server, StopCircle, Upload } from 'lucide-react';
import { useTransfersStore } from '../state/transfers-store';
import './TransfersPage.css';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function progressLabel(transferredBytes: number, percent: number | null): string {
  if (percent != null) return `${percent.toFixed(0)}%`;
  return formatBytes(transferredBytes);
}

export function TransfersPage() {
  const { transfers, logs } = useTransfersStore();

  return (
    <div className="transfers-page">
      <header className="transfers-header">
        <h1>Transfers</h1>
        <p>{transfers.length} current-session transfer{transfers.length === 1 ? '' : 's'}</p>
      </header>
      {transfers.length === 0 ? (
        <div className="transfers-empty">Start an upload or download from a host.</div>
      ) : (
        <div className="transfers-list">
          {transfers.map((transfer) => (
            <section className="transfer-card" key={transfer.id}>
              <div className="transfer-card-head">
                <div className="transfer-card-vm">
                  <div className="transfer-vm-icon">
                    <Server size={16} />
                  </div>
                  <div className="transfer-vm-info">
                    <div className="transfer-vm-label">{transfer.vmLabel}</div>
                    <div className="transfer-vm-host">{transfer.vmHost}</div>
                  </div>
                </div>
                <div className="transfer-card-badges">
                  <span className="transfer-badge-engine">{transfer.engine}</span>
                  <span className={`transfer-badge-status transfer-badge-${transfer.status}`}>{transfer.status}</span>
                </div>
              </div>
              <div className="transfer-file-row">
                <span className="transfer-direction-icon">
                  {transfer.direction === 'upload' ? <Upload size={12} /> : <Download size={12} />}
                </span>
                <span className="transfer-filename">{transfer.source.name}</span>
              </div>
              <div className="transfer-sub">{transfer.source.path} → {transfer.destination.finalPath}</div>
              <div className="transfer-progress-row">
                <progress value={transfer.percent ?? 0} max={100} />
                <span>{progressLabel(transfer.transferredBytes, transfer.percent)}</span>
              </div>
              <div className="transfer-actions">
                <button
                  className="transfer-action-btn"
                  disabled={transfer.status !== 'running'}
                  onClick={() => void window.api.transfer.pause(transfer.id)}
                  title="Pause"
                >
                  <PauseCircle size={14} />
                </button>
                <button
                  className="transfer-action-btn"
                  disabled={!['paused', 'failed'].includes(transfer.status)}
                  onClick={() => void window.api.transfer.resume(transfer.id)}
                  title="Resume"
                >
                  <PlayCircle size={14} />
                </button>
                <button
                  className="transfer-action-btn"
                  disabled={!['preparing', 'running', 'paused'].includes(transfer.status)}
                  onClick={() => void window.api.transfer.stop(transfer.id)}
                  title="Stop"
                >
                  <StopCircle size={14} />
                </button>
              </div>
              {(logs[transfer.id] ?? []).length > 0 && (
                <details className="transfer-logs">
                  <summary>Details</summary>
                  {(logs[transfer.id] ?? []).map((line, index) => <pre key={index}>{line.line}</pre>)}
                </details>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
