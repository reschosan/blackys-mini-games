import { describe, expect, it } from 'vitest';
import { runNetworkRace } from '../support/networkRace';

/** Steer right for a second, left for a second, straight for a second; the first turn starts at one second. */
const weave = (seconds: number): number => {
  if (seconds < 1) return 0;
  const phase = Math.floor((seconds - 1) / 1) % 3;
  return phase === 0 ? 1 : phase === 1 ? -1 : 0;
};

const WIFI = { latencyMilliseconds: 25, jitterMilliseconds: 10, loss: 0.02, seconds: 12, steer: weave } as const;

describe('steering over the network', () => {
  it('answers the first touch within two frames with prediction, but only after the round trip without', () => {
    const predicted = runNetworkRace({ ...WIFI, predict: true });
    const plain = runNetworkRace({ ...WIFI, predict: false });
    expect(predicted.responseMilliseconds).not.toBeNull();
    expect(predicted.responseMilliseconds!).toBeLessThanOrEqual(120);
    expect(plain.responseMilliseconds!).toBeGreaterThan(predicted.responseMilliseconds! * 2);
  });

  it('keeps the shown kart close to where the host puts it', () => {
    const result = runNetworkRace({ ...WIFI, predict: true });
    expect(result.meanErrorMeters).toBeLessThan(0.5);
    expect(result.worstErrorMeters).toBeLessThan(2);
  });

  it('does not make the picture jump when the correction is small', () => {
    const result = runNetworkRace({ ...WIFI, predict: true });
    expect(result.snaps).toBe(0);
    expect(result.worstJumpMeters).toBeLessThan(0.6);
  });

  it('holds up on a bad connection with a lot of lag and loss', () => {
    const result = runNetworkRace({ latencyMilliseconds: 90, jitterMilliseconds: 40, loss: 0.1, seconds: 12, steer: weave, predict: true });
    expect(result.meanErrorMeters).toBeLessThan(1.5);
    expect(result.worstJumpMeters).toBeLessThan(1.5);
  });

  it('fits one snapshot into a single network packet', () => {
    expect(runNetworkRace({ ...WIFI, predict: true }).snapshotBytes).toBeLessThan(1200);
  });
});

describe('steering while another kart bumps into the own one', () => {
  it('stays close to the host and does not lurch much', () => {
    const result = runNetworkRace({ ...WIFI, seconds: 14, steer: (seconds) => weave(seconds) * 0.3, predict: true, rival: true });
    expect(result.meanErrorMeters).toBeLessThan(0.3);
    expect(result.lurches).toBeLessThan(10);
  });
});
