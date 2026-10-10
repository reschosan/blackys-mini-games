import type { Rect } from './mapConfig';

export interface Aabb {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface Body {
  x: number;
  z: number;
  velocityX: number;
  velocityZ: number;
}

export interface Contact {
  readonly normalX: number;
  readonly normalZ: number;
  readonly penetration: number;
}

export function rectToAabb(rect: Rect): Aabb {
  return {
    minX: rect.x - rect.width / 2,
    maxX: rect.x + rect.width / 2,
    minZ: rect.z - rect.depth / 2,
    maxZ: rect.z + rect.depth / 2,
  };
}

/** Inside the rect, or within `margin` of it. */
export function isInsideRect(rect: Rect, x: number, z: number, margin = 0): boolean {
  const aabb = rectToAabb(rect);
  return x >= aabb.minX - margin && x <= aabb.maxX + margin && z >= aabb.minZ - margin && z <= aabb.maxZ + margin;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function contactFromInside(x: number, z: number, radius: number, aabb: Aabb): Contact {
  const distances = [
    { normalX: -1, normalZ: 0, depth: x - aabb.minX },
    { normalX: 1, normalZ: 0, depth: aabb.maxX - x },
    { normalX: 0, normalZ: -1, depth: z - aabb.minZ },
    { normalX: 0, normalZ: 1, depth: aabb.maxZ - z },
  ];
  const nearest = distances.reduce((best, current) => (current.depth < best.depth ? current : best));
  return { normalX: nearest.normalX, normalZ: nearest.normalZ, penetration: nearest.depth + radius };
}

export function circleVsAabb(x: number, z: number, radius: number, aabb: Aabb): Contact | null {
  const closestX = clamp(x, aabb.minX, aabb.maxX);
  const closestZ = clamp(z, aabb.minZ, aabb.maxZ);
  const offsetX = x - closestX;
  const offsetZ = z - closestZ;
  const distanceSquared = offsetX * offsetX + offsetZ * offsetZ;

  if (distanceSquared === 0) return contactFromInside(x, z, radius, aabb);
  if (distanceSquared >= radius * radius) return null;

  const distance = Math.sqrt(distanceSquared);
  return {
    normalX: offsetX / distance,
    normalZ: offsetZ / distance,
    penetration: radius - distance,
  };
}

function resolveContact(body: Body, contact: Contact, restitution: number): void {
  body.x += contact.normalX * contact.penetration;
  body.z += contact.normalZ * contact.penetration;

  const velocityAlongNormal = body.velocityX * contact.normalX + body.velocityZ * contact.normalZ;
  if (velocityAlongNormal >= 0) return;

  const impulse = velocityAlongNormal * (1 + restitution);
  body.velocityX -= contact.normalX * impulse;
  body.velocityZ -= contact.normalZ * impulse;
}

export function resolveBodyVsRects(body: Body, radius: number, rects: readonly Rect[], restitution: number): boolean {
  let collided = false;
  for (let pass = 0; pass < 4; pass += 1) {
    let adjusted = false;
    for (const rect of rects) {
      const contact = circleVsAabb(body.x, body.z, radius, rectToAabb(rect));
      if (!contact || contact.penetration < 1e-7) continue;
      resolveContact(body, contact, restitution);
      adjusted = true;
    }
    collided ||= adjusted;
    if (!adjusted) break;
  }
  return collided;
}

export function resolveBodyVsBody(first: Body, second: Body, radius: number, pushApart: number, speedLoss: number): boolean {
  const offsetX = second.x - first.x;
  const offsetZ = second.z - first.z;
  const distanceSquared = offsetX * offsetX + offsetZ * offsetZ;
  const minDistance = radius * 2;
  if (distanceSquared >= minDistance * minDistance || distanceSquared === 0) return false;

  const distance = Math.sqrt(distanceSquared);
  const normalX = offsetX / distance;
  const normalZ = offsetZ / distance;
  const overlap = (minDistance - distance) / 2;

  first.x -= normalX * overlap;
  first.z -= normalZ * overlap;
  second.x += normalX * overlap;
  second.z += normalZ * overlap;

  const relativeSpeed = (second.velocityX - first.velocityX) * normalX + (second.velocityZ - first.velocityZ) * normalZ;
  if (relativeSpeed < 0) {
    const impulse = relativeSpeed * pushApart;
    first.velocityX += normalX * impulse;
    first.velocityZ += normalZ * impulse;
    second.velocityX -= normalX * impulse;
    second.velocityZ -= normalZ * impulse;
  }

  for (const body of [first, second]) {
    body.velocityX *= 1 - speedLoss;
    body.velocityZ *= 1 - speedLoss;
  }
  return true;
}
