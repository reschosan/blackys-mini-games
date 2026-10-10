import { describe, expect, it } from 'vitest';
import { LoadingGate } from '../../src/shared/ui/loadingGate';

const TIPS = ['A', 'B', 'C'];

describe('LoadingGate', () => {
  it('stays hidden for short waits so quick loads never flash the screen', () => {
    const gate = new LoadingGate(() => TIPS, 0.25, 4);
    gate.update(true, 0.2);
    expect(gate.visible).toBe(false);
    gate.update(false, 0.1);
    gate.update(true, 0.2);
    expect(gate.visible).toBe(false);
  });

  it('shows once the wait exceeds the delay and hides again when loading is done', () => {
    const gate = new LoadingGate(() => TIPS, 0.25, 4);
    gate.update(true, 0.3);
    expect(gate.visible).toBe(true);
    gate.update(false, 1 / 60);
    expect(gate.visible).toBe(false);
  });

  it('rotates through the tips only while visible, wrapping around', () => {
    const gate = new LoadingGate(() => TIPS, 0.25, 4);
    gate.update(true, 0.3);
    expect(gate.tip).toBe('A');
    gate.update(true, 4);
    expect(gate.tip).toBe('B');
    gate.update(true, 4);
    gate.update(true, 4);
    expect(gate.tip).toBe('A');
  });

  it('starts at the given first tip and survives an empty tip list', () => {
    expect(new LoadingGate(() => TIPS, 0.25, 4, 5).tip).toBe('C');
    const empty = new LoadingGate(() => [], 0.25, 4);
    empty.update(true, 10);
    expect(empty.tip).toBe('');
  });
});
