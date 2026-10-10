import { html, nothing, render } from 'lit';
import type { RemoteRacer } from '../../../games/kart/replication/snapshotApply';
import type { MapConfig } from '../../../games/kart/maps/shared/mapConfig';
import { routeDrivingHint } from '../../../games/kart/maps/shared/routeGuidance';
import { windowJumpHint } from '../../../games/kart/maps/shared/windowJumps';
import type { ModeRules } from '../../../games/kart/modes/rules/modeRules';
import type { RemotePhase } from '../../../shared/net/messages';
import type { RaceSetup } from '../../../games/kart/replication/raceSetup';
import type { RaceSnapshot } from '../../../games/kart/replication/snapshotTypes';
import { HudView, itemLabelFor, type HudPlayer } from '../../../shared/ui/hud';
import { STALE_SNAPSHOT_MILLISECONDS } from './staleSnapshot';
import { t } from '../../../shared/i18n';

interface HudContext {
  readonly setup: RaceSetup;
  readonly map: MapConfig;
  readonly own: RemoteRacer;
  readonly snapshot: RaceSnapshot;
  readonly phase: RemotePhase;
  readonly away: readonly string[];
  readonly lastSnapshotAt: number;
  /** The mirror of the rules of the game, or null in the plain race. */
  readonly rules: ModeRules | null;
}

/** The own card: place, lap and item in a race, the score of the game when it has its own rules. */
/** The big label at the start: the seconds of the countdown, then "Los!" for a moment. */
function startLabelOf(snapshot: RaceSnapshot): string | null {
  if (snapshot.countdownSecondsLeft > 0) return String(Math.ceil(snapshot.countdownSecondsLeft));
  return snapshot.goDisplayActive ? t().race.go : null;
}

function ownCard({ setup, map, own, snapshot, rules }: HudContext): HudPlayer {
  const card: HudPlayer = {
    lap: own.progress.lap,
    place: snapshot.karts[setup.seat]?.place ?? 0,
    finished: own.progress.finished,
    heldItem: own.heldItem,
    ...(own.heldItem ? { heldItemLabel: itemLabelFor(own.heldItem, map) } : {}),
    penaltySecondsLeft: own.state.penaltySecondsLeft,
    slot: setup.seat,
    fieldSize: setup.players.length,
  };
  if (rules)
    return {
      ...card,
      statusText: rules.cardText(setup.seat),
      placeHidden: true,
      title: setup.players.find((player) => player.slot === setup.seat)?.name ?? '',
    };
  const { nextCheckpoint } = own.progress;
  return {
    ...card,
    objective: map.checkpoints[nextCheckpoint]?.name ?? null,
    drivingHint: windowJumpHint(map, own.state) ?? routeDrivingHint(map, own.state, nextCheckpoint),
  };
}

/** The score cards over the picture and the banner that tells when the host's snapshots stopped coming. */
export class ClientHud {
  private readonly view: HudView;
  private readonly bannerRoot = document.createElement('div');

  constructor(overlay: HTMLElement) {
    this.view = new HudView(overlay);
    this.view.hide();
    this.bannerRoot.dataset.testid = 'client-banner';
    overlay.appendChild(this.bannerRoot);
  }

  show(): void {
    this.view.show();
  }

  hide(): void {
    this.view.hide();
    render(nothing, this.bannerRoot);
  }

  update(context: HudContext): void {
    const { setup, snapshot, phase, away, lastSnapshotAt, rules } = context;
    const startLabel = startLabelOf(snapshot);
    this.view.update(
      [ownCard(context)],
      setup.lapCount,
      snapshot.raceTimeSeconds,
      phase === 'racing' ? snapshot.finishCountdownSeconds : null,
      startLabel,
      away,
      rules?.statusLines() ?? [],
    );
    // The pause panel of the page covers the picture; the cards would only shine through it.
    if (phase === 'paused') this.view.hide();
    else this.view.show();
    this.drawBanner(snapshot, phase, lastSnapshotAt);
  }

  /** What the player must know when the picture stands still because the host's snapshots stopped coming (a pause has its own panel on the page). */
  private drawBanner(snapshot: RaceSnapshot, phase: RemotePhase, lastSnapshotAt: number): void {
    const stalled = phase === 'racing' && performance.now() - lastSnapshotAt > STALE_SNAPSHOT_MILLISECONDS && snapshot.countdownSecondsLeft <= 0;
    render(stalled ? html`<c-alert-banner raised role="status">Verbindung hakt …</c-alert-banner>` : nothing, this.bannerRoot);
  }
}
