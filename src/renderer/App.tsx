import React, { useEffect, useRef } from 'react';
import { useVaultStore } from './state/vault-store';
import { useSettingsStore } from './state/settings-store';
import { useUpdatesStore } from './state/updates-store';
import { UpdateAvailableModal } from './components/UpdateAvailableModal/UpdateAvailableModal';
import { isUpdateDismissed } from './updates-dismiss';
import { Unlock } from './screens/Unlock';
import { Main } from './screens/Main';

export function App() {
  const state = useVaultStore((s) => s.state);
  const refresh = useVaultStore((s) => s.refresh);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const available = useUpdatesStore((s) => s.available);
  const showAvailable = useUpdatesStore((s) => s.showAvailable);
  const clearAvailable = useUpdatesStore((s) => s.clearAvailable);
  const startupCheckDone = useRef(false);

  useEffect(() => {
    refresh();
    window.api.vault.onStateChanged(() => { void refresh(); });
  }, [refresh]);

  useEffect(() => {
    void hydrateSettings();
  }, [hydrateSettings]);

  useEffect(() => {
    if (state !== 'unlocked' || startupCheckDone.current) return;
    startupCheckDone.current = true;

    void window.api.updates.check().then((result) => {
      if (result.status === 'available' && !isUpdateDismissed(result.latestVersion)) {
        showAvailable(result);
      }
    });
  }, [state, showAvailable]);

  if (state === 'unknown') return null;
  if (state !== 'unlocked') return <Unlock />;

  return (
    <>
      <Main />
      {available && (
        <UpdateAvailableModal update={available} onClose={clearAvailable} />
      )}
    </>
  );
}
