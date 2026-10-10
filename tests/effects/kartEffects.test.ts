import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KartEffects } from '../../src/shared/effects/kartEffects';

describe('nitro exhaust feedback', () => {
  it('renders two visible exhaust streams on the kart floor instead of the ground floor', () => {
    const effects = new KartEffects();
    effects.spawnFlame(10, 20, 0, 60);
    effects.update(1 / 60);
    const flames = effects.object.children[1] as THREE.InstancedMesh;
    expect(flames.count).toBe(2);
    const matrix = new THREE.Matrix4();
    flames.getMatrixAt(0, matrix);
    const position = new THREE.Vector3().setFromMatrixPosition(matrix);
    expect(position.y).toBeGreaterThan(60);
    expect(position.x).toBeLessThan(10);
    expect(new THREE.Vector3().setFromMatrixScale(matrix).x).toBeGreaterThan(0.5);
  });
});

describe('item hit burst', () => {
  const sparksOf = (effects: KartEffects) => effects.object.children[0] as THREE.InstancedMesh;

  it('shoots the requested number of sparks out of the hit kart', () => {
    const effects = new KartEffects();
    effects.spawnHitBurst(5, -8, 0, 40);
    effects.update(1 / 60);
    expect(sparksOf(effects).count).toBe(40);
  });

  it('scales with the graphics particle density and survives a zero density', () => {
    const effects = new KartEffects();
    effects.setParticleDensity(0.5);
    effects.spawnHitBurst(0, 0, 0, 40);
    effects.update(1 / 60);
    expect(sparksOf(effects).count).toBe(20);

    const none = new KartEffects();
    none.setParticleDensity(0);
    none.spawnHitBurst(0, 0, 0, 40);
    none.update(1 / 60);
    expect(sparksOf(none).count).toBe(0);
  });

  it('starts at the given height and rises', () => {
    const effects = new KartEffects();
    effects.spawnHitBurst(0, 0, 6, 8);
    effects.update(1 / 60);
    const matrix = new THREE.Matrix4();
    sparksOf(effects).getMatrixAt(0, matrix);
    expect(new THREE.Vector3().setFromMatrixPosition(matrix).y).toBeGreaterThan(6);
  });
});

describe('item pickup and use bursts', () => {
  const sparksOf = (effects: KartEffects) => effects.object.children[0] as THREE.InstancedMesh;

  it('shoots the requested number of sparks in the colour of the item', () => {
    const effects = new KartEffects();
    effects.spawnItemBurst(0, 0, 0, 0x38e8ff, 20);
    effects.update(1 / 60);
    const mesh = sparksOf(effects);
    expect(mesh.count).toBe(20);
    const color = new THREE.Color();
    for (let index = 0; index < mesh.count; index += 1) {
      mesh.getColorAt(index, color);
      expect([0x38e8ff, 0xffffff], `particle ${index}`).toContain(color.getHex());
    }
  });

  it('follows the graphics particle density', () => {
    const effects = new KartEffects();
    effects.setParticleDensity(0.5);
    effects.spawnItemBurst(0, 0, 0, 0xff1f2e, 20);
    effects.update(1 / 60);
    expect(sparksOf(effects).count).toBe(10);
  });
});

describe('burst spark size', () => {
  const MIN_VISIBLE_METERS = 0.25;
  const SPARK_BOX_METERS = 0.08;

  function worldSizesAfterOneFrame(spawn: (effects: KartEffects) => void): number[] {
    const effects = new KartEffects();
    spawn(effects);
    effects.update(1 / 60);
    const mesh = effects.object.children[0] as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    return Array.from({ length: mesh.count }, (_, index) => {
      mesh.getMatrixAt(index, matrix);
      return new THREE.Vector3().setFromMatrixScale(matrix).x * SPARK_BOX_METERS;
    });
  }

  it('makes drift sparks big enough to see from the race camera, bigger at higher drift stages', () => {
    const sizeAt = (stage: number) =>
      Math.max(
        ...worldSizesAfterOneFrame((effects) => {
          for (let i = 0; i < 20; i += 1) effects.spawnSpark(0, 0, 0, 1, stage);
        }),
      );
    expect(sizeAt(1)).toBeGreaterThanOrEqual(0.15);
    expect(sizeAt(3)).toBeGreaterThan(sizeAt(1));
  });

  it('makes hit sparks big enough to see from the race camera', () => {
    const sizes = worldSizesAfterOneFrame((effects) => effects.spawnHitBurst(0, 0, 0, 30));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(MIN_VISIBLE_METERS * 0.9);
  });

  it('makes item sparks big enough to see from the race camera', () => {
    const sizes = worldSizesAfterOneFrame((effects) => effects.spawnItemBurst(0, 0, 0, 0xff1f2e, 30));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(MIN_VISIBLE_METERS * 0.9);
  });
});
