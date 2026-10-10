/** Noise for the procedural textures. Everything repeats over the texture size, so the textures tile without seams. */

/** A fixed pseudo-random value in 0..1 for a pixel or a cell. */
export function grain(x: number, y: number): number {
  const value = Math.imul(x + 17, 374761393) ^ Math.imul(y + 71, 668265263);
  return ((Math.imul(value ^ (value >>> 13), 1274126177) >>> 0) % 1024) / 1023;
}

const wrap = (value: number, period: number): number => ((value % period) + period) % period;
const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Smooth noise in 0..1 with `cells` blobs across the texture. */
function valueNoise(x: number, y: number, size: number, cells: number, seed: number): number {
  const fx = (x / size) * cells;
  const fy = (y / size) * cells;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = smooth(fx - ix);
  const ty = smooth(fy - iy);
  const at = (cx: number, cy: number): number => grain(wrap(cx, cells) + seed * 977, wrap(cy, cells) + seed * 613);
  const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx;
  const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx;
  return top + (bottom - top) * ty;
}

/** Several layers of smooth noise, each twice as fine and half as strong: blotches with detail. 0..1. */
export function fbm(x: number, y: number, size: number, cells: number, octaves = 4, seed = 0): number {
  let sum = 0;
  let amplitude = 1;
  let total = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += valueNoise(x, y, size, cells * 2 ** octave, seed + octave) * amplitude;
    total += amplitude;
    amplitude /= 2;
  }
  return sum / total;
}

export interface Cells {
  /** Distance to the nearest cell centre, in pixels. */
  readonly nearest: number;
  /** How much nearer the nearest centre is than the second one: small on the border between two cells. */
  readonly edge: number;
  /** A fixed value in 0..1 per cell. */
  readonly tone: number;
}

/** Irregular cells (stones, cracks): `cells` jittered centres per side. */
export function voronoi(x: number, y: number, size: number, cells: number, seed = 0): Cells {
  const cellSize = size / cells;
  const cx = Math.floor(x / cellSize);
  const cy = Math.floor(y / cellSize);
  let first = Number.POSITIVE_INFINITY;
  let second = Number.POSITIVE_INFINITY;
  let tone = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const kx = wrap(cx + dx, cells);
      const ky = wrap(cy + dy, cells);
      const px = (cx + dx + 0.15 + grain(kx + seed * 31, ky) * 0.7) * cellSize;
      const py = (cy + dy + 0.15 + grain(ky + seed * 17, kx + 5) * 0.7) * cellSize;
      const distance = Math.hypot(px - x, py - y);
      if (distance < first) {
        second = first;
        first = distance;
        tone = grain(kx + 91, ky + seed * 7);
      } else if (distance < second) second = distance;
    }
  }
  return { nearest: first, edge: second - first, tone };
}
