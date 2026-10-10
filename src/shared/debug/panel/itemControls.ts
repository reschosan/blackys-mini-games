import type GUI from 'lil-gui';
import type { ItemConfig } from '../../config/items';

export function addItemControls(gui: GUI, items: ItemConfig): void {
  const folder = gui.addFolder('Items (boxes)');
  folder.add(items, 'boxRespawnSeconds', 1, 30, 0.5).name('Respawn time (s)');
  folder.add(items, 'boxRadius', 0.2, 3, 0.05).name('Pickup radius (m)');
  folder.add(items, 'leaderStunBonusSeconds', 0, 6, 0.1).name('Leader: extra stun (s)');

  const hairball = folder.addFolder('Hairball (projectile)');
  hairball.add(items.hairball, 'speedMetersPerSecond', 5, 50, 0.5).name('Speed (m/s)');
  hairball.add(items.hairball, 'rangeMeters', 2, 30, 0.5).name('Range (m)');
  hairball.add(items.hairball, 'stunSeconds', 0.1, 3, 0.05).name('Stun duration (s)');
  hairball.add(items.hairball, 'velocityLossFactor', 0, 1, 0.01).name('Speed after hit (factor)');
  hairball.add(items.hairball, 'spinYawRadians', 0, Math.PI, 0.05).name('Spin angle (rad)');

  const tank = folder.addFolder('Tank (automatic shot)');
  tank.add(items.tank, 'shotIntervalSeconds', 2, 60, 1).name('Shot interval (s)');
  tank.add(items.tank, 'overtakenHoldoffSeconds', 0, 30, 0.5).name('Delay after being passed (s)');
  tank.add(items.tank, 'shellSpeedMetersPerSecond', 5, 80, 1).name('Projectile speed (m/s)');
  tank.add(items.tank, 'shellTurnRateRadiansPerSecond', 0.2, 8, 0.1).name('Turn rate (rad/s)');
  tank.add(items.tank, 'shellLifetimeSeconds', 1, 15, 0.5).name('Maximum flight time (s)');
  tank.add(items.tank, 'explosionRadiusMeters', 1, 15, 0.5).name('Explosion radius (m)');
  tank.add(items.tank, 'stunSeconds', 0.1, 4, 0.05).name('Stun duration (s)');
  tank.add(items.tank, 'velocityLossFactor', 0, 1, 0.01).name('Speed after hit (factor)');
  tank.add(items.tank, 'spinYawRadians', 0, Math.PI, 0.05).name('Spin angle (rad)');

  const nap = folder.addFolder('Nap (shield)');
  nap.add(items.nap, 'shieldSeconds', 0.5, 15, 0.5).name('Shield duration (s)');

  const trap = folder.addFolder('Cup (trap)');
  trap.add(items.trap, 'radius', 0.1, 2, 0.05).name('Radius (m)');
  folder.add(items.boost, 'durationSeconds', 0.5, 10, 0.5).name('Nitro duration (s)');
  trap.add(items.trap, 'spawnOffsetMeters', 0, 3, 0.05).name('Distance behind kart (m)');
  trap.add(items.trap, 'stunSeconds', 0.1, 3, 0.05).name('Stun duration (s)');
  trap.add(items.trap, 'velocityLossFactor', 0, 1, 0.01).name('Speed after hit (factor)');
  trap.add(items.trap, 'spinYawRadians', 0, Math.PI, 0.05).name('Spin angle (rad)');

  const cowpat = folder.addFolder('Cowpat (sticky trap)');
  cowpat.add(items.cowpat, 'radius', 0.1, 2, 0.05).name('Radius (m)');
  cowpat.add(items.cowpat, 'spawnOffsetMeters', 0, 3, 0.05).name('Distance behind kart (m)');
  cowpat.add(items.cowpat, 'stickySeconds', 0.5, 8, 0.1).name('Sticky duration (s)');
  cowpat.add(items.cowpat, 'velocityLossFactor', 0, 1, 0.01).name('Speed after hit (factor)');

  const itemBursts = folder.addFolder('Item sparks');
  itemBursts.add(items.itemFeedback, 'pickupBurstCount', 0, 80, 1).name('On pickup');
  itemBursts.add(items.itemFeedback, 'useBurstCount', 0, 120, 1).name('On use');

  const hit = folder.addFolder('Hit effect');
  hit.add(items.hitFeedback, 'shakeStrength', 0, 1.5, 0.05).name('Camera shake');
  hit.add(items.hitFeedback, 'burstCount', 0, 120, 1).name('Kart sparks');

  addNewItemControls(folder, items);
}

