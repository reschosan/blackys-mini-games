import { raceDriveFactors, raceInputFrames } from '../../../games/kart/ai/raceAiInput';
import type { SoundEngine } from '../../../shared/audio/soundEngine';
import type { AiConfig } from '../../../shared/config/ai';
import type { AiDifficultyTunings } from '../../../shared/config/aiDifficulty';
import type { DrivingConfig } from '../../../shared/config/driving';
import type { ItemConfig, ItemType } from '../../../shared/config/items';
import type { KartStatsTable } from '../../../shared/config/kartLoadout';
import type { RaceConfig } from '../../../shared/config/race';
import { createRng, deriveSeed, type Rng } from '../../../shared/core/rng';
import type { InputFrame } from '../../../shared/input/actions';
import { createKartState, speedOf } from '../../../games/kart/kart/kartState';
import type { MapConfig } from '../../../games/kart/maps/shared/mapConfig';
import type { KartMode } from '../../../games/kart/modes/kartModes';
import { evaluateFinish } from '../../../games/kart/race/finish';
import type { RacePlayer } from '../../../games/kart/race/racePlayer';
import { createProgress } from '../../../games/kart/race/raceState';
import { stepRaceSimulation } from '../../../games/kart/race/raceSimulation';
import type { ModeTuning } from '../../../shared/config/modes';
import type { ModeRules } from '../../../games/kart/modes/rules/modeRules';
import { sumoShove } from '../../../games/kart/modes/rules/sumo';
import { RulesRunner } from './rulesRunner';
import { resetRaceWorld, type RaceWorld } from '../../../games/kart/race/raceWorld';
import { RaceStartCountdown } from '../../../games/kart/race/startCountdown';
import type { RacePresentation } from '../../../games/kart/race/views/racePresentation';
import type { RaceBroadcaster } from '../raceBroadcaster';

/** Single-tick speed loss (m/s) above which a wall/kart bump counts as a collision for sound
 *  purposes; well above what normal accel/brake can produce in one tick, but below a real bounce. */
const COLLISION_SPEED_DROP_THRESHOLD = 2.5;

interface RaceSessionDeps {
  readonly sessionSeed: number;
  readonly players: readonly RacePlayer[];
  readonly world: RaceWorld;
  readonly currentMap: () => MapConfig;
  readonly currentMode: () => KartMode;
  readonly driving: DrivingConfig;
  readonly ai: AiConfig;
  readonly aiDifficulty: AiDifficultyTunings;
  readonly kartStats: KartStatsTable;
  readonly tuning: ModeTuning;
  readonly items: ItemConfig;
  readonly race: RaceConfig;
  readonly sound: SoundEngine;
  readonly presentation: RacePresentation;
  readonly broadcaster: RaceBroadcaster;
}

/** One race from the starting grid to the finish: its random streams, the start countdown, one simulation step and the finish deadline. */
export class RaceSession {
  readonly startCountdown = new RaceStartCountdown();
  private raceNumber = 0;
  private itemRng: Rng;
  private startBoostRng: Rng;
  private finishDeadlineSeconds: number | null = null;
  private readonly runner: RulesRunner;

  constructor(private readonly deps: RaceSessionDeps) {
    this.runner = new RulesRunner(deps);
    this.itemRng = createRng(deriveSeed(deps.sessionSeed, 'items', 0));
    this.startBoostRng = createRng(deriveSeed(deps.sessionSeed, 'startBoost', 0));
  }

  get number(): number {
    return this.raceNumber;
  }

  /** The rules of the game being played on top of the physics; null in the plain race. */
  get rules(): ModeRules | null {
    return this.runner.rules;
  }

  /** New random streams for a new race, so the same seed gives the same sequence of races. */
  beginNewRace(): void {
    this.raceNumber += 1;
    this.itemRng = createRng(deriveSeed(this.deps.sessionSeed, 'items', this.raceNumber));
    this.startBoostRng = createRng(deriveSeed(this.deps.sessionSeed, 'startBoost', this.raceNumber));
    this.reset();
  }

  reset(): void {
    const { world, players, race, aiDifficulty, presentation } = this.deps;
    const map = this.deps.currentMap();
    resetRaceWorld(world, map, this.deps.currentMode().itemsEnabled);
    this.finishDeadlineSeconds = null;
    this.startCountdown.reset(race.startCountdownSeconds);
    players.forEach((player, index) => {
      const start = map.startPositions[index];
      if (!start) return;
      Object.assign(player.state, createKartState(start.x, start.z, start.yaw, start.levelId));
      Object.assign(player.progress, createProgress(start.x, start.z, start.levelId));
      player.heldItem = null;
      player.previousUseItem = false;
      player.raceStartEarlyPress = false;
      // AI doesn't play the per-tick press-timing minigame; its start timing is a single
      // difficulty-weighted roll on the seeded simulation RNG instead (see `startBoostChance`).
      player.raceStartBoostEarned = player.isAi && player.difficulty ? this.startBoostRng.next() < aiDifficulty[player.difficulty].startBoostChance : false;
    });
    presentation.resetFeedback();
    this.runner.create(this.raceNumber);
  }

