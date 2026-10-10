import { HEADING_NORTH, type MapConfig } from '../shared/mapConfig';
import { TOWN_BARRIERS, TOWN_BOUNDARIES, TOWN_ROOM, TOWN_SURFACES, TOWN_WAYPOINTS, TOWN_WIDTH } from './course';
import { TOWN_MAP } from './settings';
import { configFieldsFromSettings } from '../shared/mapSettings';
import { withMapPlacements } from '../shared/mapPlacements';

export const TOWN: MapConfig = withMapPlacements(
  {
    ...configFieldsFromSettings(TOWN_MAP),
    kind: 'town',
    room: TOWN_ROOM,
    wallHeight: 1.6,
    wallThickness: 2,
    carpet: { island: { x: 0, z: 0, width: 0, depth: 0 }, routeWidth: TOWN_WIDTH },
    driveableSurfaces: TOWN_SURFACES,
    driveableWidth: TOWN_WIDTH,
    walls: [...TOWN_BOUNDARIES, ...TOWN_BARRIERS],
    obstacles: [],
    checkpoints: [
      { ax: 170, az: 0, bx: 190, bz: 0, name: 'Start/Ziel' },
      { ax: 85, az: -50, bx: 85, bz: -70, name: 'Marktplatz' },
      { ax: -180, az: -82.5, bx: -200, bz: -82.5, name: 'Burgtor' },
      { ax: -20, az: 92.5, bx: -40, bz: 92.5, name: 'Hafen' },
    ],
    waypoints: TOWN_WAYPOINTS,
    aiGuideSpacing: { preferred: 2.2, minimum: 1.25 },
    followCamera: { pitchDegrees: 20, thirdPersonDistance: 24 },
    startPositions: [
      { x: 175, z: 30, yaw: HEADING_NORTH },
      { x: 185, z: 30, yaw: HEADING_NORTH },
      { x: 175, z: 42, yaw: HEADING_NORTH },
      { x: 185, z: 42, yaw: HEADING_NORTH },
    ],
  },
  TOWN_MAP.placements,
);
