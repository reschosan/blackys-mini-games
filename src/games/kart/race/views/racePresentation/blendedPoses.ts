import type { MapConfig } from '../../../maps/shared/mapConfig';
import { kartElevationAt } from '../../../maps/shared/surface';
import { windowJumpHeight } from '../../../maps/shared/windowJumps';
import { hopHeightOf } from '../../../kart/kartState';
import { interpolatePose, type Pose } from '../poseInterpolation';
import type { ViewSubject } from './houseCameraAvoidance';
import type { PresentedRacer } from './racerTypes';

/** A pose jump longer than this (respawn, race reset) is not a movement and is never blended. */
const TELEPORT_DISTANCE_METERS = 5;

/** Where each racer is drawn in a frame between two simulation ticks. Reads the state only. */
export class BlendedPoses {
  private readonly previousPoses = new Map<PresentedRacer, Pose>();
  /** How far the current frame has advanced toward the next simulation tick (0..1). */
  private frameAlpha = 1;

  /** Remembers where every racer was before the next simulation tick moves it. */
  rememberBeforeTick(players: readonly PresentedRacer[]): void {
    for (const player of players) this.previousPoses.set(player, { x: player.state.x, z: player.state.z, yaw: player.state.yaw });
  }

  setFrameAlpha(alpha: number): void {
    this.frameAlpha = Math.min(Math.max(alpha, 0), 1);
  }

  forget(player: PresentedRacer): void {
    this.previousPoses.delete(player);
  }

  poseOf(player: PresentedRacer): Pose {
    return interpolatePose(this.previousPoses.get(player), player.state, this.frameAlpha, TELEPORT_DISTANCE_METERS);
  }

  elevationOf(map: MapConfig, player: PresentedRacer, pose: Pose): number {
    return kartElevationAt(map, { ...player.state, x: pose.x, z: pose.z }) + windowJumpHeight(map, player.state) + hopHeightOf(player.state);
  }

  cameraSubject(map: MapConfig, player: PresentedRacer): ViewSubject & { readonly yaw: number } {
    const state = player.state;
    const pose = this.poseOf(player);
    return {
      x: pose.x,
      z: pose.z,
      yaw: pose.yaw,
      levelId: state.levelId,
      stairTransitionId: state.stairTransitionId,
      penaltySecondsLeft: state.penaltySecondsLeft,
      nextCheckpoint: player.progress.nextCheckpoint,
      elevation: this.elevationOf(map, player, pose),
    };
  }
}
