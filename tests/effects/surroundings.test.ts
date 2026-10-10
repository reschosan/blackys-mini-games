import { describe, expect, it } from 'vitest';
import { sceneryPieceCentre, type SceneryArea } from '../../src/shared/effects/surroundings';

const FIELD: SceneryArea = { halfWidth: 65, halfDepth: 38, centreX: 0, centreZ: 0, reach: 70, count: 30 };

describe('surroundings', () => {
  it('keeps every piece clear of the play area, whichever way it is turned', () => {
    const longest = 22;
    for (let step = 0; step < 72; step += 1) {
      const [x, z] = sceneryPieceCentre(FIELD, (step / 72) * Math.PI * 2, longest, 0);
      const outsideX = Math.abs(x) - FIELD.halfWidth;
      const outsideZ = Math.abs(z) - FIELD.halfDepth;
      expect(Math.max(outsideX, outsideZ)).toBeGreaterThan(longest * Math.SQRT1_2);
    }
  });
});
