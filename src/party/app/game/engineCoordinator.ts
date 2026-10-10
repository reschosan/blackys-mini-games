import type { ModeTuning } from '../../../shared/config/modes';
import { PLAYER_APPEARANCES } from '../../../shared/config/players';
import { createRng, deriveSeed } from '../../../shared/core/rng';
import { hexColor } from '../../../shared/core/color';
import type { GamePhase } from '../../../shared/core/gameFlow';
import type { PlaneTypeId } from '../../../shared/config/planeTypes';
import type { EngineSeat } from '../../../shared/game/engine';
import type { InputFrame } from '../../../shared/input/actions';
import type { RacePlayer } from '../../../games/kart/race/racePlayer';
import type { RacePresentation } from '../../../games/kart/race/views/racePresentation';
import type { EngineEntry } from '../../engine/engineView';
import { EngineRound } from './engineRound';

interface EngineCoordinatorDeps {
  readonly sessionSeed: number;
  readonly players: readonly RacePlayer[];
  readonly presentation: RacePresentation;
  readonly planeOf: (slot: number) => PlaneTypeId;
  readonly startCountdownSeconds: () => number;
  readonly tuning: ModeTuning;
  /** Where the games put their DOM, under the HUD and the menus. */
  readonly root: HTMLElement;
}

/** Starts and ends the games that are not on the kart engine: the seats come from the players, the kart scene stays out of sight while one runs. */
export class EngineCoordinator {
  private current: EngineRound | null = null;
  private games = 0;

  constructor(private readonly deps: EngineCoordinatorDeps) {}

  get round(): EngineRound | null {
    return this.current;
  }

  start(entry: EngineEntry, level: number): EngineRound {
    this.stop();
    this.games += 1;
    const { players, presentation } = this.deps;
    const seats: EngineSeat[] = players.map((player, slot) => ({
      slot,
      name: presentation.appearanceFor(player).name,
      color: hexColor(PLAYER_APPEARANCES[slot]?.bodyColor ?? 0xffffff),
      isAi: player.isAi,
      appearance: presentation.appearanceFor(player),
      plane: this.deps.planeOf(slot),
    }));
    for (const player of players) player.hidden = true;
    this.current = new EngineRound(
      entry,
      seats,
      createRng(deriveSeed(this.deps.sessionSeed, 'engine', this.games)),
      this.deps.startCountdownSeconds(),
      this.deps.root,
      this.deps.tuning,
      level,
    );
    return this.current;
  }

  /** Draws the running game on the canvas and the overlay; false when no game of this kind runs (the kart scene draws then). */
  draw(frameSeconds: number, phase: GamePhase, viewers: readonly number[]): boolean {
    const round = this.current;
    if (!round || phase === 'lobby') return false;
    round.draw(frameSeconds, viewers);
    this.deps.presentation.renderScene(round.view.scene, round.view.camerasFor(viewers));
    return true;
  }

  step(frames: readonly InputFrame[], stepSeconds: number): boolean {
    return this.current?.step(frames, stepSeconds) ?? false;
  }

  stop(): void {
    this.current?.dispose();
    this.current = null;
  }
}
