import * as THREE from 'three';
import { CAT_FUR_SHELL_COUNT, catFur } from '../config/catFur';
import { CAT_MODEL } from '../config/catModel';
import type { CatAppearance } from '../config/catAppearance';
import { createFurShellGeometry } from './catFurShells';
import { cloneCatModel, loadCatModelSource, type CatModelSource } from './catModelLoader';
import { createCatPatternMaterial, type CatPatternMaterial } from './catPatternMaterial';

const BLINK_DURATION_SECONDS = 0.14;
const BREATH_CYCLE_SECONDS = 3.4;
const BREATH_SCALE_AMOUNT = 0.012;

const LEAN_GAIN = 0.05;
const LEAN_MAX_RADIANS = 0.32;
const LEAN_RESPONSE = 9;

const TAIL_GAIN = 1.6;
const TAIL_RESPONSE = 4.5;
const TAIL_WAG_SPEED = 7;
const TAIL_WAG_AMOUNT = 0.55;

const EAR_TWITCH_DURATION_SECONDS = 0.18;

const BOOST_SQUASH_DURATION_SECONDS = 0.3;
const BOOST_SQUASH_Y = 0.72;
const BOOST_STRETCH_XZ = 1.14;

const IDLE_HEAD_CYCLE_SECONDS = 4.5;
const IDLE_HEAD_AMOUNT = 0.09;

/** How the cat sits on its vehicle: walking on a belt, standing still, or sitting up on a bike. */
export type CatPose = 'walk' | 'stand' | 'rideUp';

const RIDE_UP_PITCH_RADIANS = 0.45;

export interface CatMotionState {
  readonly isMoving: boolean;
  readonly lateralSpeed: number;
  readonly boosting: boolean;
}