function addNewItemControls(folder: GUI, items: ItemConfig): void {
  const catnip = folder.addFolder('Catnip');
  catnip.add(items.catnip, 'boostSeconds', 0.5, 10, 0.5).name('Boost duration (s)');
  catnip.add(items.catnip, 'chaosSeconds', 0, 6, 0.1).name('Steering chaos duration (s)');
  catnip.add(items.catnip, 'chaosSteerAmplitude', 0, 1, 0.05).name('Steering chaos strength');
  catnip.add(items.catnip, 'chaosFrequency', 2, 30, 0.5).name('Steering chaos speed');

  const laser = folder.addFolder('Laser pointer');
  laser.add(items.laser, 'speedMetersPerSecond', 4, 30, 0.5).name('Dot speed (m/s)');
  laser.add(items.laser, 'lifetimeSeconds', 1, 12, 0.5).name('Duration (s)');
  laser.add(items.laser, 'lureRadiusMeters', 2, 25, 0.5).name('Lure radius (m)');
  laser.add(items.laser, 'lureStrength', 0, 1, 0.05).name('Lure strength');
  laser.add(items.laser, 'lureSteerGain', 0.5, 8, 0.1).name('Lure steering gain');
  laser.add(items.laser, 'spawnDistanceMeters', 2, 20, 0.5).name('Start distance (m)');

  const yarn = folder.addFolder('Yarn ball');
  yarn.add(items.yarn, 'speedMetersPerSecond', 5, 40, 0.5).name('Speed (m/s)');
  yarn.add(items.yarn, 'rangeMeters', 20, 500, 5).name('Range (m)');
  yarn.add(items.yarn, 'maxBounces', 0, 20, 1).name('Bounces');
  yarn.add(items.yarn, 'stunSeconds', 0.1, 3, 0.05).name('Stun duration (s)');
  yarn.add(items.yarn, 'velocityLossFactor', 0, 1, 0.01).name('Speed after hit (factor)');
  yarn.add(items.yarn, 'spinYawRadians', 0, Math.PI, 0.05).name('Spin angle (rad)');

  const vacuum = folder.addFolder('Vacuum cleaner');
  vacuum.add(items.vacuum, 'rangeMeters', 2, 30, 0.5).name('Range (m)');
  vacuum.add(items.vacuum, 'coneHalfAngleRadians', 0.1, Math.PI, 0.05).name('Cone half-angle (rad)');
  vacuum.add(items.vacuum, 'pullSpeedMetersPerSecond', 0, 30, 0.5).name('Pull speed (m/s)');
  vacuum.add(items.vacuum, 'stunSeconds', 0.1, 3, 0.05).name('Stun duration (s)');
  vacuum.add(items.vacuum, 'velocityLossFactor', 0, 1, 0.01).name('Speed after hit (factor)');

  const gravity = folder.addFolder('Gravity bubble');
  gravity.add(items.gravity, 'radiusMeters', 1, 8, 0.1).name('Radius (m)');
  gravity.add(items.gravity, 'lifetimeSeconds', 2, 30, 0.5).name('Lifetime (s)');
  gravity.add(items.gravity, 'spawnOffsetMeters', 0, 5, 0.1).name('Distance behind kart (m)');
  gravity.add(items.gravity, 'stunSeconds', 0.1, 4, 0.05).name('Hover duration (s)');
  gravity.add(items.gravity, 'velocityLossFactor', 0, 1, 0.01).name('Speed while hovering (factor)');
}
