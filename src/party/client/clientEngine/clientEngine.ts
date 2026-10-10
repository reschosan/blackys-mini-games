import { playerDisplayName } from '../../../shared/i18n/labels';
import { SoundEngine } from '../../../shared/audio/soundEngine';
import { createRuntimeAudio } from '../../../shared/config/audio';
import { createRuntimeCamera } from '../../../shared/config/camera';
import { createRuntimeGraphics } from '../../../shared/config/graphics';
import { createRuntimeModes } from '../../../shared/config/modes';
import type { RemoteConfig } from '../../../shared/config/remote';
import { GameLoop } from '../../../shared/core/loop';
import type { EngineView } from '../../../shared/game/engineView';
import type { TouchGame } from '../../../shared/game/gameCard';
import type { InputMessage, RemotePhase, ResultChoice } from '../../../shared/net/messages';
import type { RaceEvent } from '../../../games/kart/replication/raceSetup';
import { createArenaMap } from '../../../games/kart/modes/arena/arenaMaps';
import { RacePresentation } from '../../../games/kart/race/views/racePresentation';
import { HudView, type HudPlayer } from '../../../shared/ui/hud';
import { loadAudioSettings } from '../../../shared/ui/menus/audioPersistence';
import { loadGraphicsSettings } from '../../../shared/ui/menus/graphicsPersistence';
import type { EngineEntry } from '../../engine/engineView';
import type { GuestEngineSetup } from '../../engine/engineSetup';
import { decodeEngineFrame, type EngineFrame } from '../../engine/engineWire';
import { ClientResults } from '../clientRace/clientResults';
import type { GuestGame } from '../guestGame';

export interface ClientEngineDeps {
  readonly canvas: HTMLCanvasElement;
  readonly overlay: HTMLElement;
  readonly config: RemoteConfig;
  /** Called at the start of every 60 Hz step: sends the guest's input to the host. */
  readonly nextInput: () => InputMessage;
  /** Tells the host this phone has built the game and wants its picture. */
  readonly sendReady: (renders: boolean) => void;
  readonly onFailure: () => void;
}

/** A game that is not on the kart engine, on a guest phone: it draws what the host's snapshots show and sends the guest's input, nothing more. */
export class ClientEngine implements GuestGame {
  private readonly hud: HudView;
  private readonly results: ClientResults;
  private readonly sound = new SoundEngine(loadAudioSettings(createRuntimeAudio()));
  private readonly root = document.createElement('div');
  private readonly loop: GameLoop;
  private view: EngineView | null = null;
  private setup: GuestEngineSetup | null = null;
  private presentation: RacePresentation | null = null;
  private frame: EngineFrame | null = null;
  private phase: RemotePhase = 'lobby';
  private awayNames: readonly string[] = [];
  private running = false;
  private readySent = false;

  constructor(private readonly deps: ClientEngineDeps) {
    this.root.dataset.testid = 'client-engine';
    deps.overlay.appendChild(this.root);
    this.hud = new HudView(deps.overlay);
    this.hud.hide();
    this.results = new ClientResults(deps.overlay);
    this.loop = new GameLoop({
      update: () => {
        deps.nextInput();
      },
      render: (_alpha, frameSeconds) => this.render(frameSeconds),
      onFailure: () => deps.onFailure(),
    });
    window.addEventListener('pointerdown', () => this.sound.unlock(), { once: true });
  }

  /** Builds the game of a setup. Throws when drawing is impossible (no WebGL for a 3D game). */
  prepare(setup: GuestEngineSetup, entry: EngineEntry): void {
    this.leave();
    this.setup = setup;
    this.touchGame = entry.game.touch;
    this.frame = null;
    this.results.reset();
    this.view = entry.createView(setup.seats);
    this.view.mount(this.root);
    if (this.view.scene && !this.presentation) {
      this.presentation = new RacePresentation(
        this.deps.canvas,
        createArenaMap('platform', createRuntimeModes()),
        createRuntimeCamera(),
        this.sound,
        loadGraphicsSettings(createRuntimeGraphics()),
      );
    }
    this.phase = 'racing';
    this.hud.show();
    this.running = true;
    this.readySent = false;
    this.loop.start();
  }

  touchGame: TouchGame | undefined;

  get isRunning(): boolean {
    return this.running;
  }

  onStatus(phase: RemotePhase, away: readonly string[]): void {
    this.phase = phase;
    this.awayNames = away;
    if (phase === 'lobby') this.leave();
  }

  onSnapshot(raw: unknown): void {
    if (!(raw instanceof ArrayBuffer) || !this.view) return;
    const frame = decodeEngineFrame(raw);
    if (!frame) return;
    this.frame = frame;
    this.view.apply(frame.state);
  }

  onEvent(event: RaceEvent): void {
    if (event.type === 'results') this.results.show(event.rows);
  }

  setMuted(muted: boolean): void {
    this.sound.setMuted(muted);
  }

  setDecision(canDecide: boolean, selected: ResultChoice): void {
    this.results.setDecision(canDecide, selected);
  }

  /** The game is over for this phone: back to the lobby view. */
  leave(): void {
    this.running = false;
    this.loop.stop();
    this.hud.hide();
    this.results.clear();
    this.view?.dispose();
    this.view = null;
  }

  getState() {
    return {
      ready: this.readySent,
      phase: this.phase,
      seat: this.setup?.seat ?? -1,
      gameId: null,
      statusLines: this.frame?.hud.lines ?? [],
      outSeats: [],
      snapshot: this.frame?.state ?? null,
      results: this.results.shownRows,
    };
  }

  private render(frameSeconds: number): void {
    const { view, frame, setup } = this;
    if (!view || !setup) return;
    if (!this.readySent) {
      this.readySent = true;
      this.deps.sendReady(true);
    }
    view.frame(frameSeconds, [setup.seat]);
    if (this.presentation) {
      this.presentation.renderScene(view.scene, view.camerasFor([setup.seat]));
    }
    if (frame) this.drawHud(frame);
  }

  private drawHud(frame: EngineFrame): void {
    const seats = this.setup!.seats;
    const cards: HudPlayer[] = seats.map((seat) => ({
      lap: 0,
      place: frame.hud.places[seat.slot] ?? 0,
      finished: false,
      heldItem: null,
      slot: seat.slot,
      fieldSize: seats.length,
      statusText: frame.hud.cards[seat.slot] ?? '',
      placeHidden: true,
      title: playerDisplayName(seat.name, seat.slot),
    }));
    this.hud.update(cards, 1, 0, null, frame.hud.countdown, this.awayNames, frame.hud.lines);
    if (this.phase === 'paused') this.hud.hide();
    else this.hud.show();
  }
}
