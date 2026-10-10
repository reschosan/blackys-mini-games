import type { Rng } from '../../shared/core/rng';
import type { InputFrame } from '../../shared/input/actions';
import { playerSourceKey, type JoinedPlayer } from '../../shared/input/inputManager';
import { PlayerLobbyInput } from './playerLobbyInput';

export interface MapVotePick {
  mapIndex: number;
  confirmed: boolean;
}

/**
 * Drives the shared "Choose map" screen: every joined human gets
 * their own cursor (which map they're currently pointing at) and can lock it in independently,
 * all on the same screen at the same time — unlike the sequential single-driver AI wizard, nobody
 * takes turns here. Reuses `PlayerLobbyInput`'s steer-cycles-value/confirm-locks-it edge
 * detection unchanged; this screen only ever needs that same shape (cycle + confirm), not its
 * row-navigation half.
 */
export class MapVoteStage {
  private readonly picks = new Map<string, MapVotePick>();
  private readonly inputs = new Map<string, PlayerLobbyInput>();
  /** Per player: the map they tapped last, so a second tap on it locks it in. */
  private readonly clickedMapIndexes = new Map<string, number>();

  constructor(private readonly mapCount: number) {}

  /** Index of the "Back" option that sits after the last map in the steering cycle. */
  get backIndex(): number {
    return this.mapCount;
  }

  /** Resets every joined human to an unconfirmed pick on the first map. Call once when the
   *  stage begins (all players just finished their own customization). */
  start(joined: readonly JoinedPlayer[]): void {
    this.picks.clear();
    this.inputs.clear();
    this.clickedMapIndexes.clear();
    for (const player of joined) {
      const key = playerSourceKey(player.source);
      this.picks.set(key, { mapIndex: 0, confirmed: false });
      const input = new PlayerLobbyInput();
      input.allowInitialSteer();
      this.inputs.set(key, input);
    }
  }

  pickFor(player: JoinedPlayer): MapVotePick | undefined {
    return this.picks.get(playerSourceKey(player.source));
  }

  allConfirmed(joined: readonly JoinedPlayer[]): boolean {
    return joined.length > 0 && joined.every((player) => this.pickFor(player)?.confirmed === true);
  }

  /** Applies each player's own frame to their pick; a player who already confirmed stops
   *  responding to input (locked) until the next `start()`. `onAction`, purely for a matching menu
   *  sound, never affects state here. Returns true if someone confirmed "Back". */
  update(joined: readonly JoinedPlayer[], frames: readonly InputFrame[], onAction?: (kind: 'navigate' | 'confirm') => void): boolean {
    return joined.map((player, index) => this.updatePlayer(player, frames[index], onAction)).some(Boolean);
  }

  private updatePlayer(player: JoinedPlayer, frame: InputFrame | undefined, onAction?: (kind: 'navigate' | 'confirm') => void): boolean {
    const key = playerSourceKey(player.source);
    const pick = this.picks.get(key);
    const input = this.inputs.get(key);
    if (!pick || !input || !frame || pick.confirmed) return false;

    const command = input.read(frame);
    if (command.valueDelta !== 0) {
      const options = this.mapCount + 1;
      pick.mapIndex = (pick.mapIndex + command.valueDelta + options) % options;
      onAction?.('navigate');
    }
    if (!command.confirm) return false;
    onAction?.('confirm');
    if (pick.mapIndex === this.backIndex) return true;
    pick.confirmed = true;
    return false;
  }

  /** Mouse and touch equivalent for the first player, who holds the screen: the first click on a map moves their
   *  pick there, a second click on the same map locks it in. Everyone else votes with their own controller. */
  clickMap(joined: readonly JoinedPlayer[], mapIndex: number, onAction?: (kind: 'navigate' | 'confirm') => void): void {
    if (joined[0]) this.tapMap(joined[0], mapIndex, onAction);
  }

  /** The same tap for any player (a guest phone votes on its own screen). */
  tapMap(player: JoinedPlayer, mapIndex: number, onAction?: (kind: 'navigate' | 'confirm') => void): void {
    const pick = this.pickFor(player);
    if (!pick || pick.confirmed || mapIndex < 0 || mapIndex >= this.mapCount) return;
    const key = playerSourceKey(player.source);
    const secondTap = this.clickedMapIndexes.get(key) === mapIndex;
    if (secondTap) {
      pick.confirmed = true;
      this.clickedMapIndexes.delete(key);
    } else {
      pick.mapIndex = mapIndex;
      this.clickedMapIndexes.set(key, mapIndex);
    }
    onAction?.(secondTap ? 'confirm' : 'navigate');
  }

  /** Tallies confirmed picks; the most-picked map index wins, and a tie between two or more
   *  maps is broken by `rng` (the seeded simulation RNG, so the outcome stays deterministic/
   *  replayable — never `Math.random()`). A single player's pick trivially wins as the only vote. */
  resolveWinnerIndex(joined: readonly JoinedPlayer[], rng: Rng): number {
    const counts = new Array(this.mapCount).fill(0) as number[];
    for (const player of joined) {
      const pick = this.pickFor(player);
      if (!pick || pick.mapIndex >= this.mapCount) continue;
      counts[pick.mapIndex] = (counts[pick.mapIndex] ?? 0) + 1;
    }
    const highest = Math.max(...counts);
    const leaders = counts.reduce<number[]>((leaderIndexes, count, index) => {
      if (count === highest) leaderIndexes.push(index);
      return leaderIndexes;
    }, []);
    return leaders[rng.nextInt(leaders.length)] ?? 0;
  }
}
