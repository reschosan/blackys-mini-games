import * as THREE from 'three';

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  life: number;
  maxLife: number;
  baseScale: number;
  gravity: number;
  color: THREE.Color;
}

/** A fixed-size pool of simple cosmetic particles, drawn with a single `InstancedMesh` (one draw
 *  call for the whole pool, however many particles are currently alive). Particles shrink to
 *  nothing over their lifetime instead of fading opacity, which keeps the chunky graybox look and
 *  avoids transparency-sorting overhead. Purely cosmetic: only ever receives positions/velocities
 *  handed to it by the caller, never reads or writes simulation state. */
export class ParticlePool {
  readonly object: THREE.InstancedMesh;
  private readonly slots: readonly ParticleSlot[];
  private readonly dummy = new THREE.Object3D();
  private nextSlot = 0;

  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    private readonly count: number,
  ) {
    this.object = new THREE.InstancedMesh(geometry, material, count);
    this.object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Three.js derives the auto frustum-culling bounds from the geometry at the mesh's local
    // origin, not from where each instance is actually placed — with particles scattered around
    // the map far from that origin, the whole mesh would otherwise get culled as "off-screen"
    // every frame even while full of visible instances.
    this.object.frustumCulled = false;
    this.object.count = 0;
    this.slots = Array.from({ length: count }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      velocityX: 0,
      velocityY: 0,
      velocityZ: 0,
      life: 0,
      maxLife: 1,
      baseScale: 1,
      gravity: 0,
      color: new THREE.Color(),
    }));
  }

  /** Spawns one particle, overwriting the oldest slot once the pool is full (graceful
   *  degradation: a very dense moment just loses its oldest particles a little early). */
  spawn(position: THREE.Vector3Like, velocity: THREE.Vector3Like, lifeSeconds: number, scale: number, color: THREE.ColorRepresentation, gravity = 0): void {
    const slot = this.slots[this.nextSlot]!;
    this.nextSlot = (this.nextSlot + 1) % this.count;
    slot.active = true;
    slot.x = position.x;
    slot.y = position.y;
    slot.z = position.z;
    slot.velocityX = velocity.x;
    slot.velocityY = velocity.y;
    slot.velocityZ = velocity.z;
    slot.life = lifeSeconds;
    slot.maxLife = lifeSeconds;
    slot.baseScale = scale;
    slot.gravity = gravity;
    slot.color.set(color);
  }

  update(deltaSeconds: number): void {
    let visibleCount = 0;
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.life -= deltaSeconds;
      if (slot.life <= 0) {
        slot.active = false;
        continue;
      }
      slot.velocityY -= slot.gravity * deltaSeconds;
      slot.x += slot.velocityX * deltaSeconds;
      slot.y += slot.velocityY * deltaSeconds;
      slot.z += slot.velocityZ * deltaSeconds;

      const scale = slot.baseScale * (slot.life / slot.maxLife);
      this.dummy.position.set(slot.x, slot.y, slot.z);
      this.dummy.scale.setScalar(Math.max(scale, 0.0001));
      this.dummy.updateMatrix();
      this.object.setMatrixAt(visibleCount, this.dummy.matrix);
      this.object.setColorAt(visibleCount, slot.color);
      visibleCount += 1;
    }
    this.object.count = visibleCount;
    this.object.instanceMatrix.needsUpdate = true;
    if (this.object.instanceColor) this.object.instanceColor.needsUpdate = true;
  }
}
