import { HEADING_NORTH, type MapConfig } from '../shared/mapConfig';
import { SPACE_BARRIERS, SPACE_BOUNDARIES, SPACE_ROOM, SPACE_SURFACES, SPACE_WAYPOINTS, SPACE_WIDTH } from './course';
import { SPACE_MAP } from './settings';
import { configFieldsFromSettings } from '../shared/mapSettings';
import { withMapPlacements } from '../shared/mapPlacements';

export const SPACE: MapConfig = withMapPlacements(
  {
    ...configFieldsFromSettings(SPACE_MAP),
    kind: 'space',
    room: SPACE_ROOM,
    wallHeight: 1.6,
    wallThickness: 2,
    driveableSurfaces: SPACE_SURFACES,
    driveableWidth: SPACE_WIDTH,
    walls: [...SPACE_BOUNDARIES, ...SPACE_BARRIERS],
    obstacles: [],
    checkpoints: [
      { ax: 207, az: 40, bx: 233, bz: 40, name: 'Startrampe' },
      { ax: 5, az: -112, bx: 5, bz: -138, name: 'Asteroidenfeld' },
      { ax: -95, az: 22, bx: -95, bz: 48, name: 'Mondkrater' },
      { ax: 55, az: 112, bx: 55, bz: 138, name: 'Sternwarte' },
    ],
    waypoints: SPACE_WAYPOINTS,
    aiGuideSpacing: { preferred: 2.5, minimum: 1.25, obstacleClearance: 3 },
    followCamera: { pitchDegrees: 20, thirdPersonDistance: 24 },
    startPositions: [
      { x: 214, z: 75, yaw: HEADING_NORTH },
      { x: 226, z: 75, yaw: HEADING_NORTH },
      { x: 214, z: 88, yaw: HEADING_NORTH },
      { x: 226, z: 88, yaw: HEADING_NORTH },
    ],
  },
  SPACE_MAP.placements,
);
