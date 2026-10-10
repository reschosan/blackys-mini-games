import * as THREE from 'three';
import { ParticlePool } from './particlePool';

const SPARK_COLORS: readonly number[] = [0xffcc33, 0xff9d33, 0xffe680];
const FLAME_COLORS: readonly number[] = [0x00bfff, 0x38e8ff, 0xe0ffff];
const DUST_COLORS: readonly number[] = [0xcbb892, 0xb8a37e, 0xdccaa4];
const HIT_COLORS: readonly number[] = [0xffffff, 0xffe066, 0xff9d33];
const CONFETTI_COLORS: readonly number[] = [0xff4d6d, 0x4dd2ff, 0xffe066, 0x8effa1, 0xc79bff, 0xffffff];

const SPARK_POOL_SIZE = 160;
const SPARK_BOX_METERS = 0.08;
const BURST_SPARK_MIN_METERS = 0.32;
const BURST_SPARK_EXTRA_METERS = 0.2;
const DRIFT_SPARK_MIN_METERS = 0.18;
const DRIFT_SPARK_METERS_PER_STAGE = 0.04;
const FLAME_POOL_SIZE = 160;
const DUST_POOL_SIZE = 180;
const CONFETTI_POOL_SIZE = 700;

function pickColor(colors: readonly number[]): number {
  return colors[Math.floor(Math.random() * colors.length)]!;
}

/** Point on the ground a short distance behind/beside a kart, for spawning drift/boost/dust
 *  particles at its rear. `sideOffset` is positive to the kart's right. */
function rearPointOf(x: number, z: number, yaw: number, backOffset: number, sideOffset: number): THREE.Vector3 {
  const backX = -Math.cos(yaw);
  const backZ = -Math.sin(yaw);
  const rightX = -Math.sin(yaw);
  const rightZ = Math.cos(yaw);
  return new THREE.Vector3(x + backX * backOffset + rightX * sideOffset, 0.12, z + backZ * backOffset + rightZ * sideOffset);
}

/** Owns the shared particle pools for drift sparks, boost flame, offroad dust and finish-line
 *  confetti — one `InstancedMesh` per kind, fed by every kart instead of each kart owning its own
 *  (cheaper: 4 draw calls total instead of 4 per kart). Purely cosmetic: reads whatever position/
 *  yaw the caller hands it each frame, never touches simulation state. Uses `Math.random()` for
 *  spread, not the deterministic simulation RNG (see architecture rules on cosmetic randomness). */
export class KartEffects {
  readonly object = new THREE.Group();
  private readonly sparks: ParticlePool;
  private readonly flame: ParticlePool;
  private readonly dust: ParticlePool;
  private readonly confetti: ParticlePool;
  private particleDensity = 1;

