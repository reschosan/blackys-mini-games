export interface StickVector {
  readonly x: number;
  readonly y: number;
}

export function clampToUnitCircle(deltaX: number, deltaY: number, maxRadiusPx: number): StickVector {
  const radius = Math.hypot(deltaX, deltaY);
  if (radius <= maxRadiusPx) return { x: deltaX / maxRadiusPx, y: deltaY / maxRadiusPx };
  const scale = maxRadiusPx / radius;
  return { x: (deltaX * scale) / maxRadiusPx, y: (deltaY * scale) / maxRadiusPx };
}
