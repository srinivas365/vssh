import { describe, expect, it } from 'vitest';
import { getUnlockTouchIdState } from '../../src/renderer/screens/Unlock';

describe('unlock Touch ID state', () => {
  it('shows Touch ID unlock after auto-lock when enabled and enrolled', () => {
    const state = getUnlockTouchIdState({
      vaultState: 'locked',
      touchIdEnabled: true,
      touchId: { supported: true, available: true, enrolled: true },
    });

    expect(state.showTouchId).toBe(true);
    expect(state.canEnrollTouchId).toBe(false);
  });

  it('does not offer Touch ID unlock while creating a vault', () => {
    const state = getUnlockTouchIdState({
      vaultState: 'empty',
      touchIdEnabled: true,
      touchId: { supported: true, available: true, enrolled: true },
    });

    expect(state.showTouchId).toBe(false);
  });
});
