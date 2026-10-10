import type { ItemType } from '../../shared/config/items';
import type { GameFlow } from '../../shared/core/gameFlow';
import { hexColor } from '../../shared/core/color';
import { PLAYER_APPEARANCES } from '../../shared/config/players';
import type { RemoteConfig } from '../../shared/config/remote';
import type { InputManager } from '../../shared/input/inputManager';
import type { RemoteInput } from '../../shared/input/remote/remoteInput';
import type { RacePlayer } from '../../games/kart/race/racePlayer';

const PING_SECONDS = 1;

export interface RemoteStatusSource {
  readonly flow: GameFlow;
  readonly input: InputManager;
  readonly players: () => readonly RacePlayer[];
  readonly places: () => readonly number[];
  readonly lapCount: () => number;
  /** What the card of a seat says in a game that is not a race; null in a race. */
  readonly gameStatusOf: (slot: number) => string | null;
  readonly nameOfSlot: (slot: number) => string;
  /** The name of the player who paused the race, while it is paused. */
  readonly pausedBy: () => string | null;
  /** Names of the players whose phone has dropped out. */
  readonly awayNames: () => readonly string[];
  /** The name of an item on the map being raced. */
  readonly itemLabelOf: (item: ItemType) => string;
  /** May the player of this slot choose what happens after the race? */
  readonly canDecideAfterRace: (slot: number) => boolean;
  /** Can this host's screen show a shared picture for guests that stay plain controllers (a screen the size of a tablet or more)? */
  readonly showsSharedPicture: () => boolean;
}

/** Tells every guest phone what it shows besides its keys: its seat, the phase and, in a race, place, lap and item.
 *  A hit buzzes the phone at once; the rest goes out a few times per second. */
export class RemoteStatus {
  private secondsSinceSend = 0;
  private secondsSincePing = 0;
  private readonly wasStunned = new Map<number, boolean>();

  constructor(
    private readonly source: RemoteStatusSource,
    private readonly config: RemoteConfig,
  ) {}

  update(frameSeconds: number): void {
    const { input } = this.source;
    if (input.remoteInputs.length === 0) return;
    this.secondsSinceSend += frameSeconds;
    this.secondsSincePing += frameSeconds;
    const due = this.takeIfElapsed('secondsSinceSend', 1 / this.config.statusSendHz);
    const pingDue = this.takeIfElapsed('secondsSincePing', PING_SECONDS);
    for (const remote of input.remoteInputs) {
      const slot = input.slotOfRemote(remote.id);
      if (slot < 0) continue;
      this.buzzOnHit(remote, slot);
      if (due) this.sendStatus(remote, slot);
      if (pingDue) remote.sendPing();
    }
  }

  /** True once per interval: the timer starts over when it has run out. */
  private takeIfElapsed(timer: 'secondsSinceSend' | 'secondsSincePing', intervalSeconds: number): boolean {
    if (this[timer] < intervalSeconds) return false;
    this[timer] = 0;
    return true;
  }

  private buzzOnHit(remote: RemoteInput, slot: number): void {
    const stunned = (this.source.players()[slot]?.state.stunSecondsLeft ?? 0) > 0;
    if (stunned && !this.wasStunned.get(remote.id)) remote.send({ kind: 'buzz' });
    this.wasStunned.set(remote.id, stunned);
  }

  private sendStatus(remote: RemoteInput, slot: number): void {
    const { flow, players, places, lapCount, nameOfSlot } = this.source;
    const player = players()[slot];
    const total = lapCount();
    remote.sendInOwnLanguage(() => ({
      kind: 'status',
      seatIndex: slot,
      name: nameOfSlot(slot),
      color: hexColor(PLAYER_APPEARANCES[slot]?.bodyColor ?? 0xffffff),
      phase: flow.phase,
      place: places()[slot] ?? 0,
      lap: player ? Math.min(player.progress.lap + 1, total) : 0,
      lapCount: total,
      gameStatus: this.source.gameStatusOf(slot),
      item: player?.heldItem ? this.source.itemLabelOf(player.heldItem) : null,
      finished: player?.progress.finished ?? false,
      pausedBy: this.source.pausedBy(),
      away: this.source.awayNames(),
      canDecide: this.source.canDecideAfterRace(slot),
      allowsControllerOnly: this.source.showsSharedPicture(),
    }));
  }
}
