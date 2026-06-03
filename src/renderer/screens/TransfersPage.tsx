import React from 'react';
import { useTransfersStore } from '../state/transfers-store';
import './TransfersPage.css';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
              <div className="transfer-card-main">
                <div>
                  <div className="transfer-title">{transfer.direction} · {transfer.source.name}</div>
                  <div className="transfer-sub">{transfer.source.path} → {transfer.destination.finalPath}</div>
                </div>
                <div className="transfer-badges">
                  <span>{transfer.engine}</span>
                  <span>{transfer.status}</span>
                </div>
              </div>
              <div className="transfer-progress-row">
                <progress value={transfer.percent ?? 0} max={100} />
                <span>{transfer.percent == null ? formatBytes(transfer.transferredBytes) : `${transfer.percent.toFixed(0)}%`}</span>
              </div>
              <div className="transfer-actions">
                <button disabled={transfer.status !== 'running'} onClick={() => void window.api.transfer.pause(transfer.id)}>Pause</button>
                <button disabled={!['paused', 'failed'].includes(transfer.status)} onClick={() => void window.api.transfer.resume(transfer.id)}>Resume</button>
                <button disabled={!['preparing', 'running', 'paused'].includes(transfer.status)} onClick={() => void window.api.transfer.stop(transfer.id)}>Stop</button>
                <button disabled={!transfer.partialsKept} onClick={() => void window.api.transfer.deletePartials(transfer.id)}>Delete partials</button>
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
