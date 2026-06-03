import React, { useEffect, useState } from 'react';
import type { TransferDirection, Vm } from '@shared/types';

interface Props {
  vm: Vm;
  direction: TransferDirection;
  onClose: () => void;
}

export function TransferWizard({ vm, direction, onClose }: Props) {
  const [message, setMessage] = useState('Preparing transfer…');

  useEffect(() => {
    async function run() {
      if (direction === 'upload') {
        const source = await window.api.transfer.pickUploadSource();
        setMessage(source ? `Selected ${source.name}. Continue to choose the remote destination.` : 'Upload cancelled.');
      } else {
        setMessage(`Choose a remote source from ${vm.label}.`);
      }
    }
    void run();
  }, [direction, vm.label]);

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2>{direction === 'upload' ? 'Upload' : 'Download'} · {vm.label}</h2>
        <p>{message}</p>
        <button className="btn btn-primary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
