import type { AiConfig } from '../../../shared/config/ai';
import type { AiDifficultyTunings } from '../../../shared/config/aiDifficulty';
import type { ModeTuning } from '../../../shared/config/modes';
import { createRng, deriveSeed } from '../../../shared/core/rng';
import { NEUTRAL_INPUT, type InputFrame } from '../../../shared/input/actions';
import { shouldAiUseHeldItem } from '../../../games/kart/ai/driver/itemUse';
import { createKartState, speedOf, type KartState } from '../../../games/kart/kart/kartState';
import type { MapConfig } from '../../../games/kart/maps/shared/mapConfig';
import { arenaInputFrame } from '../../../games/kart/modes/arena/arenaAi';
import type { KartMode } from '../../../games/kart/modes/kartModes';
import type { AimPoint, ModeRules } from '../../../games/kart/modes/rules/modeRules';
import { sumoShove } from '../../../games/kart/modes/rules/sumo';
import { hasShoveTarget } from '../../../games/kart/kart/kartShove';
import type { RacePlayer } from '../../../games/kart/race/racePlayer';
import type { RaceWorld } from '../../../games/kart/race/raceWorld';

interface RulesRunnerDeps {
  readonly sessionSeed: number;
  readonly players: readonly RacePlayer[];
  readonly world: RaceWorld;
  readonly currentMap: () => MapConfig;
  readonly currentMode: () => KartMode;
  readonly tuning: ModeTuning;
  readonly aiDifficulty: AiDifficultyTunings;
  readonly ai: AiConfig;
}

/** An AI kart that holds nothing drives to an item box this close. */
const BOX_DETOUR_METERS = 30;
/** …but not to one this close to the edge of a platform that shrinks. */
const PLATFORM_EDGE_MARGIN_METERS = 6;

/** Runs the rules of the game on top of the kart physics (who is out, who wins, the goals) and takes out the karts that are out. */
export class RulesRunner {
  private current: ModeRules | null = null;

  constructor(private readonly deps: RulesRunnerDeps) {}

  get rules(): ModeRules | null {
    return this.current;
  }

  /** A fresh set of rules for a game that has just been set up; the plain race has none. */
  create(raceNumber: number): void {
    const { players, tuning, sessionSeed } = this.deps;
    const factory = this.deps.currentMode().createRules;
    this.current = factory ? factory({ count: players.length, rng: createRng(deriveSeed(sessionSeed, 'rules', raceNumber)), tuning }) : null;
    for (const player of players) player.hidden = false;
  }

  /** The input of the karts in a game on an arena: humans as they press, AI towards the point the rules give it, nobody who is out. */
  arenaFrames(humanFrames: readonly InputFrame[]): readonly InputFrame[] {
    const { players, aiDifficulty } = this.deps;
    const rules = this.current!;
    const states = players.map((player) => player.state);
    return players.map((player, slot) => {
      if (rules.isOut(slot)) return NEUTRAL_INPUT;
      if (!player.isAi) return humanFrames[slot] ?? NEUTRAL_INPUT;
      const frame = arenaInputFrame(player.state, this.aimOf(slot, player, states), aiDifficulty[player.difficulty ?? 'medium'].steerGain);
      return this.pressesItemButton(slot, player, states) ? { ...frame, useItem: true } : frame;
    });
  }

  /** Where an AI kart drives: to the nearest item box on the ground while it holds nothing, otherwise where the rules send it. */
  private aimOf(slot: number, player: RacePlayer, states: readonly KartState[]): AimPoint | null {
    const rulesAim = this.current!.aim(slot, states);
    return player.heldItem === null ? (this.nearestBox(player.state) ?? rulesAim) : rulesAim;
  }

  private nearestBox(from: KartState): AimPoint | null {
    const { world, currentMap } = this.deps;
    const visual = this.current!.visual;
    const reach = visual.kind === 'platform' ? visual.radius - PLATFORM_EDGE_MARGIN_METERS : Number.POSITIVE_INFINITY;
    const boxes = currentMap().itemBoxes.filter((box, index) => world.itemBoxes[index]?.collected === false && Math.hypot(box.x, box.z) < reach);
    const nearest = boxes.sort((first, second) => Math.hypot(first.x - from.x, first.z - from.z) - Math.hypot(second.x - from.x, second.z - from.z))[0];
    return nearest && Math.hypot(nearest.x - from.x, nearest.z - from.z) < BOX_DETOUR_METERS ? nearest : null;
  }

  private pressesItemButton(slot: number, player: RacePlayer, states: readonly KartState[]): boolean {
    if (!this.deps.currentMode().shove) return this.usesItem(player, states);
    const rivals = states.filter((_, other) => other !== slot && !this.current!.isOut(other));
    return hasShoveTarget(player.state, rivals, sumoShove(this.deps.tuning.sumo));
  }

  private usesItem(player: RacePlayer, states: readonly KartState[]): boolean {
    return (
      player.heldItem !== null &&
      shouldAiUseHeldItem(
        this.deps.ai,
        player.heldItem,
        player.state,
        states.filter((state) => state !== player.state),
        null,
      )
    );
  }

  /** A seat that is out stops, is hidden and no longer drives or collides; a goal sends everybody back to the start. */
  afterStep(speedsBefore: readonly number[], stepSeconds: number): void {
    const { players, world } = this.deps;
    const rules = this.current;
    if (!rules) return;
    rules.step({
      karts: players.map((player) => player.state),
      stepSeconds,
      timeSeconds: world.raceTimeSeconds,
      speedDrops: players.map((player, slot) => (speedsBefore[slot] ?? 0) - speedOf(player.state)),
    });
    world.places = rules.places();
    players.forEach((player, slot) => this.takeOut(player, rules.isOut(slot)));
    if (rules.takeKickoff()) this.sendToStart();
  }

  private takeOut(player: RacePlayer, out: boolean): void {
    player.hidden = out;
    if (!out || player.progress.finished) return;
    player.progress.finished = true;
    player.progress.finishTimeSeconds = this.deps.world.raceTimeSeconds;
    player.state.velocityX = 0;
    player.state.velocityZ = 0;
  }

  private sendToStart(): void {
    const map = this.deps.currentMap();
    this.deps.players.forEach((player, slot) => {
      const start = map.startPositions[slot];
      if (start) Object.assign(player.state, createKartState(start.x, start.z, start.yaw, start.levelId));
    });
  }
}
