import type { SurfacePattern } from '../../../../shared/effects/surfaceTextures';
import type { SceneryThemeId } from '../../../../shared/effects/surroundings';
import type { SurfaceKind } from '../../../../shared/config/surfaces';
import type { ItemOverrides } from '../../../../shared/config/items';
import type { MapItemLooks } from '../../../../shared/config/itemLooks';
import type { ItemType } from '../../../../shared/config/items';

export interface Rect {
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
}

interface Obstacle {
  readonly name: string;
  readonly rect: Rect;
  readonly height: number;
}

export interface Gate {
  readonly ax: number;
  readonly az: number;
  readonly bx: number;
  readonly bz: number;
  readonly levelId?: string;
  readonly routeNodeIndex?: number;
  readonly name?: string;
}

interface StartPosition {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly levelId?: string;
}

interface CarpetRing {
  readonly island: Rect;
  readonly routeWidth: number;
}

export interface ItemBoxSpawn {
  readonly x: number;
  readonly z: number;
  readonly levelId?: string;
  readonly heightOffset?: number;
  readonly item?: ItemType;
  readonly jumpId?: string;
  readonly boostSeconds?: number;
}

export interface Ramp {
  readonly rect: Rect;
  readonly fromHeight: number;
  readonly toHeight: number;
  readonly axis: 'x' | 'z';
}

export interface MapRoom {
  readonly name: string;
  readonly rect: Rect;
  readonly levelId?: string;
  readonly floorHeight?: number;
  readonly accentColor: number;
}

export interface MapLevel {
  readonly id: string;
  readonly placementLevel?: number;
  readonly name: string;
  readonly floorHeight: number;
  readonly ceilingHeight: number;
  readonly collisionRects: readonly Rect[];
  readonly wallRects?: readonly Rect[];
  readonly modelSource?: { readonly centreX: number; readonly floorY: number; readonly minX: number; readonly maxX: number };
  readonly driveableSurfaces?: readonly Rect[];
  readonly modelCutouts?: readonly { readonly rect: Rect; readonly minHeight: number; readonly maxHeight: number }[];
}

interface Doorway {
  readonly name: string;
  readonly fromRoom: string;
  readonly toRoom: string;
  readonly levelId: string;
  readonly gate: Gate;
}

export interface StairTransition {
  readonly name: string;
  readonly fromLevelId: string;
  readonly toLevelId: string;
  readonly rect: Rect;
  readonly fromHeight: number;
  readonly toHeight: number;
  readonly axis: 'x' | 'z';
  readonly toAt: 'min' | 'max';
  readonly sideWalls?: readonly Rect[];
}

export interface RouteNode {
  readonly x: number;
  readonly z: number;
  readonly levelId: string;
}

/** A route point that exists and lies on the level: the pieces of a route never reach across floors. */
export function isOnLevel<Point extends { readonly levelId: string }>(point: Point | undefined, levelId: string): point is Point {
  return point?.levelId === levelId;
}

export interface WindowJump {
  readonly id: string;
  readonly name: string;
  readonly launchRect: Rect;
  readonly landingRect: Rect;
  readonly levelId: string;
  readonly landingLevelId: string;
  readonly minimumSpeed: number;
  readonly durationSeconds: number;
  readonly peakHeight: number;
  readonly airControlPerSecond: number;
  readonly penaltySeconds: number;
  readonly recovery: StartPosition;
  readonly launchYaw?: number;
  readonly takeoffOffset?: number;
  readonly optional?: boolean;
  readonly rampLength?: number;
  readonly rampHeight?: number;
  readonly hasItem?: boolean;
}

export type MapKind = 'house' | 'nature' | 'space' | 'farm' | 'town' | 'city' | 'arena';

/** A patch of ground with its own driving feel (mud, ice, tiles, a rug, a puddle). */
export interface SurfaceZone {
  readonly kind: SurfaceKind;
  readonly rect: Rect;
  readonly levelId: string;
}

export interface ShoulderSettings {
  readonly widthFraction: number;
  readonly speedFactor: number;
}

export interface OffroadSettings {
  readonly speedFactor: number;
  readonly accelerationFactor: number;
}

export interface ItemBoxLook {
  readonly color: number;
  readonly size: number;
  readonly spinSpeed: number;
}

/** The light of a map: a sky/ground hemisphere and a sun (or moon). Maps without it use the daylight default. */
export interface MapLighting {
  readonly hemisphereSky: number;
  readonly hemisphereGround: number;
  readonly hemisphereIntensity: number;
  readonly sunColor: number;
  readonly sunIntensity: number;
}

