import type GUI from 'lil-gui';
import type { CameraConfig } from '../../config/camera';
import type { DrivingConfig } from '../../config/driving';
import type { MenuScrollConfig } from '../../config/input';
import type { RaceConfig } from '../../config/race';
import type { TouchSteeringConfig } from '../../config/touch';

export function addRaceControls(gui: GUI, race: RaceConfig): void {
  const folder = gui.addFolder('Race');
  folder.add(race, 'lapCount', 1, 10, 1).name('Laps');
  folder.add(race, 'finishCountdownSeconds', 5, 120, 1).name('Finish countdown (s)');
  folder.add(race, 'resultsAutoReturnSeconds', 10, 180, 5).name('Return to lobby after results (s)');

  const start = folder.addFolder('Start sequence (3-2-1-Go)');
  start.add(race, 'startCountdownSeconds', 1, 8, 0.5).name('Countdown duration (s)');
  start.add(race, 'startGoDisplaySeconds', 0, 2, 0.05).name('"Go!" display duration (s)');
  start.add(race, 'earlyBoostWindowSeconds', 0.05, 2, 0.05).name('Early-boost window (s)');
  start.add(race, 'earlyBoostSeconds', 0, 3, 0.1).name('Early-boost duration (s)');
}

export function addDrivingControls(gui: GUI, driving: DrivingConfig): void {
  const speed = gui.addFolder('Speed');
  speed.add(driving, 'maxSpeed', 5, 60, 0.5).name('Top speed');
  speed.add(driving, 'acceleration', 1, 60, 0.5).name('Acceleration');
  speed.add(driving, 'brakeDeceleration', 1, 80, 0.5).name('Brake deceleration');
  speed.add(driving, 'coastDrag', 0, 30, 0.1).name('Coasting drag');
  speed.add(driving, 'maxReverseSpeed', 1, 20, 0.5).name('Maximum reverse speed');
  speed.add(driving, 'reverseAcceleration', 1, 40, 0.5).name('Reverse acceleration');

  const steering = gui.addFolder('Steering');
  steering.add(driving, 'steerRate', 0.5, 8, 0.05).name('Steering rate');
  steering.add(driving, 'steerFactorAtTopSpeed', 0.05, 1, 0.01).name('Steering at top speed');
  steering.add(driving, 'grip', 0.5, 25, 0.1).name('Grip');

  const drift = gui.addFolder('Drift');
  drift.add(driving, 'driftGrip', 0, 10, 0.05).name('Drift grip');
  drift.add(driving, 'driftMinSpeed', 0, 25, 0.5).name('Minimum speed');
  drift.add(driving, 'driftYawRate', 0, 5, 0.05).name('Drift yaw rate');
  drift.add(driving, 'driftSteerInfluence', 0, 4, 0.05).name('Drift steering influence');
  drift.add(driving, 'driftMaxSlipAngle', 0.1, 1.4, 0.01).name('Maximum slip angle');
  drift.add(driving.driftStageSeconds, '0', 0.1, 4, 0.05).name('Stage 1 after (s)');
  drift.add(driving.driftStageSeconds, '1', 0.1, 6, 0.05).name('Stage 2 after (s)');
  drift.add(driving.driftStageSeconds, '2', 0.1, 8, 0.05).name('Stage 3 after (s)');
  drift.add(driving.driftBoostSeconds, '0', 0, 3, 0.05).name('Stage 1 boost (s)');
  drift.add(driving.driftBoostSeconds, '1', 0, 3, 0.05).name('Stage 2 boost (s)');
  drift.add(driving.driftBoostSeconds, '2', 0, 3, 0.05).name('Stage 3 boost (s)');

  const boost = gui.addFolder('Boost');
  boost.add(driving, 'boostSpeedFactor', 1, 2.5, 0.01).name('Speed factor');
  boost.add(driving, 'boostAcceleration', 5, 120, 1).name('Boost acceleration');

  const surface = gui.addFolder('Surfaces and collisions');
  surface.add(driving, 'offroadSpeedFactor', 0.1, 1, 0.01).name('Offroad speed');
  surface.add(driving, 'offroadAccelerationFactor', 0.1, 1, 0.01).name('Offroad acceleration');
  surface.add(driving, 'wallRestitution', 0, 1, 0.01).name('Wall restitution');
  surface.add(driving, 'kartRestitution', 0, 1, 0.01).name('Kart restitution');
  surface.add(driving, 'kartCollisionSpeedLoss', 0, 0.6, 0.01).name('Kart speed loss');
  const tackle = surface.addFolder('Tackling');
  tackle.add(driving, 'tackleBounce', 0, 1, 0.01).name('Bounce');
  tackle.add(driving, 'tacklePush', 0, 2, 0.01).name('Push force factor');
  tackle.add(driving, 'tackleVictimSpeedLoss', 0, 0.8, 0.01).name('Victim speed loss');
  tackle.add(driving, 'tackleAttackerSpeedLoss', 0, 0.4, 0.01).name('Attacker speed loss');
  tackle.add(driving, 'tackleImmunitySeconds', 0, 1.5, 0.05).name('Immunity duration (s)');
  tackle.add(driving, 'tackleMinMargin', 0, 10, 0.1).name('Minimum speed advantage (m/s)');
}

