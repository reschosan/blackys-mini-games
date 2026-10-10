import type { ModeTuning } from '../../../shared/config/modes';
import type { Rng } from '../../../shared/core/rng';
import type { EngineSeat, EngineSession, EngineSnapshot, RoundInfo } from '../../../shared/game/engine';
import type { EngineView } from '../../../shared/game/engineView';
import type { InputFrame } from '../../../shared/input/actions';
import { encodeEngineFrame } from '../../engine/engineWire';
import type { EngineEntry } from '../../engine/engineView';

/** One game that is not on the kart engine, running on the host: its rules, its view, and the countdown before it starts. */
export class EngineRound implements RoundInfo {
  readonly view: EngineView;
  private readonly session: EngineSession;
  private countdownSeconds: number;
  /** The state after the last step: drawing at 120 Hz does not build it again for every frame. */
  private latest: EngineSnapshot | null = null;

  constructor(
    readonly entry: EngineEntry,
    readonly seats: readonly EngineSeat[],
    rng: Rng,
    countdownSeconds: number,
    root: HTMLElement,
    tuning: ModeTuning,
    level: number,
  ) {
    this.session = entry.game.createSession({ seats, rng, tuning, level });
    this.view = entry.createView(seats);
    this.view.mount(root);
    this.countdownSeconds = countdownSeconds;
  }

  /** One 60 Hz step. Returns true when the game is over. */
  step(frames: readonly InputFrame[], stepSeconds: number): boolean {
    if (this.countdownSeconds > 0) {
      this.countdownSeconds -= stepSeconds;
      return false;
    }
    this.session.step(frames, stepSeconds);
    this.latest = null;
    return this.session.over;
  }

  /** Once per drawn frame: the view takes over the state and animates. */
  draw(frameSeconds: number, viewers: readonly number[]): void {
    if (!this.latest) {
      this.latest = this.session.snapshot();
      this.view.apply(this.latest);
    }
    this.view.frame(frameSeconds, viewers);
  }

  countdownLabel(): string | null {
    return this.countdownSeconds > 0 ? String(Math.ceil(this.countdownSeconds)) : null;
  }

  places(): readonly number[] {
    return this.session.places();
  }

  detail(slot: number): string {
    return this.session.detail(slot);
  }

  cardText(slot: number): string {
    return this.session.cardText(slot);
  }

  statusLines(): readonly string[] {
    return this.session.statusLines();
  }

  /** The state of the game as plain JSON (for the debug hook of the browser tests). */
  snapshot(): EngineSnapshot {
    this.latest ??= this.session.snapshot();
    return this.latest;
  }

  /** What goes to the guests that draw the game: the state with what the HUD shows, as one message. */
  encode(): ArrayBuffer {
    return encodeEngineFrame({
      state: this.session.snapshot(),
      hud: {
        places: this.session.places(),
        cards: this.seats.map((seat) => this.session.cardText(seat.slot)),
        lines: this.session.statusLines(),
        countdown: this.countdownLabel(),
      },
    });
  }

  dispose(): void {
    this.view.dispose();
  }
}
