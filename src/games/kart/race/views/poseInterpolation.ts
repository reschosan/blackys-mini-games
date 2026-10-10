export interface Pose {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}

function shortestAngleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/** The pose to draw between the previous and the current simulation tick; `alpha` is how far the
 *  frame has advanced toward the next tick (0..1). Display rates that do not match the fixed
 *  simulation rate (75 Hz, 144 Hz, ...) would otherwise repeat or skip simulation steps and make
 *  karts judder. A jump longer than `teleportDistance` (respawn after a window penalty, race reset)
 *  is shown as it is instead of sliding across the map. */
export function interpolatePose(previous: Pose | undefined, current: Pose, alpha: number, teleportDistance: number): Pose {
  if (!previous || Math.hypot(current.x - previous.x, current.z - previous.z) > teleportDistance) return current;
  return {
    x: previous.x + (current.x - previous.x) * alpha,
    z: previous.z + (current.z - previous.z) * alpha,
    yaw: previous.yaw + shortestAngleDelta(previous.yaw, current.yaw) * alpha,
  };
}
