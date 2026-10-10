import type { ModeTuning } from '../../../../shared/config/modes';
import type { SurfacePattern } from '../../../../shared/effects/surfaceTextures';
import type { SceneryThemeId } from '../../../../shared/effects/surroundings';
import { buildWalls, type MapConfig, type Rect } from '../../maps/shared/mapConfig';

/** The ground a game on the kart engine is played on when it is not one of the race maps. */
export type ArenaKind = 'platform' | 'tiles' | 'walled' | 'field';

const SEATS = 8;
const WALL_THICKNESS = 1.5;
const MARGIN = 30;
const GOAL_DEPTH = 6;

interface ArenaShape {
  readonly name: string;
  readonly width: number;
  readonly depth: number;
  readonly walled: boolean;
  readonly starts: MapConfig['startPositions'];
  /** Item boxes on a ring around the middle, none for a game without items. */
  readonly itemBoxes: MapConfig['itemBoxes'];
  /** A football field has an opening for a goal in the middle of both end walls, and slanted corners. */
  readonly goal?: { readonly width: number; readonly cornerSize: number };
}

const BOX_COUNT = 4;

/** Item boxes on a ring, turned by half a seat so that they do not lie where the karts start. */
function ringBoxes(radius: number): MapConfig['itemBoxes'] {
  return Array.from({ length: BOX_COUNT }, (_, box) => {
    const angle = ((box + 0.5) / BOX_COUNT) * Math.PI * 2;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
  });
}

/** Start seats on a ring around the middle, every kart facing it. */
function ringStarts(radius: number): MapConfig['startPositions'] {
  return Array.from({ length: SEATS }, (_, seat) => {
    const angle = (seat / SEATS) * Math.PI * 2;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, yaw: angle + Math.PI };
  });
}

/** The walls of a football field: the end walls leave the goal mouth open, and a box behind it catches the ball and the karts. */
function fieldWalls(room: Rect, goalWidth: number, cornerSize: number): readonly Rect[] {
  const [top, bottom] = buildWalls(room, WALL_THICKNESS);
  const halfWidth = room.width / 2;
  const block = cornerSize / 2;
  const corners = [-1, 1].flatMap((sideX) =>
    [-1, 1].map((sideZ) => ({
      x: sideX * (halfWidth - block / 2),
      z: sideZ * (room.depth / 2 - block / 2),
      width: block,
      depth: block,
    })),
  );
  const segment = (room.depth - goalWidth) / 2;
  const sides = [-1, 1].flatMap((side) => [
    { x: side * halfWidth, z: -(goalWidth + segment) / 2, width: WALL_THICKNESS, depth: segment },
    { x: side * halfWidth, z: (goalWidth + segment) / 2, width: WALL_THICKNESS, depth: segment },
    { x: side * (halfWidth + GOAL_DEPTH), z: 0, width: WALL_THICKNESS, depth: goalWidth + WALL_THICKNESS },
    { x: side * (halfWidth + GOAL_DEPTH / 2), z: -goalWidth / 2, width: GOAL_DEPTH, depth: WALL_THICKNESS },
    { x: side * (halfWidth + GOAL_DEPTH / 2), z: goalWidth / 2, width: GOAL_DEPTH, depth: WALL_THICKNESS },
  ]);
  return [top!, bottom!, ...sides, ...(cornerSize > 0 ? corners : [])];
}

/** Team red (even seats) starts on the left facing right, team blue on the right facing left. */
function fieldStarts(width: number): MapConfig['startPositions'] {
  return Array.from({ length: SEATS }, (_, seat) => {
    const team = seat % 2;
    const row = Math.floor(seat / 2);
    return { x: (team === 0 ? -1 : 1) * width * 0.28, z: (row - 1.5) * 14, yaw: team === 0 ? 0 : Math.PI };
  });
}

