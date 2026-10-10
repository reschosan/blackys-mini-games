import * as THREE from 'three';
import type { CameraConfig } from '../../../shared/config/camera';
import type { MapConfig } from '../maps/shared/mapConfig';
import type { StairTransition } from '../maps/shared/mapConfig';
import { routeElevationAt } from '../maps/shared/surface';
import { smoothTowards, type FramedPoint } from '../../../shared/core/framing';

export interface CameraSubject extends FramedPoint {
  readonly yaw: number;
  readonly levelId?: string;
  /** Set while the subject climbs a stair, where the level changes without a jump in position. */
  readonly stairTransitionId?: string | null;
  readonly elevation?: number;
  readonly penaltySecondsLeft?: number;
}

const SHAKE_DECAY_PER_SECOND = 6;

/** Direction (yaw) in which a stair climbs towards its upper floor. */
function uphillYawOf(stair: StairTransition): number {
  const climb = stair.toAt === 'max' ? 1 : -1;
  return stair.axis === 'x' ? Math.atan2(0, climb) : Math.atan2(climb, 0);
}

export class RaceCamera {
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  private readonly target = new THREE.Vector3();
  /** The smoothed, un-shaken camera position; `camera.position` gets the shake offset added on
   *  top each frame, so the shake itself never becomes next frame's smoothing input. */
  private readonly basePosition = new THREE.Vector3();
  private initialised = false;
  private previousLevelId: string | undefined;
  private previousPenaltySecondsLeft = 0;
  /** Cosmetic screen-shake on item hits; decays to 0 on its own, never affects `target`/`distance`
   *  so it can't feed back into the smoothing math above. Own randomness (`Math.random()`), not
   *  the simulation RNG. */
  private shakeStrength = 0;

  constructor(
    private readonly config: CameraConfig,
    private readonly map: MapConfig,
  ) {}

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
  }

  /** Kicks off a brief shake (e.g. an item hit); repeated calls before it decays just take the
   *  stronger of the two instead of stacking. */
  shake(strength: number): void {
    this.shakeStrength = Math.max(this.shakeStrength, strength);
  }

  update(subjects: readonly CameraSubject[], frameSeconds: number): void {
    if (this.config.mode === 'overview') this.applyOverview();
    else this.applyFollow(subjects, frameSeconds);
    this.camera.position.copy(this.basePosition);
    this.applyShake(frameSeconds);
    this.camera.updateProjectionMatrix();
  }

  private applyShake(frameSeconds: number): void {
    if (this.shakeStrength <= 0) return;
    this.camera.position.x += (Math.random() - 0.5) * this.shakeStrength;
    this.camera.position.y += (Math.random() - 0.5) * this.shakeStrength;
    this.shakeStrength = Math.max(this.shakeStrength - SHAKE_DECAY_PER_SECOND * this.shakeStrength * frameSeconds, 0);
    if (this.shakeStrength < 0.001) this.shakeStrength = 0;
  }

  /** On a stair the camera always looks uphill from below, however the kart turns: from the other side it would sit inside
   *  the floor above when the kart drives down. */
  private headingOf(subject: CameraSubject): number {
    const stair = this.map.stairTransitions?.find((transition) => transition.name === subject.stairTransitionId);
    return stair ? uphillYawOf(stair) : subject.yaw;
  }

  private applyOverview(): void {
    const { fov, height, backOffset } = this.config.overview;
    this.camera.fov = fov;
    this.basePosition.set(this.map.room.x, height, this.map.room.z + backOffset);
    this.camera.position.copy(this.basePosition);
    this.camera.lookAt(this.map.room.x, 0, this.map.room.z);
  }

  private applyFollow(subjects: readonly CameraSubject[], frameSeconds: number): void {
    const follow = this.config.follow;
    const subject = subjects[0];
    if (!subject) return;
    const jumpedToOtherLevel = subject.levelId !== this.previousLevelId && !subject.stairTransitionId;
    if (jumpedToOtherLevel || (this.previousPenaltySecondsLeft > 0 && subject.penaltySecondsLeft === 0)) this.initialised = false;
    this.previousLevelId = subject.levelId;
    this.previousPenaltySecondsLeft = subject.penaltySecondsLeft ?? 0;
    this.camera.fov = follow.fov;
    const heading = this.headingOf(subject);
    const forwardX = Math.cos(heading);
    const forwardZ = Math.sin(heading);
    const pitch = ((this.map.followCamera?.pitchDegrees ?? follow.pitchDegrees) * Math.PI) / 180;
    const elevation = subject.elevation ?? routeElevationAt(this.map, subject.x, subject.z, subject.levelId);
    const ceilingHeight =
      subject.levelId === undefined
        ? Number.POSITIVE_INFINITY
        : (this.map.levels?.find((level) => level.id === subject.levelId)?.ceilingHeight ?? Number.POSITIVE_INFINITY);
    const distance = this.map.followCamera?.thirdPersonDistance ?? follow.thirdPersonDistance;
    const horizontalDistance = Math.cos(pitch) * distance;
    const wantedTarget = new THREE.Vector3(subject.x + forwardX * follow.lookAheadDistance, elevation, subject.z + forwardZ * follow.lookAheadDistance);
    const wantedPosition = new THREE.Vector3(
      wantedTarget.x - forwardX * horizontalDistance,
      Math.min(elevation + Math.sin(pitch) * distance, ceilingHeight - follow.ceilingClearance),
      wantedTarget.z - forwardZ * horizontalDistance,
    );

    if (!this.initialised) {
      this.initialised = true;
      this.target.copy(wantedTarget);
      this.basePosition.copy(wantedPosition);
    }
    this.target.set(
      smoothTowards(this.target.x, wantedTarget.x, follow.targetSmoothing, frameSeconds),
      smoothTowards(this.target.y, wantedTarget.y, follow.targetSmoothing, frameSeconds),
      smoothTowards(this.target.z, wantedTarget.z, follow.targetSmoothing, frameSeconds),
    );

    this.basePosition.set(
      smoothTowards(this.basePosition.x, wantedPosition.x, follow.positionSmoothing, frameSeconds),
      smoothTowards(this.basePosition.y, wantedPosition.y, follow.positionSmoothing, frameSeconds),
      smoothTowards(this.basePosition.z, wantedPosition.z, follow.positionSmoothing, frameSeconds),
    );
    this.basePosition.y = Math.min(this.basePosition.y, ceilingHeight - follow.ceilingClearance);
    this.basePosition.y = Math.max(this.basePosition.y, elevation + 1);
    this.camera.position.copy(this.basePosition);
    this.camera.lookAt(this.target);
  }
}
