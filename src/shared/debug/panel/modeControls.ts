import type GUI from 'lil-gui';
import type { ModeTuning } from '../../config/modes';

export function addModeControls(gui: GUI, modes: ModeTuning): void {
  const folder = gui.addFolder('Kart minigames');

  const drift = folder.addFolder('Drift challenge');
  drift.add(modes.driftChallenge, 'durationSeconds', 20, 180, 5).name('Duration (s)');
  drift.add(modes.driftChallenge, 'pointsPerSecond', 1, 50, 1).name('Points per second');
  drift.add(modes.driftChallenge, 'stageBonusShare', 0, 2, 0.05).name('Bonus per stage (share)');
  drift.add(modes.driftChallenge, 'minimumSpeed', 0, 20, 0.5).name('Minimum speed');
  drift.add(modes.driftChallenge, 'bumpSpeedDrop', 0.5, 8, 0.1).name('Wall-hit speed-loss threshold');

  const tag = folder.addFolder('Tag');
  tag.add(modes.tag, 'durationSeconds', 20, 180, 5).name('Duration (s)');
  tag.add(modes.tag, 'immunitySeconds', 0, 6, 0.1).name('Immunity after tag (s)');
  tag.add(modes.tag, 'touchDistance', 1.5, 5, 0.1).name('Tag distance (m)');
  tag.add(modes.tag, 'arenaSize', 40, 160, 5).name('Arena size (m)');

  const sumo = folder.addFolder('Sumo karts');
  sumo.add(modes.sumo, 'platformRadius', 15, 80, 1).name('Platform radius (m)');
  sumo.add(modes.sumo, 'shrinkStartSeconds', 0, 60, 1).name('Shrink starts after (s)');
  sumo.add(modes.sumo, 'shrinkMetersPerSecond', 0, 3, 0.05).name('Shrink rate (m/s)');
  sumo.add(modes.sumo, 'minimumRadius', 1, 30, 1).name('Minimum radius (m)');
  sumo.add(modes.sumo, 'shoveRange', 2, 20, 0.5).name('Shove range (m)');
  sumo.add(modes.sumo, 'shoveConeDegrees', 10, 120, 5).name('Shove angle (°)');
  sumo.add(modes.sumo, 'shoveSpeed', 5, 60, 1).name('Shove speed (m/s)');
  sumo.add(modes.sumo, 'shoveFlightSeconds', 0.1, 2, 0.05).name('Flight duration (s)');
  sumo.add(modes.sumo, 'shoveCooldownSeconds', 0.2, 6, 0.1).name('Shove cooldown (s)');

  const lava = folder.addFolder('Floor is lava (kart)');
  lava.add(modes.lava, 'tileSize', 4, 20, 0.5).name('Tile size (m)');
  lava.add(modes.lava, 'tilesPerSide', 4, 14, 1).name('Tiles per side');
  lava.add(modes.lava, 'firstCollapseSeconds', 0, 30, 1).name('First collapse after (s)');
  lava.add(modes.lava, 'collapseIntervalSeconds', 0.5, 8, 0.1).name('Collapse interval (s)');
  lava.add(modes.lava, 'minimumIntervalSeconds', 0.2, 4, 0.1).name('Minimum interval (s)');
  lava.add(modes.lava, 'warningSeconds', 0.3, 5, 0.1).name('Pre-collapse warning (s)');

  const memory = folder.addFolder('Memory');
  memory.add(modes.memory, 'thinkSeconds', 0.2, 4, 0.1).name('AI thinking time (s)');
  memory.add(modes.memory, 'humanThinkSeconds', 2, 20, 0.5).name('Human thinking time (s)');
  memory.add(modes.memory, 'revealSeconds', 0.3, 4, 0.1).name('Card reveal duration (s)');
  memory.add(modes.memory, 'rememberChance', 0, 1, 0.05).name('AI card memory chance');
  memory.add(modes.memory, 'moveRepeatSeconds', 0.05, 0.6, 0.01).name('Cursor repeat interval (s)');

  const walk = folder.addFolder('Floor is lava (on foot)');
  walk.add(modes.walk, 'tilesPerSide', 5, 14, 1).name('Tiles per side');
  walk.add(modes.walk, 'tileSize', 4, 14, 0.5).name('Tile size (m)');
  walk.add(modes.walk, 'levelHeight', 0.6, 2.4, 0.1).name('Level height (m)');
  walk.add(modes.walk, 'hillCount', 0, 8, 1).name('Hills');
  walk.add(modes.walk, 'topLevel', 1, 3, 1).name('Highest level');
  walk.add(modes.walk, 'floodStartSeconds', 5, 90, 1).name('Lava rise starts after (s)');
  walk.add(modes.walk, 'floodIntervalSeconds', 5, 60, 1).name('Next level after (s)');
  walk.add(modes.walk, 'floodWarningSeconds', 1, 10, 0.5).name('Pre-flood warning (s)');
  walk.add(modes.walk, 'firstCollapseSeconds', 0, 30, 1).name('First collapse after (s)');
  walk.add(modes.walk, 'collapseIntervalSeconds', 0.4, 8, 0.1).name('Collapse interval (s)');
  walk.add(modes.walk, 'minimumIntervalSeconds', 0.2, 4, 0.05).name('Minimum interval (s)');
  walk.add(modes.walk, 'warningSeconds', 0.3, 5, 0.1).name('Pre-collapse warning (s)');
  walk.add(modes.walk, 'speed', 3, 20, 0.5).name('Walking speed (m/s)');
  walk.add(modes.walk, 'acceleration', 5, 120, 1).name('Acceleration');
  walk.add(modes.walk, 'jumpSpeed', 3, 16, 0.5).name('Jump speed');
  walk.add(modes.walk, 'gravity', 8, 60, 1).name('Gravity');
  walk.add(modes.walk, 'catRadius', 0.5, 2, 0.05).name('Cat radius (m)');
  walk.add(modes.walk, 'shoveSpeed', 0, 20, 0.5).name('Shove speed (m/s)');
  walk.add(modes.walk, 'lookTurnRate', 0.5, 5, 0.1).name('Camera turn rate (rad/s)');
  walk.add(modes.walk, 'cameraFollowRate', 0, 5, 0.1).name('Camera follow rate');
  walk.add(modes.walk, 'fishSpawnSeconds', 1, 15, 0.5).name('Fish spawn interval (s)');
  walk.add(modes.walk, 'fishMax', 0, 8, 1).name('Maximum fish count');
  walk.add(modes.walk, 'fishPickupRadius', 1, 4, 0.1).name('Fish pickup radius (m)');
  walk.add(modes.walk, 'boostSeconds', 1, 10, 0.5).name('Fish boost duration (s)');
  walk.add(modes.walk, 'boostFactor', 1, 2.5, 0.05).name('Fish boost factor');
  walk.add(modes.walk, 'pawCooldownSeconds', 0.3, 4, 0.1).name('Paw swipe cooldown (s)');
  walk.add(modes.walk, 'pawRange', 1.5, 8, 0.1).name('Paw swipe range (m)');
  walk.add(modes.walk, 'pawKnockSpeed', 5, 40, 1).name('Paw swipe speed (m/s)');
  walk.add(modes.walk, 'pawStunSeconds', 0, 1.5, 0.1).name('Stun duration (s)');

  const jets = folder.addFolder('Fighter jets');
  jets.add(modes.jets, 'arenaSize', 80, 320, 5).name('Arena size (m)');
  jets.add(modes.jets, 'durationSeconds', 30, 300, 5).name('Duration (s)');
  jets.add(modes.jets, 'hitsToLose', 1, 10, 1).name('Hits before elimination');
  jets.add(modes.jets, 'speed', 8, 60, 0.5).name('Flight speed (m/s)');
  jets.add(modes.jets, 'turnRate', 0.5, 5, 0.1).name('Turn rate (rad/s)');
  jets.add(modes.jets, 'minAltitude', 1, 10, 0.5).name('Minimum altitude (m)');
  jets.add(modes.jets, 'maxAltitude', 12, 80, 1).name('Maximum altitude (m)');
  jets.add(modes.jets, 'climbSpeed', 3, 40, 0.5).name('Climb speed (m/s)');
  jets.add(modes.jets, 'bulletSpeed', 20, 140, 1).name('Bullet speed (m/s)');
  jets.add(modes.jets, 'bulletSeconds', 0.3, 3, 0.1).name('Bullet lifetime (s)');
  jets.add(modes.jets, 'fireCooldownSeconds', 0.1, 1.5, 0.05).name('Fire cooldown (s)');
  jets.add(modes.jets, 'hitRadius', 0.8, 6, 0.1).name('Hit radius (m)');
  jets.add(modes.jets, 'invulnerableSeconds', 0, 4, 0.1).name('Protection after hit (s)');
  jets.add(modes.jets, 'startProtectionSeconds', 0, 10, 0.5).name('Start protection (s)');
  jets.add(modes.jets, 'pickupCount', 0, 20, 1).name('Item boxes');
  jets.add(modes.jets, 'pickupRespawnSeconds', 1, 20, 0.5).name('Item respawn after (s)');
  jets.add(modes.jets, 'pickupRadius', 1, 8, 0.1).name('Pickup radius (m)');
  jets.add(modes.jets, 'boostSeconds', 0.5, 8, 0.1).name('Boost duration (s)');
  jets.add(modes.jets, 'boostFactor', 1, 3, 0.05).name('Boost factor');
  jets.add(modes.jets, 'shieldSeconds', 1, 20, 0.5).name('Shield duration (s)');
  jets.add(modes.jets, 'missileSeconds', 0.5, 6, 0.1).name('Missile flight duration (s)');
  jets.add(modes.jets, 'missileTurnRate', 0.5, 8, 0.1).name('Missile turn rate');
  jets.add(modes.jets, 'shotAssist', 0, 6, 0.1).name('Shot aim assist');
  jets.add(modes.jets, 'aiAimError', 0, 1, 0.02).name('AI aim error (rad)');

  const soccer = folder.addFolder('Soccer');
  soccer.add(modes.soccer, 'fieldWidth', 60, 220, 5).name('Field length (m)');
  soccer.add(modes.soccer, 'fieldDepth', 40, 140, 5).name('Field width (m)');
  soccer.add(modes.soccer, 'goalWidth', 10, 50, 1).name('Goal width (m)');
  soccer.add(modes.soccer, 'durationSeconds', 30, 300, 5).name('Duration (s)');
  soccer.add(modes.soccer, 'goalLimit', 1, 10, 1).name('Goals to win');
  soccer.add(modes.soccer, 'ballRadius', 0.8, 4, 0.1).name('Ball radius (m)');
  soccer.add(modes.soccer, 'ballDrag', 0, 2, 0.05).name('Ball drag');
  soccer.add(modes.soccer, 'kickFactor', 0.5, 3, 0.05).name('Kick force (factor)');
  soccer.add(modes.soccer, 'wallBounce', 0, 1, 0.05).name('Wall bounce');
  soccer.add(modes.soccer, 'cornerSize', 0, 20, 1).name('Corner bevel (m)');
  soccer.add(modes.soccer, 'kickoffPauseSeconds', 0, 6, 0.5).name('Pause after goals (s)');
  folder.close();
}
