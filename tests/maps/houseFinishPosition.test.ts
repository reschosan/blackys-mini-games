import { describe, expect, it } from 'vitest';
import { FAMILY_HOUSE } from '../../src/games/kart/maps/familyHouse/map';
import { RING_TEST_MAP } from '../support/ringTestMap';
import { createProgress, updateProgress } from '../../src/games/kart/race/raceState';

const area = FAMILY_HOUSE.finishArea!.rect;

describe('house positional finish', () => {
  it('finishes while stationary in the goal even when earlier gates were missed', () => {
    const progress = createProgress(area.x, area.z, 'second');
    updateProgress(FAMILY_HOUSE, 1, progress, area.x, area.z, 120, 'second');
    expect(progress).toMatchObject({
      finished: true,
      lap: 1,
      finishTimeSeconds: 120,
      nextCheckpoint: FAMILY_HOUSE.checkpoints.length - 1,
      checkpointsPassed: 1,
    });
  });

  it.each(['ground', 'first'])('does not finish at the same coordinates on %s', (levelId) => {
    const progress = createProgress(area.x, area.z, levelId);
    updateProgress(FAMILY_HOUSE, 1, progress, area.x, area.z, 120, levelId);
    expect(progress.finished).toBe(false);
  });

  it.each([-1, 1])('finishes when entering from either direction (%s)', (direction) => {
    const progress = createProgress(area.x + direction * 10, area.z, 'second');
    updateProgress(FAMILY_HOUSE, 1, progress, area.x + direction, area.z, 120, 'second');
    expect(progress.finished).toBe(true);
  });

  it('does not finish outside the goal and includes its boundary', () => {
    const x = area.x + area.width / 2;
    const progress = createProgress(x + 0.01, area.z, 'second');
    updateProgress(FAMILY_HOUSE, 1, progress, x + 0.01, area.z, 120, 'second');
    expect(progress.finished).toBe(false);
    updateProgress(FAMILY_HOUSE, 1, progress, x, area.z, 121, 'second');
    expect(progress.finished).toBe(true);
  });

  it('keeps the original finish time on later ticks', () => {
    const progress = createProgress(area.x, area.z, 'second');
    updateProgress(FAMILY_HOUSE, 1, progress, area.x, area.z, 120, 'second');
    updateProgress(FAMILY_HOUSE, 1, progress, area.x, area.z, 150, 'second');
    expect(progress.finishTimeSeconds).toBe(120);
  });

  it('leaves circuit maps gated by their normal lap rules', () => {
    const progress = createProgress(area.x, area.z);
    updateProgress(RING_TEST_MAP, 3, progress, area.x, area.z, 120);
    expect(progress.finished).toBe(false);
  });
});
