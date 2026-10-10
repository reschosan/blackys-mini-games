import { describe, expect, it } from 'vitest';
import { aiGuideLine } from '../../src/games/kart/ai/aiGuideLine';
import { AVAILABLE_MAPS } from '../../src/games/kart/maps/registry';
import { FAMILY_HOUSE } from '../../src/games/kart/maps/familyHouse/map';
import { KART_WALL_COLLIDER_RADIUS } from '../../src/shared/config/kart';
import { circleVsAabb, rectToAabb } from '../../src/games/kart/maps/shared/collision';
import { collidableRects, isOnRouteSurface } from '../../src/games/kart/maps/shared/surface';

function crosses(a: readonly number[], b: readonly number[]): boolean {
  const side = (x: number, z: number, line: readonly number[]) => (line[2]! - line[0]!) * (z - line[1]!) - (line[3]! - line[1]!) * (x - line[0]!);
  return side(a[0]!, a[1]!, b) * side(a[2]!, a[3]!, b) < -0.0001 && side(b[0]!, b[1]!, a) * side(b[2]!, b[3]!, a) < -0.0001;
}

describe('AI guide lines', () => {
  it('keeps every house guide segment clear of architecture', () => {
    for (let slot = 0; slot < 4; slot += 1) {
      const points = aiGuideLine(FAMILY_HOUSE, slot).points;
      for (let index = 1; index < points.length; index += 1) {
        const from = points[index - 1]!;
        const to = points[index]!;
        if (from.levelId !== to.levelId) continue;
        const obstacles = collidableRects(FAMILY_HOUSE, from.levelId).map(rectToAabb);
        const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 2);
        for (let step = 0; step <= steps; step += 1) {
          const x = from.x + ((to.x - from.x) * step) / steps;
          const z = from.z + ((to.z - from.z) * step) / steps;
          expect(isOnRouteSurface(FAMILY_HOUSE, x, z, from.levelId), `slot ${slot} segment ${index}`).toBe(true);
          expect(
            obstacles.some((obstacle) => circleVsAabb(x, z, KART_WALL_COLLIDER_RADIUS, obstacle)),
            `slot ${slot} segment ${index} at ${x}/${z} ${JSON.stringify([from, to])}`,
          ).toBe(false);
        }
      }
    }
  });
  it.each(AVAILABLE_MAPS)('$name gives each kart a distinct non-crossing line', (map) => {
    const lines = [0, 1, 2, 3].map((slot) => aiGuideLine(map, slot));
    for (let slot = 0; slot < lines.length; slot += 1) {
      const points = lines[slot]!.points;
      const segmentCount = points.length - (map.raceFormat === 'pointToPoint' ? 1 : 0);
      expect(points.length).toBeGreaterThan(2);
      for (let other = slot + 1; other < lines.length; other += 1) {
        expect(lines[other]!.points[0]).not.toEqual(points[0]);
        for (let index = 0; index < segmentCount; index += 1) {
          const from = points[index]!;
          const to = points[(index + 1) % points.length]!;
          for (let next = 0; next < segmentCount; next += 1) {
            const otherFrom = lines[other]!.points[next]!;
            const otherTo = lines[other]!.points[(next + 1) % points.length]!;
            if (from.levelId !== otherFrom.levelId) continue;
            expect(
              crosses([from.x, from.z, to.x, to.z], [otherFrom.x, otherFrom.z, otherTo.x, otherTo.z]),
              `${map.name} slots ${slot}/${other} segments ${index}/${next}: ${JSON.stringify([from, to, otherFrom, otherTo])}`,
            ).toBe(false);
          }
        }
      }
    }
  });

  it.each(AVAILABLE_MAPS)('$name spaces lanes according to available map width', (map) => {
    const left = aiGuideLine(map, 1).points;
    const right = aiGuideLine(map, 2).points;
    const distances = left.map((point, index) => Math.hypot(point.x - right[index]!.x, point.z - right[index]!.z));

    expect(Math.min(...distances)).toBeGreaterThanOrEqual((map.aiGuideSpacing?.minimum ?? 2) - 1e-6);
    expect(Math.max(...distances)).toBeGreaterThan(map.levels ? 1 : 2);
  });
});
