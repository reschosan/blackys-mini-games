import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { NATURE_APPEARANCE } from '../../src/games/kart/maps/nature/settings';
import { NATURE } from '../../src/games/kart/maps/nature/map';
import { createBirdFlock } from '../../src/games/kart/maps/nature/view/birds';

const BIRDS = NATURE_APPEARANCE.birds;

/** Meshes of one species are ordered bodies, left wings, right wings. */
function bodyMeshes(flock: ReturnType<typeof createBirdFlock>): THREE.InstancedMesh[] {
  return (flock.object.children as THREE.InstancedMesh[]).filter((_, index) => index % 3 === 0);
}

function bodyPositions(flock: ReturnType<typeof createBirdFlock>): THREE.Vector3[] {
  return bodyMeshes(flock).flatMap((bodies) =>
    Array.from({ length: bodies.count }, (_, index) => {
      const matrix = new THREE.Matrix4();
      bodies.getMatrixAt(index, matrix);
      return new THREE.Vector3().setFromMatrixPosition(matrix);
    }),
  );
}

describe('nature bird flock', () => {
  it('draws each species with three instanced meshes (bodies and both wings)', () => {
    const flock = createBirdFlock(NATURE);
    expect(flock.object.children).toHaveLength(BIRDS.species.length * 3);
    expect(flock.object.children.every((child) => child instanceof THREE.InstancedMesh)).toBe(true);
    expect(bodyMeshes(flock).reduce((total, bodies) => total + bodies.count, 0)).toBe(BIRDS.flocks * BIRDS.birdsPerFlock);
  });

  it('gives every species its own natural colors, none of them identical', () => {
    const backs = BIRDS.species.map((species) => species.back);
    expect(new Set(backs).size).toBe(BIRDS.species.length);
  });

  it('flies: birds move over time and stay within the configured altitude', () => {
    const flock = createBirdFlock(NATURE);
    const before = bodyPositions(flock);
    for (let tick = 0; tick < 120; tick += 1) flock.animate(1 / 60);
    const after = bodyPositions(flock);

    expect(after.some((position, index) => position.distanceTo(before[index]!) > 1)).toBe(true);
    for (const position of after) {
      expect(Number.isFinite(position.x + position.y + position.z)).toBe(true);
      expect(position.y).toBeGreaterThan(BIRDS.altitudeMeters.min - 1);
      expect(position.y).toBeLessThan(BIRDS.altitudeMeters.max + BIRDS.birdsPerFlock + 1);
    }
  });

  it('is cosmetic only: it reads the map but never changes it', () => {
    const waypointsBefore = JSON.stringify(NATURE.waypoints);
    createBirdFlock(NATURE).animate(1);
    expect(JSON.stringify(NATURE.waypoints)).toBe(waypointsBefore);
  });
});