  constructor() {
    this.sparks = new ParticlePool(new THREE.BoxGeometry(SPARK_BOX_METERS, SPARK_BOX_METERS, SPARK_BOX_METERS), new THREE.MeshBasicMaterial(), SPARK_POOL_SIZE);
    this.flame = new ParticlePool(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshBasicMaterial(), FLAME_POOL_SIZE);
    this.dust = new ParticlePool(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.7 }), DUST_POOL_SIZE);
    this.confetti = new ParticlePool(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial(), CONFETTI_POOL_SIZE);
    this.object.add(this.sparks.object, this.flame.object, this.dust.object, this.confetti.object);
  }

  update(deltaSeconds: number): void {
    this.sparks.update(deltaSeconds);
    this.flame.update(deltaSeconds);
    this.dust.update(deltaSeconds);
    this.confetti.update(deltaSeconds);
  }

  setParticleDensity(density: number): void {
    this.particleDensity = Math.min(Math.max(density, 0), 1);
  }

  /** One drift-spark particle kicked out sideways from the drifting rear corner. */
  spawnSpark(x: number, z: number, yaw: number, driftDirection: -1 | 0 | 1, stage: number): void {
    if (Math.random() > this.particleDensity) return;
    const sideOffset = driftDirection * 0.55;
    const position = rearPointOf(x, z, yaw, 0.85, sideOffset);
    const kickAngle = yaw + Math.PI + driftDirection * (0.6 + Math.random() * 0.6);
    const speed = 1.5 + stage * 0.6 + Math.random() * 1.2;
    const velocity = new THREE.Vector3(Math.cos(kickAngle) * speed, 1 + Math.random() * 1.5, Math.sin(kickAngle) * speed);
    this.sparks.spawn(
      position,
      velocity,
      0.18 + Math.random() * 0.1,
      (DRIFT_SPARK_MIN_METERS + stage * DRIFT_SPARK_METERS_PER_STAGE) / SPARK_BOX_METERS,
      pickColor(SPARK_COLORS),
      4,
    );
  }

  /** One boost-flame particle shot straight out the back. */
  spawnFlame(x: number, z: number, yaw: number, elevation: number): void {
    if (Math.random() > this.particleDensity) return;
    const backX = -Math.cos(yaw);
    const backZ = -Math.sin(yaw);
    const speed = 4 + Math.random() * 2;
    const velocity = new THREE.Vector3(backX * speed, 0.3 + Math.random() * 0.6, backZ * speed);
    for (const side of [-0.45, 0.45]) {
      const position = rearPointOf(x, z, yaw, 1.2, side);
      position.y = elevation + 0.55;
      this.flame.spawn(position, velocity, 0.35, 0.9, pickColor(FLAME_COLORS));
    }
  }

  /** A visible two-puff dust trail behind an offroad kart. */
  spawnDust(x: number, z: number, yaw: number): void {
    if (Math.random() > this.particleDensity) return;
    const backX = -Math.cos(yaw);
    const backZ = -Math.sin(yaw);
    for (let index = 0; index < 2; index += 1) {
      const position = rearPointOf(x, z, yaw, 0.7 + index * 0.15, (Math.random() - 0.5) * 1.1);
      const velocity = new THREE.Vector3(
        backX * (1.6 + Math.random() * 1.2) + (Math.random() - 0.5) * 0.8,
        0.9 + Math.random() * 0.7,
        backZ * (1.6 + Math.random() * 1.2) + (Math.random() - 0.5) * 0.8,
      );
      this.dust.spawn(position, velocity, 0.8 + Math.random() * 0.35, 0.34 + Math.random() * 0.16, pickColor(DUST_COLORS), 0.45);
    }
  }

  /** Sparks shot out of a kart an item just hit: a bright ring that flies up and outward and falls back. */
  spawnHitBurst(x: number, z: number, elevation: number, count: number): void {
    this.spawnBurst(x, z, elevation, count, HIT_COLORS);
  }

  /** The same burst in the colour of an item, for picking it up or using it. */
  spawnItemBurst(x: number, z: number, elevation: number, color: number, count: number): void {
    this.spawnBurst(x, z, elevation, count, [color, 0xffffff]);
  }

  private spawnBurst(x: number, z: number, elevation: number, count: number, colors: readonly number[]): void {
    for (let i = 0; i < Math.round(count * this.particleDensity); i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const outwardSpeed = 3 + Math.random() * 4;
      const position = new THREE.Vector3(x + Math.cos(angle) * 0.4, elevation + 0.8 + Math.random() * 0.4, z + Math.sin(angle) * 0.4);
      const velocity = new THREE.Vector3(Math.cos(angle) * outwardSpeed, 3 + Math.random() * 4, Math.sin(angle) * outwardSpeed);
      this.sparks.spawn(
        position,
        velocity,
        0.55 + Math.random() * 0.3,
        (BURST_SPARK_MIN_METERS + Math.random() * BURST_SPARK_EXTRA_METERS) / SPARK_BOX_METERS,
        pickColor(colors),
        9,
      );
    }
  }

  /** A big, unmissable finish-line confetti burst centred on `x`/`z`: a wide shower that shoots
   *  well above the kart and hangs in the air for a few seconds before drifting down. */
  spawnConfettiBurst(x: number, z: number, count: number): void {
    for (let i = 0; i < Math.round(count * this.particleDensity); i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const outwardSpeed = 2 + Math.random() * 5;
      const position = new THREE.Vector3(x + Math.cos(angle) * 0.6, 1.2 + Math.random() * 0.8, z + Math.sin(angle) * 0.6);
      const velocity = new THREE.Vector3(Math.cos(angle) * outwardSpeed, 6 + Math.random() * 5, Math.sin(angle) * outwardSpeed);
      this.confetti.spawn(position, velocity, 2.2 + Math.random() * 1.4, 1.1 + Math.random() * 0.9, pickColor(CONFETTI_COLORS), 2.2);
    }
  }
}
