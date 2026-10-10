export interface FramedPoint {
  readonly x: number;
  readonly z: number;
}

export interface Framing {
  readonly centerX: number;
  readonly centerZ: number;
  readonly radius: number;
}

export function framingForPoints(points: readonly FramedPoint[], margin: number): Framing {
  const first = points[0];
  if (!first) return { centerX: 0, centerZ: 0, radius: margin };

  let minX = first.x;
  let maxX = first.x;
  let minZ = first.z;
  let maxZ = first.z;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }

  return {
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    radius: Math.hypot(maxX - minX, maxZ - minZ) / 2 + margin,
  };
}

export function distanceForRadius(radius: number, fovDegrees: number, aspect: number): number {
  const verticalFov = (fovDegrees * Math.PI) / 180;
  const verticalReach = radius / Math.tan(verticalFov / 2);
  const horizontalReach = verticalReach / Math.max(aspect, 0.1);
  return Math.max(verticalReach, horizontalReach);
}

export function smoothTowards(current: number, target: number, rate: number, stepSeconds: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * stepSeconds));
}

/** Eases an angle towards another along the shorter way round. */
export function smoothAngleTowards(current: number, target: number, rate: number, stepSeconds: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-rate * stepSeconds));
}
