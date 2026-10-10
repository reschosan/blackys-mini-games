import * as THREE from 'three';
import type { CatView } from '../../../../shared/cat/catView';
import { KART_DIMENSIONS as KART } from '../../../../shared/config/kart';
import type { KartLoadout } from '../../../../shared/config/kartLoadout';
import { buildKartModel, type KartModel } from './kartModels';
import { scrollBars } from './kartParts';

const BELT_SCROLL_SPEED_SCALE = 1;
const ROLLER_ANGULAR_SPEED_SCALE = 1 / KART.beltRollerRadius;

/** Cosmetic "hop and plop" pulse played the moment an item hit starts a stun. */
const HIT_HOP_DURATION_SECONDS = 0.4;
const HIT_HOP_HEIGHT = 0.9;

/** Nickerchen shield bubble, shown for as long as `shieldSecondsLeft` is active. */
const SHIELD_COLOR = 0x7fd9ff;
const SHIELD_RADIUS = KART.length * 0.72;
const SHIELD_SPIN_SPEED = 0.6;
const SHIELD_PULSE_HZ = 1.4;
const SHIELD_PULSE_SCALE = 0.07;
const SHIELD_BASE_OPACITY = 0.5;
const SHIELD_PULSE_OPACITY = 0.12;

export class KartView {
  readonly object = new THREE.Group();
  private readonly model: KartModel;
  private readonly shieldMesh: THREE.Mesh;
  private mountedCat: CatView | null = null;
  private beltScroll = 0;
  private wasStunned = false;
  private hitHopPhaseSeconds = HIT_HOP_DURATION_SECONDS;
  private shieldPulseSeconds = 0;
  private routeElevation = 0;

  constructor(loadout: KartLoadout, playerColor: number) {
    this.model = buildKartModel(this.object, loadout, playerColor);

    this.shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(SHIELD_RADIUS, 16, 12),
      new THREE.MeshLambertMaterial({ color: SHIELD_COLOR, emissive: SHIELD_COLOR, emissiveIntensity: 0.45, transparent: true, opacity: SHIELD_BASE_OPACITY }),
    );
    this.shieldMesh.position.y = KART.height;
    this.shieldMesh.visible = false;
    this.object.add(this.shieldMesh);
  }

  /** Seats the cat the way this kart type wants it (walking on the belt, standing, or riding). */
  mountCat(cat: CatView): void {
    cat.object.position.set(this.model.seat.x, this.model.seat.y, 0);
    cat.setPose(this.model.seat.pose);
    this.object.add(cat.object);
    this.mountedCat = cat;
  }

  /** Detaches the cat so it can move to another kart; it is never disposed together with the kart. */
  releaseCat(): CatView | null {
    const cat = this.mountedCat;
    if (cat) this.object.remove(cat.object);
    this.mountedCat = null;
    return cat;
  }

  setTransform(x: number, z: number, yaw: number, routeElevation = 0, pitch = 0, roll = 0): void {
    this.routeElevation = routeElevation;
    this.object.position.set(x, routeElevation, z);
    this.object.rotation.set(roll, -yaw, pitch, 'YXZ');
  }

  /** Tints the wheels for drift-stage/boost feedback; the body and player stripe stay put. */
  setTintColor(color: number | null): void {
    this.model.tireMaterial.color.set(color ?? this.model.tireBaseColor);
  }

  /** Scrolls the treadmill's tread bars, spins its rollers so the belt visibly runs under the
   *  cat, plays a cosmetic hop-and-plop pulse the instant an item hit stuns the kart, and shows
   *  the Nickerchen shield bubble while active. Reads `stunSecondsLeft`/`shieldSecondsLeft` only
   *  to drive these cosmetics, never writes back into the simulation. */
  update(deltaSeconds: number, speed: number, stunSecondsLeft: number, shieldSecondsLeft: number): void {
    this.beltScroll += speed * deltaSeconds * BELT_SCROLL_SPEED_SCALE;
    this.scrollBelt(deltaSeconds, speed);
    for (const tread of this.model.treads) scrollBars(tread, 0, this.beltScroll);
    for (const wheel of this.model.wheels) wheel.object.rotation.z -= (speed * deltaSeconds) / wheel.radius;

    this.updateHitHop(deltaSeconds, stunSecondsLeft);
    this.updateShield(deltaSeconds, shieldSecondsLeft);
  }

  private scrollBelt(deltaSeconds: number, speed: number): void {
    const belt = this.model.belt;
    if (!belt) return;
    scrollBars(belt.strip, belt.centerX, this.beltScroll);
    for (const roller of belt.rollers) roller.rotation.z -= speed * deltaSeconds * ROLLER_ANGULAR_SPEED_SCALE;
  }

  private updateHitHop(deltaSeconds: number, stunSecondsLeft: number): void {
    const stunned = stunSecondsLeft > 0;
    if (stunned && !this.wasStunned) this.hitHopPhaseSeconds = 0;
    this.wasStunned = stunned;

    if (this.hitHopPhaseSeconds >= HIT_HOP_DURATION_SECONDS) {
      this.object.position.y = this.routeElevation;
      return;
    }
    this.hitHopPhaseSeconds += deltaSeconds;
    const t = Math.min(this.hitHopPhaseSeconds / HIT_HOP_DURATION_SECONDS, 1);
    this.object.position.y = this.routeElevation + Math.sin(t * Math.PI) * HIT_HOP_HEIGHT;
  }

  private updateShield(deltaSeconds: number, shieldSecondsLeft: number): void {
    this.shieldMesh.visible = shieldSecondsLeft > 0;
    if (!this.shieldMesh.visible) return;
    this.shieldMesh.rotation.y += SHIELD_SPIN_SPEED * deltaSeconds;
    this.shieldPulseSeconds += deltaSeconds;
    const pulse = Math.sin(this.shieldPulseSeconds * SHIELD_PULSE_HZ * Math.PI * 2);
    this.shieldMesh.scale.setScalar(1 + SHIELD_PULSE_SCALE * pulse);
    (this.shieldMesh.material as THREE.MeshLambertMaterial).opacity = SHIELD_BASE_OPACITY + SHIELD_PULSE_OPACITY * pulse;
  }

  dispose(): void {
    this.releaseCat();
    this.object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    });
  }
}
