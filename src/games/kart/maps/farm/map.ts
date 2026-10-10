import { HEADING_NORTH, type MapConfig } from '../shared/mapConfig';
import { FARM_BARRIERS, FARM_BOUNDARIES, FARM_ROOM, FARM_SURFACES, FARM_WAYPOINTS, FARM_WIDTH } from './course';
import { FARM_MAP } from './settings';
import { configFieldsFromSettings } from '../shared/mapSettings';
import { withMapPlacements } from '../shared/mapPlacements';

export const FARM: MapConfig = withMapPlacements(
  {
    ...configFieldsFromSettings(FARM_MAP),
    kind: 'farm',
    room: FARM_ROOM,
    wallHeight: 1.6,
    wallThickness: 2,
    carpet: { island: { x: 0, z: 0, width: 0, depth: 0 }, routeWidth: FARM_WIDTH },
    driveableSurfaces: FARM_SURFACES,
    driveableWidth: FARM_WIDTH,
    walls: [...FARM_BOUNDARIES, ...FARM_BARRIERS],
    obstacles: [],
    checkpoints: [
      { ax: 188, az: 0, bx: 212, bz: 0, name: 'Start/Ziel' },
      { ax: 8, az: -75, bx: 32, bz: -75, name: 'Heuhof' },
      { ax: -145, az: 108, bx: -145, bz: 132, name: 'Kuhweide' },
      { ax: 10, az: 108, bx: 10, bz: 132, name: 'Windmühle' },
    ],
    waypoints: FARM_WAYPOINTS,
    aiGuideSpacing: { preferred: 2.5, minimum: 1.5 },
    followCamera: { pitchDegrees: 20, thirdPersonDistance: 24 },
    startPositions: [
      { x: 194, z: 35, yaw: HEADING_NORTH },
      { x: 206, z: 35, yaw: HEADING_NORTH },
      { x: 194, z: 48, yaw: HEADING_NORTH },
      { x: 206, z: 48, yaw: HEADING_NORTH },
    ],
  },
  FARM_MAP.placements,
);
