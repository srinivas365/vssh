import { Vm } from '@shared/types';
import type { Tab } from './state/sessions-store';

type AddTab = (tab: Tab) => void;
type ReplaceTabSession = (oldSessionId: string, newSessionId: string) => void;

export async function connectVm(vm: Vm, addTab: AddTab, onSuccess?: () => void): Promise<void> {
  try {
    const sessionId = await window.api.session.start(vm.id, 80, 24);
    addTab({ sessionId, vmId: vm.id, label: vm.label, state: 'connecting' });
    onSuccess?.();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Surface connection startup failures (for example missing ssh on Windows)
    // instead of silently ignoring rejected session start promises.
    window.alert(`Failed to connect to ${vm.label} (${vm.username}@${vm.host}:${vm.port}).\n\n${message}`);
  }
}

export async function reconnectTab(tab: Tab, replaceTabSession: ReplaceTabSession): Promise<void> {
  try {
    const sessionId = tab.vmId !== null
      ? await window.api.session.start(tab.vmId, 80, 24)
      : await window.api.session.startLocal(80, 24);
    replaceTabSession(tab.sessionId, sessionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const target = tab.vmId !== null ? tab.label : 'local terminal';
    window.alert(`Failed to reconnect to ${target}.\n\n${message}`);
  }
}
