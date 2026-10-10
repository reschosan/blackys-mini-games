import type { ToneFunction } from './groundPatterns';
import { fbm, grain } from './noise';

/** Wooden floor boards with staggered ends, gaps and grain. */
export const planks: ToneFunction = (x, y, size) => {
  const board = size / 4;
  const column = Math.floor(x / board);
  const length = size / 2;
  const shiftedY = y + grain(column, 3) * length;
  const across = x % board;
  if (across < 2 || shiftedY % length < 2) return 0.3;
  const piece = Math.floor(shiftedY / length);
  const rings = Math.sin((x + fbm(x, y, size, 3, 3, column) * 30) * 0.45) * 0.06;
  return 0.66 + grain(column, piece) * 0.16 + rings + fbm(x, y, size, 6) * 0.08;
};

/** Glazed square tiles with light grout. */
export const tiles: ToneFunction = (x, y, size) => {
  const tile = size / 4;
  const toJoint = Math.min(x % tile, tile - (x % tile), y % tile, tile - (y % tile));
  if (toJoint < 2.5) return 0.72;
  const shine = toJoint > 6 ? 0.04 : 0;
  return 0.86 + grain(Math.floor(x / tile), Math.floor(y / tile)) * 0.06 + fbm(x, y, size, 4, 2) * 0.05 + shine;
};

/** Bricks in a running bond with light mortar. */
export const brick: ToneFunction = (x, y, size) => {
  const height = size / 8;
  const width = size / 4;
  const row = Math.floor(y / height);
  const shiftedX = x + ((row % 2) * width) / 2;
  if (y % height < 2 || shiftedX % width < 2) return 0.86;
  return 0.48 + grain(Math.floor(shiftedX / width), row) * 0.2 + fbm(x, y, size, 8, 3) * 0.14 + grain(x, y) * 0.06;
};

/** Long fibres running down. */
export const bark: ToneFunction = (x, y, size) =>
  0.46 + grain(Math.floor(x / 3), Math.floor(y / 40)) * 0.34 + fbm(x, y, size, 4, 3) * 0.12 + grain(x, y) * 0.08;

/** Metal floor plates with seams and rivets. */
export const plating: ToneFunction = (x, y, size) => {
  const cell = size / 4;
  const cellX = x % cell;
  const cellY = y % cell;
  if (cellX < 2 || cellY < 2) return 0.42;
  const nearCorner = Math.min(cellX, cell - cellX) < 8 && Math.min(cellY, cell - cellY) < 8;
  if (nearCorner && Math.hypot(Math.min(cellX, cell - cellX) - 5, Math.min(cellY, cell - cellY) - 5) < 2) return 0.3;
  return 0.68 + fbm(x, y, size, 6, 3) * 0.12 + grain(x, y) * 0.06;
};

/** Panels of a space station with a stripe. */
export const hull: ToneFunction = (x, y, size) => {
  const half = size / 2;
  if (x % half < 2 || y % half < 2) return 0.45;
  if (y > size * 0.4 && y < size * 0.48) return 0.62;
  return 0.76 + fbm(x, y, size, 4, 3) * 0.1 + grain(x, y) * 0.04;
};

/** Diagonal warning stripes, a little worn. */
export const hazard: ToneFunction = (x, y, size) => {
  const stripe = (x + y) % (size / 4) < size / 8;
  const wear = fbm(x, y, size, 8, 3) > 0.72 ? 0.25 : 0;
  return stripe ? 1 - wear : 0.1 + wear * 0.4;
};

/** Tyre rubber with tread grooves across (around a wheel they show it turning). */
export const rubber: ToneFunction = (x, y, size) => {
  const groove = x % (size / 8) < size / 32;
  return groove ? 0.35 : 0.72 + grain(x, y) * 0.08;
};

/** Lacquer with a soft sheen and a few fine scratches. */
export const paint: ToneFunction = (x, y, size) => {
  const scratch = grain(Math.floor((x + y * 0.3) / 2), Math.floor(y / 24)) > 0.985 ? 0.08 : 0;
  return 0.9 + fbm(x, y, size, 3, 3) * 0.08 + scratch;
};

/** Woven cloth: one thread every four pixels. */
export const fabric: ToneFunction = (x, y, size) => {
  const threads = size / 4;
  const weave = Math.sin((x / size) * Math.PI * 2 * threads) * Math.sin((y / size) * Math.PI * 2 * threads);
  return 0.82 + weave * 0.08 + grain(x, y) * 0.06;
};