export interface MapConfig {
  /** Selects the renderer; maps without a kind are headless (tests) and have no scene. */
  readonly kind?: MapKind;
  readonly skyColor?: number;
  readonly lighting?: MapLighting;
  readonly shoulder?: ShoulderSettings;
  readonly offroad?: OffroadSettings;
  readonly itemBoxLook?: ItemBoxLook;
  readonly itemOverrides?: ItemOverrides;
  /** The map-specific items (yarn, vacuum, gravity, cowpat) that may appear in this map's item boxes. */
  readonly mapItems?: readonly ItemType[];
  /** Names of items on this map where they differ from the default (the same item can be a ball of yarn here and a hay bale there). */
  /** How the map items look on this map where they differ from the default. */
  readonly itemLooks?: MapItemLooks;
  readonly itemNames?: Readonly<Partial<Record<ItemType, string>>>;
  readonly aiPaceFactors?: Readonly<Record<'easy' | 'medium' | 'hard', number>>;
  /** How far (metres) from the centreline an AI kart may be before it counts as off course; maps with a wide course
   *  set about half its width so fast karts swinging through corners are not sent back to the line. */
  readonly aiOffCourseMeters?: number;
  readonly name: string;
  readonly room: Rect;
  readonly wallHeight: number;
  readonly wallThickness: number;
  readonly carpet: CarpetRing;
  readonly obstacles: readonly Obstacle[];
  readonly walls: readonly Rect[];
  readonly checkpoints: readonly Gate[];
  readonly waypoints: readonly { readonly x: number; readonly z: number }[];
  readonly startPositions: readonly StartPosition[];
  readonly itemBoxes: readonly ItemBoxSpawn[];
  /** The texture of the ground of an arena (arenas only). */
  readonly groundPattern?: SurfacePattern;
  /** The colour the ground texture is tinted with (arenas only). */
  readonly groundTint?: number;
  /** A football field has its own lines; the faint speed grid of the other arenas stays off it (arenas only). */
  readonly hideGroundGrid?: boolean;
  /** What stands around an arena (arenas only): trees and rocks, houses or farm buildings from the packs of the maps. */
  readonly scenery?: SceneryThemeId;
  readonly surfaceZones?: readonly SurfaceZone[];
  readonly boostFields?: readonly {
    readonly id: string;
    readonly rect: Rect;
    readonly levelId: string;
    readonly durationSeconds: number;
    readonly yaw: number;
  }[];
  /** Optional route surfaces for authored maps that are not a carpet ring. */
  readonly driveableSurfaces?: readonly Rect[];
  /** Width of the narrowest intended route segment, used by validation and pickup reachability. */
  readonly driveableWidth?: number;
  /** Cosmetic elevations only. The deterministic kart simulation remains projected onto x/z. */
  readonly ramps?: readonly Ramp[];
  readonly levels?: readonly MapLevel[];
  readonly namedRooms?: readonly MapRoom[];
  readonly doorways?: readonly Doorway[];
  readonly stairTransitions?: readonly StairTransition[];
  readonly routeNodes?: readonly RouteNode[];
  /** Preferred and narrow-passage spacing between neighboring AI guide lines, in metres, and the
   *  extra distance the lines keep from obstacles beyond the kart's own radius (0 if omitted). */
  readonly aiGuideSpacing?: { readonly preferred: number; readonly minimum: number; readonly obstacleClearance?: number };
  readonly routeBanks?: {
    readonly flatHalfWidth: number;
    readonly width: number;
    readonly height: number;
    readonly wallHeight: number;
    readonly wallThickness: number;
    readonly gridSize: number;
  };
  readonly routeDividers?: readonly { readonly levelId: string; readonly rect: Rect }[];
  readonly followCamera?: { pitchDegrees: number; thirdPersonDistance: number; occlusionPadding?: number; minimumClearance?: number };
  readonly closedCeilings?: boolean;
  readonly windowJumps?: readonly WindowJump[];
  readonly jumpMarkings?: { readonly approachLength: number; readonly stripeSpacing: number; readonly stripeDepth: number; readonly color: number };
  readonly routeAi?: { readonly reachDistance: number; readonly speedFactor: number; readonly cornerSpeed: number; readonly brakingMargin: number };
  readonly routeMarkings?: {
    readonly edgeWidth: number;
    readonly cornerRadius: number;
    readonly arrowSize: number;
    readonly arrowSpacing: number;
    readonly lookAheadDistance: number;
    readonly fadeDistance: number;
  };
  /** Point-to-point maps use their final gate unless a positional finishArea is configured. */
  readonly raceFormat?: 'laps' | 'pointToPoint';
  readonly finishArea?: { readonly rect: Rect; readonly levelId: string };
  readonly lapCount?: number;
}

/** The four outer walls of a room, as thin rects along each edge. Shared by every map: a ring
 *  map is always a rectangular room with a rectangular island in the middle (see `CarpetRing`),
 *  so this geometry never needs to vary per map. */
export function buildWalls(room: Rect, thickness: number): readonly Rect[] {
  const halfWidth = room.width / 2;
  const halfDepth = room.depth / 2;
  return [
    { x: room.x, z: room.z - halfDepth, width: room.width, depth: thickness },
    { x: room.x, z: room.z + halfDepth, width: room.width, depth: thickness },
    { x: room.x - halfWidth, z: room.z, width: thickness, depth: room.depth },
    { x: room.x + halfWidth, z: room.z, width: thickness, depth: room.depth },
  ];
}

export const HEADING_NORTH = -Math.PI / 2;