export function addTouchSteeringControls(gui: GUI, touchSteering: TouchSteeringConfig): void {
  const folder = gui.addFolder('Touch steering');
  folder.add(touchSteering, 'deadzone', 0, 0.6, 0.01).name('Deadzone');
  folder.add(touchSteering, 'reverseAngle', 1.2, Math.PI, 0.01).name('Reverse angle (rad)');
  folder.add(touchSteering, 'reverseMaxSpeed', 0, 15, 0.1).name('Maximum reverse speed');
  folder.add(touchSteering, 'steerGain', 0.5, 5, 0.05).name('Steering gain');
}

export function addMenuScrollControls(gui: GUI, menuScroll: MenuScrollConfig): void {
  const folder = gui.addFolder('Menu scrolling');
  folder.add(menuScroll, 'pixelsPerSecond', 100, 2000, 10).name('Speed (pixels/s)');
}

export function addCameraControls(gui: GUI, cameraConfig: CameraConfig): void {
  const camera = gui.addFolder('Camera');
  camera.add(cameraConfig, 'mode', ['follow', 'overview']).name('Mode');

  const follow = camera.addFolder('Follow');
  follow.add(cameraConfig.follow, 'fov', 25, 90, 1).name('Field of view');
  follow.add(cameraConfig.follow, 'pitchDegrees', 20, 89, 1).name('Pitch (degrees)');
  follow.add(cameraConfig.follow, 'minDistance', 5, 60, 0.5).name('Minimum zoom');
  follow.add(cameraConfig.follow, 'maxDistance', 5, 90, 0.5).name('Maximum zoom');
  follow.add(cameraConfig.follow, 'framingMargin', 0, 25, 0.5).name('Framing margin');
  follow.add(cameraConfig.follow, 'lookAheadDistance', 0, 12, 0.1).name('Lookahead');
  follow.add(cameraConfig.follow, 'thirdPersonDistance', 4, 40, 0.5).name('Distance');
  follow.add(cameraConfig.follow, 'ceilingClearance', 0.2, 8, 0.1).name('Ceiling clearance');
  follow.add(cameraConfig.follow, 'positionSmoothing', 0.5, 20, 0.1).name('Position smoothing');
  follow.add(cameraConfig.follow, 'targetSmoothing', 0.5, 20, 0.1).name('Target smoothing');
  follow.add(cameraConfig.follow, 'zoomSmoothing', 0.2, 15, 0.1).name('Zoom smoothing');
  follow.add(cameraConfig.follow, 'zoomOutSmoothing', 0.2, 20, 0.1).name('Zoom-out smoothing');

  const overview = camera.addFolder('Overview');
  overview.add(cameraConfig.overview, 'fov', 25, 90, 1).name('Field of view');
  overview.add(cameraConfig.overview, 'height', 10, 90, 1).name('Height');
  overview.add(cameraConfig.overview, 'backOffset', 0, 80, 1).name('Rear offset');
}
