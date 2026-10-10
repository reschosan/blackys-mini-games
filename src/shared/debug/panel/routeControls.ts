import type GUI from 'lil-gui';
import type { MapConfig, WindowJump } from '../../../games/kart/maps/shared/mapConfig';

export function addMapRouteControls(folder: GUI, map: MapConfig, refreshView: () => void): void {
  addRouteAiControls(folder, map, refreshView);
  addFollowCameraControls(folder, map);
  addRouteBankControls(folder, map, refreshView);
  addRouteMarkingControls(folder, map, refreshView);
  addJumpMarkingControls(folder, map, refreshView);
  for (const jump of map.windowJumps ?? []) addWindowJumpControls(folder, map, jump, refreshView);
}

function addRouteAiControls(folder: GUI, map: MapConfig, refreshView: () => void): void {
  if (!map.routeAi) return;
  folder.add(map.routeAi, 'speedFactor', 0.3, 1, 0.01).name('AI speed');
  folder.add(map.routeAi, 'cornerSpeed', 1, 12, 0.1).name('AI corner speed');
  folder.add(map.routeAi, 'brakingMargin', 0, 10, 0.1).name('AI braking margin');
  folder.add(map.routeAi, 'reachDistance', 0.5, 3, 0.1).name('AI waypoint reach distance');
  if (!map.aiGuideSpacing) return;
  folder.add(map.aiGuideSpacing, 'preferred', 0.4, 3, 0.1).name('AI guide spacing').onFinishChange(refreshView);
  folder.add(map.aiGuideSpacing, 'minimum', 0.2, 1, 0.1).name('AI narrow passage spacing').onFinishChange(refreshView);
}

function addFollowCameraControls(folder: GUI, map: MapConfig): void {
  const camera = map.followCamera;
  if (!camera) return;
  folder.add(camera, 'pitchDegrees', 10, 45, 1).name('House camera pitch');
  folder.add(camera, 'thirdPersonDistance', 8, 24, 0.5).name('House camera distance');
  if (camera.occlusionPadding !== undefined) folder.add(camera, 'occlusionPadding', 0, 2, 0.1).name('Camera wall padding');
  if (camera.minimumClearance !== undefined) folder.add(camera, 'minimumClearance', 2, 6, 0.5).name('Camera clearance');
}

function addRouteBankControls(folder: GUI, map: MapConfig, refreshView: () => void): void {
  if (!map.routeBanks) return;
  const banks = folder.addFolder('Side banks');
  banks.add(map.routeBanks, 'height', 0.5, 3, 0.1).name('Bank height').onFinishChange(refreshView);
  banks.add(map.routeBanks, 'wallHeight', 3, 8, 0.5).name('Outer wall height').onFinishChange(refreshView);
}

function addRouteMarkingControls(folder: GUI, map: MapConfig, refreshView: () => void): void {
  if (!map.routeMarkings) return;
  const markings = folder.addFolder('Route markings');
  markings.add(map.routeMarkings, 'lookAheadDistance', 40, 140, 5).name('Arrow lookahead');
  markings.add(map.routeMarkings, 'fadeDistance', 8, 30, 1).name('Arrow fade distance');
  if (!map.routeBanks) markings.add(map.routeMarkings, 'cornerRadius', 0, 3, 0.1).name('Marking corner radius').onFinishChange(refreshView);
  markings.add(map.routeMarkings, 'edgeWidth', 0.05, 0.4, 0.01).name('Edge marking width').onFinishChange(refreshView);
  markings.add(map.routeMarkings, 'arrowSize', 0.6, 3, 0.1).name('Arrow size').onFinishChange(refreshView);
  markings.add(map.routeMarkings, 'arrowSpacing', 4, 18, 1).name('Arrow spacing').onFinishChange(refreshView);
}

function addJumpMarkingControls(folder: GUI, map: MapConfig, refreshView: () => void): void {
  if (!map.jumpMarkings) return;
  const markings = folder.addFolder('Jump markings');
  markings.add(map.jumpMarkings, 'approachLength', 8, 24, 1).name('Approach marking').onFinishChange(refreshView);
  markings.add(map.jumpMarkings, 'stripeSpacing', 2, 5, 0.5).name('Stripe spacing').onFinishChange(refreshView);
  markings.add(map.jumpMarkings, 'stripeDepth', 0.4, 1.5, 0.1).name('Stripe width').onFinishChange(refreshView);
}

function addWindowJumpControls(folder: GUI, map: MapConfig, jump: WindowJump, refreshView: () => void): void {
  const window = folder.addFolder(jump.name);
  window.add(jump, 'minimumSpeed', 0, 22, 0.1).name('Takeoff speed');
  window.add(jump, 'durationSeconds', 0.2, 2, 0.05).name('Flight duration');
  window.add(jump, 'peakHeight', 0, 30, 0.5).name('Jump height');
  window.add(jump, 'airControlPerSecond', 0, 20, 0.1).name('Air steering');
  window.add(jump, 'penaltySeconds', 0, 5, 0.1).name('Penalty time');
  if (jump.optional) addOptionalJumpControls(window, map, jump, refreshView);
  if (jump.takeoffOffset !== undefined) window.add(jump, 'takeoffOffset', 0, 2.9, 0.1).name('Takeoff offset');
}

function addOptionalJumpControls(window: GUI, map: MapConfig, jump: WindowJump, refreshView: () => void): void {
  window.add(jump, 'rampLength', 2, 8, 0.5).name('Ramp length').onFinishChange(refreshView);
  window.add(jump, 'rampHeight', 0.2, 1.5, 0.05).name('Ramp height').onFinishChange(refreshView);
  const box = map.itemBoxes.find((spawn) => spawn.jumpId === jump.id);
  if (!box) return;
  window.add(box, 'heightOffset', 1, 6, 0.1).name('Item height');
  window.add(box, 'boostSeconds', 0.1, 10, 0.1).name('Item boost (s)');
}