function placeholderMesh(): THREE.Mesh {
  const geometry = new THREE.CapsuleGeometry(0.16, 0.2, 4, 8);
  const material = new THREE.MeshLambertMaterial({ color: 0x8d8d90 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0.26;
  return mesh;
}

function findBone(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((child) => {
    if (!found && child.name === name) found = child;
  });
  return found;
}

function approach(current: number, target: number, deltaSeconds: number, responseRate: number): number {
  const t = Math.min(1, deltaSeconds * responseRate);
  return current + (target - current) * t;
}

export class CatView {
  readonly object = new THREE.Group();
  private readonly pivot = new THREE.Group();
  private pose: CatPose = 'walk';
  private tailWagClockSeconds = 0;
  private pattern: CatPatternMaterial | null = null;
  private furBody: { readonly mesh: THREE.SkinnedMesh; readonly source: CatModelSource } | null = null;
  private furShell: { readonly mesh: THREE.SkinnedMesh; readonly pattern: CatPatternMaterial } | null = null;
  private placeholder: THREE.Mesh | null = placeholderMesh();
  private leftEyeBone: THREE.Object3D | null = null;
  private rightEyeBone: THREE.Object3D | null = null;
  private headBone: THREE.Object3D | null = null;
  private tailBone: THREE.Object3D | null = null;
  private earBones: readonly THREE.Object3D[] = [];
  private mixer: THREE.AnimationMixer | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private appearance: CatAppearance;
  private disposed = false;

  private breathClockSeconds = Math.random() * BREATH_CYCLE_SECONDS;
  private blinkTimerSeconds = 1.5 + Math.random() * 3;
  private blinkPhaseSeconds = 0;
  private blinking = false;

  private leanCurrent = 0;
  private tailSwingCurrent = 0;

  private earTwitchTimerSeconds = 2 + Math.random() * 5;
  private earTwitchPhaseSeconds = 0;
  private earTwitching = false;
  private earTwitchBone: THREE.Object3D | null = null;

  private wasBoosting = false;
  private boostSquashPhaseSeconds = BOOST_SQUASH_DURATION_SECONDS;

  private idleHeadClockSeconds = Math.random() * IDLE_HEAD_CYCLE_SECONDS;

  constructor(appearance: CatAppearance) {
    this.appearance = appearance;
    this.object.add(this.pivot);
    if (this.placeholder) this.pivot.add(this.placeholder);
    void this.loadModel();
  }

  private async loadModel(): Promise<void> {
    try {
      const source = await loadCatModelSource();
      if (this.disposed) return;

      const clone = cloneCatModel(source);
      clone.scene.scale.setScalar(CAT_MODEL.scale);
      clone.scene.position.y = CAT_MODEL.groundOffsetY;
      clone.scene.rotation.y = CAT_MODEL.forwardRotationY;

      const baseMap = (source.furMesh.material as THREE.MeshStandardMaterial).map ?? null;
      this.pattern = createCatPatternMaterial(this.appearance, { min: source.boundsMin, max: source.boundsMax }, baseMap);
      clone.furMesh.material = this.pattern.material;
      this.furBody = { mesh: clone.furMesh, source };

      this.leftEyeBone = findBone(clone.scene, 'eyeL_022');
      this.rightEyeBone = findBone(clone.scene, 'eyeR_023');
      this.headBone = findBone(clone.scene, 'head_018');
      this.tailBone = findBone(clone.scene, 'tail_07');
      this.earBones = [findBone(clone.scene, 'earL_019'), findBone(clone.scene, 'earR_020')].filter((bone): bone is THREE.Object3D => bone !== null);

      const walkClip = source.animations[0];
      if (walkClip) {
        this.mixer = new THREE.AnimationMixer(clone.scene);
        this.walkAction = this.mixer.clipAction(walkClip);
        this.walkAction.play();
        this.applyPoseToWalkAction();
      }

      if (this.placeholder) {
        this.object.remove(this.placeholder);
        this.placeholder.geometry.dispose();
        (this.placeholder.material as THREE.Material).dispose();
        this.placeholder = null;
      }
      this.pivot.add(clone.scene);
      this.syncFurShell();
    } catch (error) {
      console.error('Cat model failed to load, keeping placeholder.', error);
    }
  }

  setPose(pose: CatPose): void {
    this.pose = pose;
    this.pivot.rotation.z = pose === 'rideUp' ? RIDE_UP_PITCH_RADIANS : 0;
    this.applyPoseToWalkAction();
  }

  private applyPoseToWalkAction(): void {
    if (this.walkAction && this.pose !== 'walk') this.walkAction.time = 0;
  }

  setAppearance(appearance: CatAppearance): void {
    this.appearance = appearance;
    this.pattern?.setAppearance(appearance);
    this.furShell?.pattern.setAppearance(appearance);
    this.syncFurShell();
  }

  /** Long hair and the mane are a stack of fur shells over the body mesh; short, maneless cats have none. */
  private syncFurShell(): void {
    const wantsShell = (this.appearance.hairLength === 'long' || this.appearance.mane !== 'none') && this.furBody !== null;
    if (!wantsShell) {
      this.removeFurShell();
      return;
    }
    if (this.furShell || !this.furBody) return;
    const { mesh: body, source } = this.furBody;
    const pattern = createCatPatternMaterial(
      this.appearance,
      { min: source.boundsMin, max: source.boundsMax },
      (source.furMesh.material as THREE.MeshStandardMaterial).map ?? null,
      true,
    );
    const mesh = new THREE.SkinnedMesh(createFurShellGeometry(body.geometry, CAT_FUR_SHELL_COUNT), pattern.material);
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
    mesh.scale.copy(body.scale);
    mesh.frustumCulled = false;
    body.parent?.add(mesh);
    mesh.bind(body.skeleton, body.bindMatrix);
    pattern.setFurTuning(catFur, this.appearance);
    this.furShell = { mesh, pattern };
  }

  private removeFurShell(): void {
    if (!this.furShell) return;
    this.furShell.mesh.removeFromParent();
    this.furShell.pattern.dispose();
    this.furShell = null;
  }

  getAppearance(): CatAppearance {
    return this.appearance;
  }

  /**
   * Drives every cosmetic animation (walk cycle, breathing, blinking, corner lean, tail
   * follow-through, ear twitch, boost squash, idle head sway). Uses its own randomness, never
   * the simulation RNG, and has no effect on physics or race logic.
   */
  update(deltaSeconds: number, motion: CatMotionState): void {
    if (this.walkAction) this.walkAction.paused = this.pose !== 'walk' || !motion.isMoving;
    this.mixer?.update(deltaSeconds);
    this.furShell?.pattern.setFurTuning(catFur, this.appearance);

    this.updateBreathing(deltaSeconds);
    this.updateBlink(deltaSeconds);
    this.updateLean(deltaSeconds, motion.lateralSpeed);
    this.updateTailFollowThrough(deltaSeconds);
    this.updateEarTwitch(deltaSeconds);
    this.updateBoostSquash(deltaSeconds, motion.boosting);
    this.updateIdleHead(deltaSeconds, motion.isMoving);
  }

  private updateBreathing(deltaSeconds: number): void {
    this.breathClockSeconds += deltaSeconds;
    const breath = 1 + Math.sin((this.breathClockSeconds / BREATH_CYCLE_SECONDS) * Math.PI * 2) * BREATH_SCALE_AMOUNT;
    this.object.scale.set(breath, breath, breath);
  }

  private updateBlink(deltaSeconds: number): void {
    if (this.blinking) this.advanceBlink(deltaSeconds);
    else this.waitForNextBlink(deltaSeconds);
  }

  private advanceBlink(deltaSeconds: number): void {
    this.blinkPhaseSeconds += deltaSeconds;
    const t = Math.min(this.blinkPhaseSeconds / BLINK_DURATION_SECONDS, 1);
    const closeness = t < 0.5 ? t * 2 : (1 - t) * 2;
    this.setEyeScale(Math.max(1 - closeness, 0.05));
    if (t < 1) return;
    this.blinking = false;
    this.setEyeScale(1);
    this.blinkTimerSeconds = 2 + Math.random() * 4;
  }

  private waitForNextBlink(deltaSeconds: number): void {
    this.blinkTimerSeconds -= deltaSeconds;
    if (this.blinkTimerSeconds > 0 || !this.leftEyeBone || !this.rightEyeBone) return;
    this.blinking = true;
    this.blinkPhaseSeconds = 0;
  }

  private setEyeScale(scale: number): void {
    if (this.leftEyeBone) this.leftEyeBone.scale.y = scale;
    if (this.rightEyeBone) this.rightEyeBone.scale.y = scale;
  }

  /** Rolls the whole cat sideways into the turn, based on how much the kart is sliding. */
  private updateLean(deltaSeconds: number, lateralSpeed: number): void {
    const target = THREE.MathUtils.clamp(-lateralSpeed * LEAN_GAIN, -LEAN_MAX_RADIANS, LEAN_MAX_RADIANS);
    this.leanCurrent = approach(this.leanCurrent, target, deltaSeconds, LEAN_RESPONSE);
    this.object.rotation.x = this.leanCurrent;
  }

  /** The tail lags behind the lean and swings the other way, like a counterbalance. */
  private updateTailFollowThrough(deltaSeconds: number): void {
    if (!this.tailBone) return;
    this.tailWagClockSeconds += deltaSeconds;
    const wag = this.pose === 'walk' ? 0 : Math.sin(this.tailWagClockSeconds * TAIL_WAG_SPEED) * TAIL_WAG_AMOUNT;
    const target = -this.leanCurrent * TAIL_GAIN + wag;
    this.tailSwingCurrent = approach(this.tailSwingCurrent, target, deltaSeconds, TAIL_RESPONSE);
    this.tailBone.rotation.y = this.tailSwingCurrent;
  }

  /** Occasionally flicks one ear, timed off its own random schedule (never the sim RNG). */
  private updateEarTwitch(deltaSeconds: number): void {
    if (this.earBones.length === 0) return;
    if (this.earTwitching) this.advanceEarTwitch(deltaSeconds);
    else this.waitForNextEarTwitch(deltaSeconds);
  }

  private advanceEarTwitch(deltaSeconds: number): void {
    this.earTwitchPhaseSeconds += deltaSeconds;
    const t = Math.min(this.earTwitchPhaseSeconds / EAR_TWITCH_DURATION_SECONDS, 1);
    if (this.earTwitchBone) this.earTwitchBone.rotation.z = Math.sin(t * Math.PI) * 0.35;
    if (t < 1) return;
    this.earTwitching = false;
    if (this.earTwitchBone) this.earTwitchBone.rotation.z = 0;
    this.earTwitchTimerSeconds = 3 + Math.random() * 6;
  }

  private waitForNextEarTwitch(deltaSeconds: number): void {
    this.earTwitchTimerSeconds -= deltaSeconds;
    if (this.earTwitchTimerSeconds > 0) return;
    this.earTwitching = true;
    this.earTwitchPhaseSeconds = 0;
    this.earTwitchBone = this.earBones[Math.floor(Math.random() * this.earBones.length)] ?? null;
  }

  /** A quick squash-and-stretch pulse the moment a boost starts. */
  private updateBoostSquash(deltaSeconds: number, boosting: boolean): void {
    if (boosting && !this.wasBoosting) this.boostSquashPhaseSeconds = 0;
    this.wasBoosting = boosting;

    if (this.boostSquashPhaseSeconds >= BOOST_SQUASH_DURATION_SECONDS) return;
    this.boostSquashPhaseSeconds += deltaSeconds;
    const t = Math.min(this.boostSquashPhaseSeconds / BOOST_SQUASH_DURATION_SECONDS, 1);
    const recover = 1 - Math.sin(t * Math.PI);
    const squashY = THREE.MathUtils.lerp(1, BOOST_SQUASH_Y, recover);
    const stretchXZ = THREE.MathUtils.lerp(1, BOOST_STRETCH_XZ, recover);
    this.object.scale.multiply(new THREE.Vector3(stretchXZ, squashY, stretchXZ));
  }

  /** A slow head sway while parked, so the cat still reads as alive when the kart is stationary. */
  private updateIdleHead(deltaSeconds: number, isMoving: boolean): void {
    if (!this.headBone) return;
    if (isMoving) {
      this.headBone.rotation.y = approach(this.headBone.rotation.y, 0, deltaSeconds, 4);
      return;
    }
    this.idleHeadClockSeconds += deltaSeconds;
    this.headBone.rotation.y = Math.sin((this.idleHeadClockSeconds / IDLE_HEAD_CYCLE_SECONDS) * Math.PI * 2) * IDLE_HEAD_AMOUNT;
  }

  dispose(): void {
    this.disposed = true;
    // The skinned mesh geometry is shared across all cat instances (cloneCatModel only
    // clones the skeleton), so it is never disposed here - only this instance's own
    // material and skeleton resources are.
    this.pattern?.dispose();
    this.removeFurShell();
    if (this.placeholder) {
      this.placeholder.geometry.dispose();
      (this.placeholder.material as THREE.Material).dispose();
    }
  }
}
