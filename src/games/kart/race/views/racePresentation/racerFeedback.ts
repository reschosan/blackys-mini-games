import type { SoundEngine } from '../../../../../shared/audio/soundEngine';
import type { ItemConfig, ItemType } from '../../../../../shared/config/items';
import { ITEM_EFFECT_COLORS } from '../../../../../shared/config/itemEffects';
import type { KartEffects } from '../../../../../shared/effects/kartEffects';
import type { KartState } from '../../../kart/kartState';
import { kartElevationAt } from '../../../maps/shared/surface';
import { windowJumpHeight } from '../../../maps/shared/windowJumps';
import type { MapConfig } from '../../../maps/shared/mapConfig';
import type { KartProgress } from '../../raceState';

export interface FeedbackState {
  wasDrifting: boolean;
  driftStage: number;
  wasBoosting: boolean;
  wasStunned: boolean;
  wasAirborne: boolean;
  wasFinished: boolean;
  sparkCooldownSeconds: number;
  flameCooldownSeconds: number;
  dustCooldownSeconds: number;
  catnipCooldownSeconds: number;
}

export function createFeedback(): FeedbackState {
  return {
    wasDrifting: false,
    driftStage: 0,
    wasBoosting: false,
    wasStunned: false,
    wasAirborne: false,
    wasFinished: false,
    sparkCooldownSeconds: 0,
    flameCooldownSeconds: 0,
    dustCooldownSeconds: 0,
    catnipCooldownSeconds: 0,
  };
}

const CONFETTI_BURST_COUNT = 260;
const SPARK_EMIT_INTERVAL_SECONDS = 0.045;
const FLAME_EMIT_INTERVAL_SECONDS = 0.03;
const DUST_EMIT_INTERVAL_SECONDS = 0.08;
const CATNIP_SPARKLE_INTERVAL_SECONDS = 0.07;
const CATNIP_SPARKLE_COUNT = 3;
const DUST_MIN_SPEED = 2;

export interface FeedbackTargets {
  readonly sound: SoundEngine;
  readonly effects: KartEffects;
  readonly currentMap: () => MapConfig;
  readonly shakeCameras: (strength: number) => void;
}

/** Sound edges, particles and camera shake that follow a kart's state; reads the state, never writes it. */
export class RacerFeedback {
  constructor(private readonly targets: FeedbackTargets) {}

  update(
    state: Readonly<KartState>,
    progress: Readonly<KartProgress>,
    feedback: FeedbackState,
    index: number,
    speed: number,
    seconds: number,
    items: ItemConfig,
  ): void {
    const { sound, effects } = this.targets;
    sound.ensureEngineStarted(index);
    sound.updateEngine(index, speed);
    this.updateSoundEdges(state, feedback, items);
    if (progress.finished && !feedback.wasFinished) effects.spawnConfettiBurst(state.x, state.z, CONFETTI_BURST_COUNT);
    feedback.wasFinished = progress.finished;
    this.emitParticles(state, feedback, speed, seconds);
  }

  /** Sparks in the item's colour around a kart, for picking the item up, using it, or while catnip works. */
  showItemBurst(state: Readonly<KartState>, item: ItemType, count: number): void {
    this.targets.effects.spawnItemBurst(state.x, state.z, this.elevationOf(state), ITEM_EFFECT_COLORS[item], count);
  }

  private elevationOf(state: Readonly<KartState>): number {
    const map = this.targets.currentMap();
    return kartElevationAt(map, state) + windowJumpHeight(map, state);
  }

  private updateSoundEdges(state: Readonly<KartState>, feedback: FeedbackState, items: ItemConfig): void {
    const drifting = state.driftDirection !== 0;
    if (drifting && !feedback.wasDrifting) this.targets.sound.playDriftStart();
    if (state.driftStage > feedback.driftStage) this.targets.sound.playDriftStage(state.driftStage);
    feedback.wasDrifting = drifting;
    feedback.driftStage = state.driftStage;
    const boosting = state.boostSeconds > 0;
    if (boosting && !feedback.wasBoosting) this.targets.sound.playBoost();
    feedback.wasBoosting = boosting;
    this.updateHitFeedback(state, feedback, items);
  }

  /** An item hit (stunned) or a shove (flying) starts with a bang. */
  private updateHitFeedback(state: Readonly<KartState>, feedback: FeedbackState, items: ItemConfig): void {
    const stunned = state.stunSecondsLeft > 0;
    const airborne = state.airborneSecondsLeft > 0;
    if ((stunned && !feedback.wasStunned) || (airborne && !feedback.wasAirborne)) this.showHit(state, items);
    feedback.wasStunned = stunned;
    feedback.wasAirborne = airborne;
  }

  private showHit(state: Readonly<KartState>, items: ItemConfig): void {
    const { shakeStrength, burstCount } = items.hitFeedback;
    this.targets.sound.playItemHit();
    this.targets.shakeCameras(shakeStrength);
    this.targets.effects.spawnHitBurst(state.x, state.z, this.elevationOf(state), burstCount);
  }

  private emitParticles(state: Readonly<KartState>, feedback: FeedbackState, speed: number, seconds: number): void {
    feedback.sparkCooldownSeconds = Math.max(feedback.sparkCooldownSeconds - seconds, 0);
    if (state.driftDirection !== 0 && feedback.sparkCooldownSeconds <= 0) {
      this.targets.effects.spawnSpark(state.x, state.z, state.yaw, state.driftDirection, state.driftStage);
      feedback.sparkCooldownSeconds = SPARK_EMIT_INTERVAL_SECONDS;
    }
    feedback.flameCooldownSeconds = Math.max(feedback.flameCooldownSeconds - seconds, 0);
    if (state.boostSeconds > 0 && feedback.flameCooldownSeconds <= 0) {
      this.targets.effects.spawnFlame(state.x, state.z, state.yaw, this.elevationOf(state));
      feedback.flameCooldownSeconds = FLAME_EMIT_INTERVAL_SECONDS;
    }
    feedback.catnipCooldownSeconds = Math.max(feedback.catnipCooldownSeconds - seconds, 0);
    if (state.catnipSecondsLeft > 0 && feedback.catnipCooldownSeconds <= 0) {
      this.showItemBurst(state, 'catnip', CATNIP_SPARKLE_COUNT);
      feedback.catnipCooldownSeconds = CATNIP_SPARKLE_INTERVAL_SECONDS;
    }
    feedback.dustCooldownSeconds = Math.max(feedback.dustCooldownSeconds - seconds, 0);
    if (!state.onCarpet && speed > DUST_MIN_SPEED && feedback.dustCooldownSeconds <= 0) {
      this.targets.effects.spawnDust(state.x, state.z, state.yaw);
      feedback.dustCooldownSeconds = DUST_EMIT_INTERVAL_SECONDS;
    }
  }
}
