export type SurfaceKind = 'mud' | 'moondust' | 'carpet' | 'puddle';

export const SURFACE_KINDS: readonly SurfaceKind[] = ['mud', 'moondust', 'carpet', 'puddle'];

/** What driving over a surface zone does, before wheel modifiers: multipliers on top speed,
 *  acceleration and sideways grip (below 1 is slower or slipperier). */
export interface SurfaceFactors {
  speedFactor: number;
  accelerationFactor: number;
  gripFactor: number;
}

export interface SurfaceStats extends SurfaceFactors {
  readonly label: string;
}

export const SURFACE_STATS: Readonly<Record<SurfaceKind, SurfaceStats>> = Object.freeze({
  mud: { label: 'Mud', speedFactor: 0.75, accelerationFactor: 0.65, gripFactor: 0.8 },
  moondust: { label: 'Moon dust (ice)', speedFactor: 0.95, accelerationFactor: 0.85, gripFactor: 0.45 },
  carpet: { label: 'Carpet', speedFactor: 0.88, accelerationFactor: 0.85, gripFactor: 1.1 },
  puddle: { label: 'Puddle', speedFactor: 0.8, accelerationFactor: 0.8, gripFactor: 0.7 },
});

/** The surface factors a kart gets: the same for every kart, whatever its wheels. */
export type KartSurfaceFactors = Readonly<Partial<Record<SurfaceKind, SurfaceFactors>>>;
