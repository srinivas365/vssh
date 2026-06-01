import React, { useEffect } from 'react';
import { useVaultStore } from './state/vault-store';
import { Unlock } from './screens/Unlock';
import { Main } from './screens/Main';

export function App() {
  const state = useVaultStore((s) => s.state);
  const refresh = useVaultStore((s) => s.refresh);

  useEffect(() => {
    refresh();
    window.api.vault.onStateChanged(() => { void refresh(); });
  }, [refresh]);

  if (state === 'unknown') return null;
  if (state !== 'unlocked') return <Unlock />;
  return <Main />;
}
