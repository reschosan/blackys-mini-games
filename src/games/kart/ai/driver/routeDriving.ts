import { NEUTRAL_INPUT, type InputFrame } from '../../../../shared/input/actions';
import { forwardSpeedOf, type KartState } from '../../kart/kartState';
import { isOnLevel, type MapConfig } from '../../maps/shared/mapConfig';
import { aiGuideLine } from '../aiGuideLine';
import type { AiDriveContext, AiDriverState, MapPoint2D } from './driverTypes';
import { recoverBankedRoute, repositionTowardTarget } from './recovery';
import { clamp, normalizeAngle } from './steeringMath';

type RouteNode = { readonly x: number; readonly z: number; readonly levelId: string };

function reachedOrPassedRouteNode(nodes: readonly RouteNode[], index: number, state: KartState, reachDistance: number, lateralTolerance: number): boolean {
  const target = nodes[index]!;
  if (Math.hypot(target.x - state.x, target.z - state.z) <= reachDistance) return true;
  const previous = nodes[index - 1];
  if (!previous || previous.levelId !== target.levelId || target.levelId !== state.levelId) return false;
  const dx = target.x - previous.x;
  const dz = target.z - previous.z;
  const length = Math.hypot(dx, dz);
  if (length === 0) return false;
  const beyond = (state.x - target.x) * dx + (state.z - target.z) * dz;
  const lateral = Math.abs((state.x - target.x) * dz - (state.z - target.z) * dx) / length;
  return beyond > 0 && lateral <= lateralTolerance;
}

function skipFirstNodeWhenAlreadyThere(nodes: readonly RouteNode[], state: KartState, aiState: AiDriverState): void {
  const first = nodes[0];
  if (aiState.routeNodeIndex === 0 && first?.levelId === state.levelId && Math.hypot(first.x - state.x, first.z - state.z) < 10) aiState.routeNodeIndex = 1;
}

function isNodeReached(map: MapConfig, nodes: readonly RouteNode[], index: number, state: KartState, reachDistance: number): boolean {
  const target = nodes[index];
  const next = nodes[index + 1];
  const matchesLevel = target?.levelId === state.levelId || next?.levelId === state.levelId;
  if (!target || !matchesLevel) return false;
  return reachedOrPassedRouteNode(nodes, index, state, reachDistance, Math.max(reachDistance * 2, map.driveableWidth));
}

/** Advances the route node once it is reached or passed, and returns the node to aim for. */
function routeTarget(map: MapConfig, state: KartState, aiState: AiDriverState): MapPoint2D | null {
  const nodes = aiGuideLine(map, aiState.guideSlot).points;
  if (!nodes || nodes.length === 0) return null;
  const reachDistance = Math.max(map.routeAi?.reachDistance ?? 4, forwardSpeedOf(state) < 3 ? 2.5 : 0);
  skipFirstNodeWhenAlreadyThere(nodes, state, aiState);
  while (aiState.routeNodeIndex < nodes.length - 1 && isNodeReached(map, nodes, aiState.routeNodeIndex, state, reachDistance)) aiState.routeNodeIndex += 1;
  const target = nodes[aiState.routeNodeIndex] ?? nodes[nodes.length - 1];
  return target ? { x: target.x, z: target.z } : null;
}

function routeSteeringTarget(map: MapConfig, state: KartState, aiState: AiDriverState, lookahead: number): MapPoint2D | null {
  const nodes = aiGuideLine(map, aiState.guideSlot).points;
  const from = nodes[aiState.routeNodeIndex - 1];
  const to = nodes[aiState.routeNodeIndex];
  if (!isOnLevel(from, state.levelId) || !isOnLevel(to, state.levelId)) return null;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.01) return to;
  const along = clamp(((state.x - from.x) * dx + (state.z - from.z) * dz) / length, 0, length);
  const ahead = along + lookahead;
  if (ahead <= length) return { x: from.x + (dx * ahead) / length, z: from.z + (dz * ahead) / length };
  const next = nodes[aiState.routeNodeIndex + 1];
  if (!isOnLevel(next, state.levelId)) return to;
  const nextDx = next.x - to.x;
  const nextDz = next.z - to.z;
  const nextLength = Math.hypot(nextDx, nextDz);
  if (nextLength < 0.01) return to;
  const fraction = Math.min((ahead - length) / nextLength, 1);
  return { x: to.x + nextDx * fraction, z: to.z + nextDz * fraction };
}

function routeRejoinTarget(map: MapConfig, state: KartState, aiState: AiDriverState): (MapPoint2D & { readonly distance: number }) | null {
  const nodes = aiGuideLine(map, aiState.guideSlot).points;
  const from = nodes[aiState.routeNodeIndex - 1];
  const to = nodes[aiState.routeNodeIndex];
  if (!isOnLevel(from, state.levelId) || !isOnLevel(to, state.levelId)) return null;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared === 0 ? 1 : clamp(((state.x - from.x) * dx + (state.z - from.z) * dz) / lengthSquared, 0, 1);
  const x = from.x + dx * t;
  const z = from.z + dz * t;
  const target = routeSteeringTarget(map, state, aiState, Math.max(6, forwardSpeedOf(state) * 0.5)) ?? { x, z };
  return { ...target, distance: Math.hypot(x - state.x, z - state.z) };
}

