import type { RaceConfig } from '../../../shared/config/race';
import type { InputFrame } from '../../../shared/input/actions';
import type { RacePlayer } from './racePlayer';
import { t } from '../../../shared/i18n';

export interface CountdownEvents {
  beep(): void;
  go(): void;
}

/** The pre-race "3-2-1-Los" lock. Karts stay frozen while `active`; a human pressing accelerate
 *  inside `earlyBoostWindowSeconds` right before "Los" earns the early boost, any earlier press
 *  disqualifies it for this start. AI does not play this minigame (see `Game.resetRace`). Auto-gas players
 *  (touch) have the gas on from the first second, so they get the boost as long as they do not brake. */
export class RaceStartCountdown {
  private secondsLeft = 0;
  private goDisplaySecondsLeft = 0;

  get active(): boolean {
    return this.secondsLeft > 0;
  }

  /** Seconds left of the count (0 once it is over); guests that draw the race themselves show the same count. */
  get secondsRemaining(): number {
    return this.secondsLeft;
  }

  get showingGo(): boolean {
    return this.secondsLeft <= 0 && this.goDisplaySecondsLeft > 0;
  }

  reset(seconds: number): void {
    this.secondsLeft = seconds;
    this.goDisplaySecondsLeft = 0;
  }

  /** "3", "2", "1", then "Los!" for a moment, or `null` once countdown and display are done. */
  label(): string | null {
    if (this.secondsLeft > 0) return String(Math.ceil(this.secondsLeft));
    if (this.goDisplaySecondsLeft > 0) return t().race.go;
    return null;
  }

  tickGoDisplay(stepSeconds: number): void {
    if (this.goDisplaySecondsLeft > 0) this.goDisplaySecondsLeft = Math.max(this.goDisplaySecondsLeft - stepSeconds, 0);
  }

  step(players: readonly RacePlayer[], frames: readonly InputFrame[], stepSeconds: number, race: RaceConfig, events: CountdownEvents): void {
    this.scoreAcceleratePresses(players, frames, race.earlyBoostWindowSeconds);
    const previousLabelSeconds = Math.ceil(this.secondsLeft);
    this.secondsLeft = Math.max(this.secondsLeft - stepSeconds, 0);
    if (this.secondsLeft > 0) {
      if (Math.ceil(this.secondsLeft) < previousLabelSeconds) events.beep();
      return;
    }
    events.go();
    this.goDisplaySecondsLeft = race.startGoDisplaySeconds;
    for (const player of players) {
      if (player.raceStartBoostEarned && !player.raceStartEarlyPress) player.state.boostSeconds = race.earlyBoostSeconds;
    }
  }

  private scoreAcceleratePresses(players: readonly RacePlayer[], frames: readonly InputFrame[], windowSeconds: number): void {
    const withinBoostWindow = this.secondsLeft <= windowSeconds;
    players.forEach((player, index) => {
      const frame = frames[index];
      if (player.isAi || !(frame?.accelerate ?? false)) return;
      if (frame?.autoGas) player.raceStartBoostEarned = true;
      else if (!withinBoostWindow) player.raceStartEarlyPress = true;
      else if (!player.raceStartEarlyPress) player.raceStartBoostEarned = true;
    });
  }
}