  remainingFinishSeconds(): number | null {
    if (this.finishDeadlineSeconds === null) return null;
    return Math.max(this.finishDeadlineSeconds - this.deps.world.raceTimeSeconds, 0);
  }

  /** One 60 Hz step of a race that has started. Returns true when the race is over. */
  step(frames: readonly InputFrame[], stepSeconds: number): boolean {
    const { broadcaster, sound, players, world, race } = this.deps;
    if (!this.deps.presentation.isMapReady()) return false;
    broadcaster.tick();
    if (broadcaster.holdsStart(stepSeconds)) return false;
    if (this.startCountdown.active) {
      this.startCountdown.step(players, frames, stepSeconds, race, {
        beep: () => {
          broadcaster.event({ type: 'countdownBeep' });
          sound.playCountdownBeep();
        },
        go: () => {
          broadcaster.event({ type: 'go' });
          sound.playGo();
        },
      });
      return false;
    }
    this.startCountdown.tickGoDisplay(stepSeconds);
    world.raceTimeSeconds += stepSeconds;
    this.simulate(frames, stepSeconds);
    return this.isOver();
  }

  private simulate(frames: readonly InputFrame[], stepSeconds: number): void {
    const { players, world, race, items, driving, ai, aiDifficulty, kartStats } = this.deps;
    const map = this.deps.currentMap();
    const mode = this.deps.currentMode();
    const arena = mode.arena !== null;
    const raceFrames = arena ? this.runner.arenaFrames(frames) : raceInputFrames(players, frames, map, ai, aiDifficulty, driving, stepSeconds);
    const speedsBeforeCollision = players.map((player) => speedOf(player.state));
    world.places = stepRaceSimulation(
      {
        map,
        driving,
        items,
        participants: players,
        frames: raceFrames,
        driveFactors: raceDriveFactors(players, aiDifficulty, kartStats),
        hairballs: world.hairballs,
        traps: world.traps,
        fieldItems: world.fieldItems,
        tankFire: world.tankFire,
        itemBoxes: world.itemBoxes,
        itemsEnabled: mode.itemsEnabled,
        ...(mode.shove ? { shove: sumoShove(this.deps.tuning.sumo) } : {}),
        ranking: !arena,
        places: world.places,
        rng: this.itemRng,
        lapCount: race.lapCount,
        raceTimeSeconds: world.raceTimeSeconds,
        stepSeconds,
      },
      {
        afterPhysics: () => this.reportCollisions(speedsBeforeCollision),
        itemUsed: (item, index) => this.onItemUsed(item, index),
        itemsChanged: (previousItems) => this.notifyItemPickups(previousItems),
        tankFired: () => {
          this.deps.broadcaster.event({ type: 'tankShot' });
          this.deps.sound.playTankShot();
        },
        tankShellDetonated: () => {
          this.deps.broadcaster.event({ type: 'explosion' });
          this.deps.sound.playExplosion();
        },
      },
    );
    this.runner.afterStep(speedsBeforeCollision, stepSeconds);
  }

  private reportCollisions(speedsBeforeCollision: readonly number[]): void {
    this.deps.players.forEach((player, index) => {
      const speedDrop = (speedsBeforeCollision[index] ?? 0) - speedOf(player.state);
      if (speedDrop <= COLLISION_SPEED_DROP_THRESHOLD) return;
      this.deps.broadcaster.event({ type: 'collision', slot: index });
      this.deps.sound.playCollision();
    });
  }

  private isOver(): boolean {
    if (this.runner.rules) return this.runner.rules.over;
    const { players, world, race } = this.deps;
    const status = evaluateFinish(
      players.map((player) => player.progress.finished),
      world.raceTimeSeconds,
      race.finishCountdownSeconds,
      this.finishDeadlineSeconds,
    );
    this.finishDeadlineSeconds = status.deadlineSeconds;
    return status.raceOver;
  }

  private onItemUsed(item: ItemType, participantIndex: number): void {
    const { broadcaster, sound, players, presentation, items } = this.deps;
    broadcaster.event({ type: 'itemUsed', slot: participantIndex, item });
    sound.playItemUse(item);
    const user = players[participantIndex];
    if (user) presentation.showItemBurst(user.state, item, items.itemFeedback.useBurstCount);
  }

  /** Plays the pickup chime and the pickup sparks only when a player receives an item. */
  private notifyItemPickups(previousHeldItems: readonly (ItemType | null)[]): void {
    const { broadcaster, sound, presentation, items } = this.deps;
    this.deps.players.forEach((player, index) => {
      if (player.heldItem === previousHeldItems[index] || player.heldItem === null) return;
      broadcaster.event({ type: 'itemPickedUp', slot: index });
      sound.playItemPickup();
      presentation.showItemBurst(player.state, player.heldItem, items.itemFeedback.pickupBurstCount);
    });
  }
}