const FOLLOW_MAX_HEADING_DIFFERENCE = 0.7;
const FOLLOW_MAX_AHEAD_METERS = 8;
const FOLLOW_MAX_LATERAL_METERS = 2.2;

function isFollowedKart(other: MapPoint2D, state: KartState, guideSlot: number): boolean {
  if (other.guideSlot !== undefined && other.guideSlot >= guideSlot) return false;
  return other.yaw === undefined || Math.abs(normalizeAngle(other.yaw - state.yaw)) <= FOLLOW_MAX_HEADING_DIFFERENCE;
}

/** Speed cap for following `other`; unlimited while it is not close enough ahead in the same lane. */
function followCapBehind(other: MapPoint2D, state: KartState): number {
  const forwardX = Math.cos(state.yaw);
  const forwardZ = Math.sin(state.yaw);
  const dx = other.x - state.x;
  const dz = other.z - state.z;
  const ahead = dx * forwardX + dz * forwardZ;
  const lateral = Math.abs(dx * -forwardZ + dz * forwardX);
  if (ahead < -1 || ahead > FOLLOW_MAX_AHEAD_METERS || lateral > FOLLOW_MAX_LATERAL_METERS) return Number.POSITIVE_INFINITY;
  return Math.max(0, (ahead - 2) * 4);
}

/** Slows down for a kart ahead on a lower guide slot, so karts sharing a route do not ram each other. */
function routeFollowingCap(state: KartState, context: AiDriveContext): number {
  let cap = Number.POSITIVE_INFINITY;
  for (const other of context.otherKarts) {
    if (isFollowedKart(other, state, context.aiState.guideSlot)) cap = Math.min(cap, followCapBehind(other, state));
  }
  return cap;
}

function routeSpeedCap(context: AiDriveContext, distance: number, boosting: boolean): number {
  const { map, aiState, driving, difficulty } = context;
  const nodes = aiGuideLine(map, aiState.guideSlot).points;
  const target = nodes[aiState.routeNodeIndex];
  const next = nodes[aiState.routeNodeIndex + 1];
  const previous = nodes[Math.max(0, aiState.routeNodeIndex - 1)];
  const topSpeed = driving.maxSpeed * difficulty.topSpeedFactor * (map.routeAi?.speedFactor ?? 1) * (boosting ? driving.boostSpeedFactor : 1);
  if (!target || !next || !previous) return topSpeed;
  const incoming = Math.atan2(target.z - previous.z, target.x - previous.x);
  const outgoing = Math.atan2(next.z - target.z, next.x - target.x);
  const cornerSpeed = Math.max(map.routeAi?.cornerSpeed ?? driving.maxReverseSpeed, topSpeed * Math.cos(normalizeAngle(outgoing - incoming)));
  const brakingDistance = Math.max(0, distance - (map.routeAi?.reachDistance ?? 4) - (map.routeAi?.brakingMargin ?? 0));
  return Math.min(topSpeed, Math.sqrt(cornerSpeed ** 2 + driving.brakeDeceleration * brakingDistance));
}

function windowJumpInput(state: KartState): InputFrame | null {
  return state.windowJumpId === null ? null : { ...NEUTRAL_INPUT, accelerate: true };
}

/** Heads back onto the route when the kart has strayed too far from it. */
function rejoinInput(state: KartState, context: AiDriveContext): InputFrame | null {
  const { map, aiState, difficulty, config } = context;
  const rejoin = routeRejoinTarget(map, state, aiState);
  if (rejoin && rejoin.distance > config.maxLateralOffset) {
    aiState.repositioning = true;
    return repositionTowardTarget(difficulty, state, rejoin, aiState);
  }
  aiState.repositioning = false;
  aiState.repositionGear = null;
  return null;
}

function followRouteInput(state: KartState, context: AiDriveContext, target: MapPoint2D): InputFrame {
  const { map, aiState, difficulty, config } = context;
  const steeringTarget = routeSteeringTarget(map, state, aiState, Math.min(8, Math.max(4, forwardSpeedOf(state) * 0.35))) ?? target;
  const angle = normalizeAngle(Math.atan2(steeringTarget.z - state.z, steeringTarget.x - state.x) - state.yaw);
  const speed = forwardSpeedOf(state);
  const distance = Math.hypot(target.x - state.x, target.z - state.z);
  const speedCap = routeSpeedCap(context, distance, state.boostSeconds > 0) * Math.max(0.23, Math.cos(angle));
  const steer = clamp(angle * difficulty.steerGain, -1, 1);
  const targetSpeed = Math.min(speedCap, routeFollowingCap(state, context));
  const brake = speed > targetSpeed + 1 && speed > config.minBrakeSpeed;
  if (distance < 1 && aiState.routeNodeIndex === (map.routeNodes?.length ?? 0) - 1) return NEUTRAL_INPUT;
  return { ...NEUTRAL_INPUT, steer, accelerate: !brake && speed < targetSpeed, brake };
}

/** Follows the authored route nodes of multi-level courses such as the house. */
export function driveRoute(state: KartState, context: AiDriveContext): InputFrame {
  const target = routeTarget(context.map, state, context.aiState);
  if (!target) return NEUTRAL_INPUT;
  return windowJumpInput(state) ?? recoverBankedRoute(state, context) ?? rejoinInput(state, context) ?? followRouteInput(state, context, target);
}
