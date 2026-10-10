import type GUI from 'lil-gui';
import type { AiConfig } from '../../config/ai';
import { AI_DIFFICULTIES, type AiDifficulty, type AiDifficultyTunings } from '../../config/aiDifficulty';

export interface DebugAiControls {
  readonly onAddAiKart: () => void;
  readonly onSetGlobalDifficulty: (difficulty: AiDifficulty) => void;
  readonly onShowGuideLines: (visible: boolean) => void;
  /** A value of a graphics level changed: the renderer and the map view take it over. */
  readonly onGraphicsTuned: () => void;
}

export function addAiTuningControls(gui: GUI, ai: AiConfig): void {
  const folder = gui.addFolder('AI driving behavior');
  folder.add(ai, 'lookaheadDistance', 1, 20, 0.5).name('Lookahead (m)');
  folder.add(ai, 'cornerBrakingMarginSeconds', 0, 1.5, 0.05).name('Brake response (s)');
  folder.add(ai, 'avoidLookaheadDistance', 1, 15, 0.5).name('Avoidance lookahead (m)');
  folder.add(ai, 'avoidRadius', 0.5, 10, 0.1).name('Avoidance radius (m)');
  folder.add(ai, 'avoidStrength', 0, 15, 0.1).name('Avoidance strength');
  folder.add(ai, 'stuckMovementMeters', 0.1, 5, 0.05).name('Stuck distance (m)');
  folder.add(ai, 'stuckSecondsThreshold', 0.1, 5, 0.05).name('Stuck duration (s)');
  folder.add(ai, 'stuckCooldownSeconds', 0, 3, 0.05).name('Stuck cooldown (s)');
  folder.add(ai, 'avoidSpeedLookaheadSeconds', 0, 1.5, 0.05).name('Avoidance response (s)');
  folder.add(ai, 'avoidSmoothingSeconds', 0, 1, 0.02).name('Avoidance smoothing (s)');
  folder.add(ai, 'maxLateralOffset', 1, 10, 0.1).name('Maximum racing-line offset (m)');
  folder.add(ai, 'repositionToleranceDistance', 0.2, 5, 0.1).name('Reposition tolerance (m)');
  folder.add(ai, 'minBrakeSpeed', 0, 10, 0.1).name('Minimum braking speed');
  folder.add(ai, 'rubberBandingEnabled').name('Rubber banding enabled');
  folder.add(ai, 'rubberBandingStrength', 0, 1, 0.01).name('Rubber banding strength');

  const items = folder.addFolder('Item use');
  items.add(ai, 'itemAimConeRadians', 0.05, Math.PI / 2, 0.01).name('Hairball aim cone (rad)');
  items.add(ai, 'itemAimRangeMeters', 1, 30, 0.5).name('Hairball range (m)');
  items.add(ai, 'trapPursuerConeRadians', 0.05, Math.PI / 2, 0.01).name('Trap pursuer cone (rad)');
  items.add(ai, 'trapPursuerRangeMeters', 1, 20, 0.5).name('Trap pursuer range (m)');
  items.add(ai, 'napDeficitMeters', 1, 40, 0.5).name('Nap deficit (m)');
  items.add(ai, 'laserTargetRangeMeters', 2, 40, 0.5).name('Laser pointer range (m)');
  items.add(ai, 'vacuumTargetRangeMeters', 2, 30, 0.5).name('Vacuum range (m)');
}

export function addAiDifficultyControls(gui: GUI, difficulties: AiDifficultyTunings): void {
  const folder = gui.addFolder('AI difficulty');
  const labels: Record<AiDifficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

  for (const difficulty of AI_DIFFICULTIES) {
    const tuning = difficulties[difficulty];
    const sub = folder.addFolder(labels[difficulty]);
    sub.add(tuning, 'topSpeedFactor', 0.2, 1.5, 0.01).name('Top-speed factor');
    sub.add(tuning, 'accelerationFactor', 0.2, 1.5, 0.01).name('Acceleration factor');
    sub.add(tuning, 'steerGain', 0.2, 4, 0.05).name('Steering gain');
    sub.add(tuning, 'brakeAngleThreshold', 0.05, Math.PI / 2, 0.01).name('Braking threshold (rad)');
    sub.add(tuning, 'driftAngleThreshold', 0.05, Math.PI / 2, 0.01).name('Drift threshold (rad)');
    sub.add(tuning, 'minCornerSpeedFactor', 0.1, 1, 0.01).name('Minimum corner-speed factor');
    sub.add(tuning, 'startBoostChance', 0, 1, 0.01).name('Start-boost chance');
  }
}

export function addAiControls(gui: GUI, ai: DebugAiControls): void {
  const folder = gui.addFolder('AI (debug)');
  folder.add({ guideLines: false }, 'guideLines').name('Show guide lines').onChange(ai.onShowGuideLines);
  folder.add({ addAiKart: ai.onAddAiKart }, 'addAiKart').name('Add AI kart');
  folder
    .add({ difficulty: 'medium' as AiDifficulty }, 'difficulty', AI_DIFFICULTIES)
    .name('Difficulty (new AI karts)')
    .onChange((difficulty: AiDifficulty) => ai.onSetGlobalDifficulty(difficulty));
}
