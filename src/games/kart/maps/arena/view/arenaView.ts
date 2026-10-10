import * as THREE from 'three';
import { setSurfaceUVs, texturedBoxGeometry, texturedMaterial } from '../../../../../shared/effects/surfaceTextures';
import { sceneryGround, scatterSurroundings } from '../../../../../shared/effects/surroundings';
import type { MapConfig } from '../../shared/mapConfig';

const FLOOR_COLOR = 0x23252e;
const LINE_COLOR = 0x343846;
const LINE_SPACING_METERS = 10;
const TEXTURE_METERS = 8;
const SCENERY_PIECES = 30;
const SCENERY_REACH_METERS = 70;
const OUTER_GROUND_FACTOR = 6;
const FLOOR_TINT = 0xb8bcc8;
const WALL_TINT = 0xc9a98a;

/** The plain ground of the arenas: a dark floor with a faint grid so speed shows, and walls where the arena has them.
 *  What the game puts on it (platform, tiles, goals) is drawn by the mode view. */
export function createArenaView(map: MapConfig): THREE.Group {
  const group = new THREE.Group();
  const { room } = map;
  const floorGeometry = new THREE.PlaneGeometry(room.width, room.depth);
  setSurfaceUVs(floorGeometry, TEXTURE_METERS, true);
  const floor = new THREE.Mesh(
    floorGeometry,
    map.groundPattern ? texturedMaterial(map.groundPattern, map.groundTint ?? FLOOR_TINT) : new THREE.MeshLambertMaterial({ color: FLOOR_COLOR }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(room.x, -0.02, room.z);
  group.add(floor);
  const grid = new THREE.GridHelper(
    Math.max(room.width, room.depth),
    Math.round(Math.max(room.width, room.depth) / LINE_SPACING_METERS),
    LINE_COLOR,
    LINE_COLOR,
  );
  grid.position.set(room.x, 0, room.z);
  grid.visible = map.hideGroundGrid !== true;
  group.add(grid);
  const wallMaterial = texturedMaterial('planks', WALL_TINT);
  for (const wall of map.walls) {
    const mesh = new THREE.Mesh(texturedBoxGeometry(wall.width, map.wallHeight, wall.depth, TEXTURE_METERS / 2), wallMaterial);
    mesh.position.set(wall.x, map.wallHeight / 2, wall.z);
    group.add(mesh);
  }
  if (map.scenery) {
    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(room.width * OUTER_GROUND_FACTOR, room.depth * OUTER_GROUND_FACTOR),
      new THREE.MeshLambertMaterial({ color: sceneryGround(map.scenery) }),
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.set(room.x, -0.08, room.z);
    group.add(
      outer,
      scatterSurroundings(map.scenery, {
        halfWidth: room.width / 2,
        halfDepth: room.depth / 2,
        centreX: room.x,
        centreZ: room.z,
        reach: SCENERY_REACH_METERS,
        count: SCENERY_PIECES,
      }),
    );
  }
  group.userData.disposeResources = (): void => {
    floor.material.map?.dispose();
    floor.material.dispose();
    wallMaterial.dispose();
    grid.dispose();
  };
  return group;
}
