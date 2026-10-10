import { fbm, grain, voronoi } from './noise';

/** The brightness (0..1) of one pixel of a pattern; the material colour tints it. */
export type ToneFunction = (x: number, y: number, size: number) => number;

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

/** Dark patches and pale chips in a grey mix. */
export const asphalt: ToneFunction = (x, y, size) => {
  const chip = grain(x, y);
  if (chip > 0.985) return 0.95;
  return 0.58 + fbm(x, y, size, 4) * 0.2 + chip * 0.16;
};

/** A smooth wall with soft clouds. */
export const plaster: ToneFunction = (x, y, size) => 0.84 + fbm(x, y, size, 3) * 0.12 + grain(x, y) * 0.04;

/** Patchy lawn with short blades. */
export const grass: ToneFunction = (x, y, size) => {
  const blade = grain(x, Math.floor(y / 5) + x * 3) * 0.16;
  return 0.5 + fbm(x, y, size, 5) * 0.3 + blade;
};

/** Lawn mowed in stripes, like a football pitch. */
export const turf: ToneFunction = (x, y, size) => {
  const stripe = Math.floor((x / size) * 4) % 2 === 0 ? 0.08 : 0;
  return grass(x, y, size) * 0.85 + stripe;
};

/** Fine sand with ripples. */
export const sand: ToneFunction = (x, y, size) => {
  const ripple = Math.sin((y / size) * Math.PI * 2 * 9 + fbm(x, y, size, 3) * 6) * 0.04;
  return 0.78 + fbm(x, y, size, 6) * 0.12 + ripple + grain(x, y) * 0.06;
};

/** Grey moon dust with dark pebbles. */
export const regolith: ToneFunction = (x, y, size) => {
  if (grain(x, y) > 0.985) return 0.3;
  return 0.5 + fbm(x, y, size, 3) * 0.32 + grain(x, y) * 0.12;
};

/** Rounded stones of different shades with dark joints. */
export const cobble: ToneFunction = (x, y, size) => {
  const stone = voronoi(x, y, size, 7);
  if (stone.edge < 2.2) return 0.32;
  const rounded = Math.min(stone.edge / 10, 1) * 0.1;
  return 0.6 + stone.tone * 0.22 + rounded + grain(x, y) * 0.06;
};

/** Rectangular stones in a running bond, each a little different, with bevelled joints. */
export const pavers: ToneFunction = (x, y, size) => {
  const stone = size / 4;
  const row = Math.floor(y / stone);
  const shiftedX = x + ((row % 2) * stone) / 2;
  const jointX = shiftedX % stone;
  const jointY = y % stone;
  const toJoint = Math.min(jointX, stone - jointX, jointY, stone - jointY);
  if (toJoint < 2) return 0.45;
  const bevel = toJoint < 5 ? -0.06 : 0;
  return 0.78 + grain(Math.floor(shiftedX / stone), row) * 0.12 + fbm(x, y, size, 6) * 0.1 + bevel;
};

/** Dark crust broken by glowing cracks. */
export const lava: ToneFunction = (x, y, size) => {
  const crust = voronoi(x, y, size, 6, 3);
  if (crust.edge < 3) return clamp01(1 - crust.edge * 0.08);
  return 0.18 + crust.tone * 0.12 + fbm(x, y, size, 5) * 0.18;
};

/** Short fibres with a soft nap. */
export const carpet: ToneFunction = (x, y, size) => 0.66 + grain(x, y) * 0.18 + fbm(x, y, size, 8, 3) * 0.14;
