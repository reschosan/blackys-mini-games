import { HEADING_NORTH, type MapConfig } from '../shared/mapConfig';
import { CITY_BARRIERS, CITY_BOUNDARIES, CITY_ROOM, CITY_SURFACES, CITY_WAYPOINTS, CITY_WIDTH } from './course';
import { CITY_MAP } from './settings';
import { configFieldsFromSettings } from '../shared/mapSettings';
import { withMapPlacements } from '../shared/mapPlacements';

export const CITY: MapConfig = withMapPlacements(
  {
    ...configFieldsFromSettings(CITY_MAP),
    kind: 'city',
    room: CITY_ROOM,
    wallHeight: 1.6,
    wallThickness: 2,
    driveableSurfaces: CITY_SURFACES,
    driveableWidth: CITY_WIDTH,
    walls: [...CITY_BOUNDARIES, ...CITY_BARRIERS],
    obstacles: [],
    checkpoints: [
      { ax: 215, az: 0, bx: 245, bz: 0, name: 'Start/Ziel' },
      { ax: 170, az: -145, bx: 170, bz: -175, name: 'Hochstraße' },
      { ax: -215, az: -95, bx: -245, bz: -95, name: 'Neonviertel' },
      { ax: -167.5, az: 145, bx: -167.5, bz: 175, name: 'Hauptbahnhof' },
    ],
    waypoints: CITY_WAYPOINTS,
    aiGuideSpacing: { preferred: 2.5, minimum: 1.5 },
    followCamera: { pitchDegrees: 20, thirdPersonDistance: 24 },
    startPositions: [
      { x: 222, z: 35, yaw: HEADING_NORTH },
      { x: 238, z: 35, yaw: HEADING_NORTH },
      { x: 222, z: 48, yaw: HEADING_NORTH },
      { x: 238, z: 48, yaw: HEADING_NORTH },
    ],
  },
  CITY_MAP.placements,
);
