import { describe, expect, it } from 'vitest';
import { canPause, canResume, canStop, partialsKeptForOutcome } from '../../src/main/transfer/state-machine';

describe('transfer state machine', () => {
  it('allows pause only while running', () => {
    expect(canPause('running')).toBe(true);
    expect(canPause('preparing')).toBe(false);
    expect(canPause('paused')).toBe(false);
  });

  it('allows resume from paused or failed transfers with kept partials', () => {
    expect(canResume('paused', true)).toBe(true);
    expect(canResume('failed', true)).toBe(true);
    expect(canResume('failed', false)).toBe(false);
    expect(canResume('stopped', true)).toBe(false);
  });

  it('allows stop while preparing, running, or paused', () => {
    expect(canStop('preparing')).toBe(true);
    expect(canStop('running')).toBe(true);
    expect(canStop('paused')).toBe(true);
    expect(canStop('succeeded')).toBe(false);
  });

  it('keeps partials for pause and failure but deletes them for stop', () => {
    expect(partialsKeptForOutcome('pause')).toBe(true);
    expect(partialsKeptForOutcome('failure')).toBe(true);
    expect(partialsKeptForOutcome('stop')).toBe(false);
  });
});
