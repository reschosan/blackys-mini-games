import { HEADING_NORTH, type Rect, type MapConfig } from '../shared/mapConfig';
import { NATURE_BOUNDARIES, NATURE_LOGS, NATURE_SURFACES, NATURE_WAYPOINTS, NATURE_WIDTH } from './course';
import { NATURE_MAP } from './settings';
import { configFieldsFromSettings } from '../shared/mapSettings';
import { withMapPlacements } from '../shared/mapPlacements';

const ROOM: Rect = { x: 0, z: 0, width: 540, depth: 420 };

export const NATURE: MapConfig = withMapPlacements(
  {
    ...configFieldsFromSettings(NATURE_MAP),
    kind: 'nature',
    room: ROOM,
    wallHeight: 1.6,
    wallThickness: 2,
    carpet: { island: { x: 0, z: 0, width: 0, depth: 0 }, routeWidth: NATURE_WIDTH },
    driveableSurfaces: NATURE_SURFACES,
    driveableWidth: NATURE_WIDTH,
    walls: [...NATURE_BOUNDARIES, ...NATURE_LOGS],
    obstacles: [],
    checkpoints: [
      { ax: 217, az: 0, bx: 243, bz: 0, name: 'Start/Ziel' },
      { ax: 0, az: -117, bx: 0, bz: -143, name: 'Nordwald' },
      { ax: -217, az: 0, bx: -243, bz: 0, name: 'Felsbogen' },
      { ax: 0, az: 117, bx: 0, bz: 143, name: 'Blumenwiese' },
    ],
    waypoints: NATURE_WAYPOINTS,
    aiGuideSpacing: { preferred: 2.5, minimum: 1.5 },
    followCamera: { pitchDegrees: 20, thirdPersonDistance: 24 },
    startPositions: [
      { x: 224, z: 35, yaw: HEADING_NORTH },
      { x: 236, z: 35, yaw: HEADING_NORTH },
      { x: 224, z: 48, yaw: HEADING_NORTH },
      { x: 236, z: 48, yaw: HEADING_NORTH },
    ],
  },
  NATURE_MAP.placements,
);