function shapeOf(kind: ArenaKind, tuning: ModeTuning): ArenaShape {
  switch (kind) {
    case 'platform': {
      const size = (tuning.sumo.platformRadius + MARGIN) * 2;
      return {
        name: 'Sumo-Plattform',
        width: size,
        depth: size,
        walled: false,
        starts: ringStarts(tuning.sumo.platformRadius * 0.6),
        itemBoxes: ringBoxes(tuning.sumo.platformRadius * 0.3),
      };
    }
    case 'tiles': {
      const size = tuning.lava.tilesPerSide * tuning.lava.tileSize + MARGIN * 2;
      return {
        name: 'Lavaboden',
        width: size,
        depth: size,
        walled: false,
        starts: ringStarts(tuning.lava.tilesPerSide * tuning.lava.tileSize * 0.28),
        itemBoxes: [],
      };
    }
    case 'walled':
      return {
        name: 'Fangen-Arena',
        width: tuning.tag.arenaSize,
        depth: tuning.tag.arenaSize,
        walled: true,
        starts: ringStarts(tuning.tag.arenaSize * 0.3),
        itemBoxes: ringBoxes(tuning.tag.arenaSize * 0.15),
      };
    case 'field':
      return {
        name: 'Fußballfeld',
        width: tuning.soccer.fieldWidth,
        depth: tuning.soccer.fieldDepth,
        walled: true,
        starts: fieldStarts(tuning.soccer.fieldWidth),
        itemBoxes: ringBoxes(tuning.soccer.fieldDepth * 0.3),
        goal: { width: tuning.soccer.goalWidth, cornerSize: tuning.soccer.cornerSize },
      };
  }
}

/** The race camera (20°) in every arena but the sumo platform (tag, lava floor, football); a bit steeper and further back where the edge must stay in view (sumo). */
const CAMERAS: Readonly<Record<ArenaKind, NonNullable<MapConfig['followCamera']>>> = {
  platform: { pitchDegrees: 32, thirdPersonDistance: 30 },
  tiles: { pitchDegrees: 20, thirdPersonDistance: 24 },
  walled: { pitchDegrees: 20, thirdPersonDistance: 24 },
  field: { pitchDegrees: 20, thirdPersonDistance: 24 },
};

/** The ground of each arena: steel under the sumo platform, glowing lava under the tiles (where a tile is gone, the lava shows), a wooden floor for tag, a mowed pitch for football. */
const GROUNDS: Readonly<Record<ArenaKind, { readonly pattern: SurfacePattern; readonly tint: number }>> = {
  platform: { pattern: 'plating', tint: 0x7d8597 },
  tiles: { pattern: 'lava', tint: 0xff6a1a },
  walled: { pattern: 'planks', tint: 0xc9a27a },
  field: { pattern: 'turf', tint: 0x6fb35a },
};

const SCENERY: Readonly<Record<ArenaKind, SceneryThemeId>> = { platform: 'nature', tiles: 'town', walled: 'farm', field: 'nature' };

const cache = new Map<string, MapConfig>();

function wallsOf(shape: ArenaShape, room: Rect): readonly Rect[] {
  if (!shape.walled) return [];
  return shape.goal === undefined ? buildWalls(room, WALL_THICKNESS) : fieldWalls(room, shape.goal.width, shape.goal.cornerSize);
}

/** The arena for a kind and its sizes; the same sizes give the same object, so playing again does not rebuild the scene. */
export function createArenaMap(kind: ArenaKind, tuning: ModeTuning): MapConfig {
  const shape = shapeOf(kind, tuning);
  const key = `${kind}:${shape.width}x${shape.depth}:${shape.starts[0]!.x.toFixed(2)}:${shape.goal?.width ?? 0}:${shape.goal?.cornerSize ?? 0}`;
  const known = cache.get(key);
  if (known) return known;
  const room: Rect = { x: 0, z: 0, width: shape.width, depth: shape.depth };
  const map: MapConfig = {
    kind: 'arena',
    name: shape.name,
    skyColor: 0x14161c,
    room,
    wallHeight: 3,
    wallThickness: WALL_THICKNESS,
    carpet: { island: { x: 0, z: 0, width: 1, depth: 1 }, routeWidth: 1 },
    walls: wallsOf(shape, room),
    obstacles: [],
    checkpoints: [],
    waypoints: [],
    startPositions: shape.starts,
    itemBoxes: shape.itemBoxes,
    followCamera: CAMERAS[kind],
    groundPattern: GROUNDS[kind].pattern,
    groundTint: GROUNDS[kind].tint,
    hideGroundGrid: kind === 'field',
    scenery: SCENERY[kind],
  };
  cache.set(key, map);
  return map;
}
