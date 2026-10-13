import { FrameRateGovernor } from '../../app/frameRateGovernor';
import { graphicsEmergency, graphicsLowered } from '../../../shared/ui/problemTexts';
import type { SoundEngine } from '../../../shared/audio/soundEngine';
import { createRuntimeCamera } from '../../../shared/config/camera';
import { createRuntimeGraphics, type GraphicsConfig } from '../../../shared/config/graphics';
import { createRuntimeItems, type ItemConfig } from '../../../shared/config/items';
import type { RemoteConfig } from '../../../shared/config/remote';
import { GameLoop } from '../../../shared/core/loop';
import { simplifiedModeFor } from '../../../shared/input/touch/touchSteering';
import type { InputMessage, RemotePhase, ResultChoice } from '../../../shared/net/messages';
import { speedOf } from '../../../games/kart/kart/kartState';
import { mapOfGame } from '../../../games/kart/modes/gameMaps';
import type { ModeRules } from '../../../games/kart/modes/rules/modeRules';
import { createRuntimeModes } from '../../../shared/config/modes';
import { createRng } from '../../../shared/core/rng';
import type { MapConfig } from '../../../games/kart/maps/shared/mapConfig';
import { kartModeById } from '../../../games/kart/modes/kartModes';
import { createRaceWorld, type RaceWorld } from '../../../games/kart/race/raceWorld';
import { RacePresentation } from '../../../games/kart/race/views/racePresentation';
import type { RaceEvent, RaceSetup } from '../../../games/kart/replication/raceSetup';
import { decodeSnapshot } from '../../../games/kart/replication/snapshot';
import type { RaceSnapshot } from '../../../games/kart/replication/snapshotTypes';
import { applyKartProgress, applyKartSnapshot, applyWorldSnapshot, createRemoteRacer, type RemoteRacer } from '../../../games/kart/replication/snapshotApply';
import { SnapshotTimeline } from '../../../games/kart/replication/snapshotTimeline';
import { ClientHud } from './clientHud';
import { STALE_SNAPSHOT_MILLISECONDS } from './staleSnapshot';
import { ClientDebugReadout } from './clientDebugReadout';
import { ClientResults } from './clientResults';
import { OwnKartLink } from './ownKartLink';
import { playRaceEvent } from './playRaceEvent';
import { LoadingView } from '../../../shared/ui/loadingView';
import { ProblemView } from '../../../shared/ui/problemView';
import { loadGraphicsSettings } from '../../../shared/ui/menus/graphicsPersistence';
import { placeName, t } from '../../../shared/i18n';

export interface ClientRaceDeps {
  readonly canvas: HTMLCanvasElement;
  readonly overlay: HTMLElement;
  readonly config: RemoteConfig;
  /** Called at the start of every 60 Hz step: sends the guest's input to the host and returns what it sent. */
  readonly nextInput: () => InputMessage;
  /** Tells the host this phone has built the race and wants its picture (or will only be a controller). */
  readonly sendReady: (renders: boolean) => void;
  readonly onFailure: () => void;
  /** The phone's one sound, shared with its lobby and its other games. */
  readonly sound: SoundEngine;
}

const colorNumber = (hex: string): number => Number.parseInt(hex.slice(1), 16);

/** The race on a guest phone: draws what the host's snapshots show, with a camera on the own kart. The own kart is predicted
 *  from the guest's own input at once (`OwnKartPredictor`), everything else is shown a little in the past, blended between
 *  snapshots (`SnapshotTimeline`). Nothing of the simulation runs here except the own kart's driving. */
export class ClientRace {
  private readonly graphics: GraphicsConfig = loadGraphicsSettings(createRuntimeGraphics());
  private readonly cameraConfig = createRuntimeCamera();
  private readonly hud: ClientHud;
  private readonly results: ClientResults;
  private readonly loading: LoadingView;
  private readonly problems: ProblemView;
  private readonly debug: ClientDebugReadout;
  private readonly showDebug = new URLSearchParams(window.location.search).has('debug');
  private awayNames: readonly string[] = [];
  private readonly loop: GameLoop;
  private readonly governor: FrameRateGovernor;
  private presentation: RacePresentation | null = null;
  private presentedMapName = '';
  private map: MapConfig | null = null;
  private items: ItemConfig = createRuntimeItems();
  private world: RaceWorld | null = null;
  private rules: ModeRules | null = null;
  private racers: RemoteRacer[] = [];
  private setup: RaceSetup | null = null;
  private timeline: SnapshotTimeline | null = null;
  private readonly ownKart: OwnKartLink;
  private running = false;
  private phase: RemotePhase = 'lobby';
  private lastSnapshotAt = 0;
  private latestSnapshot: RaceSnapshot | null = null;
  private readySent = false;
  private waitingForMap = false;

  constructor(private readonly deps: ClientRaceDeps) {
    this.hud = new ClientHud(deps.overlay);
    this.loading = new LoadingView(deps.overlay);
    this.problems = new ProblemView(deps.overlay);
    this.results = new ClientResults(deps.overlay);
    this.debug = new ClientDebugReadout(deps.overlay);
    this.ownKart = new OwnKartLink(deps.config);
    this.governor = new FrameRateGovernor(this.graphics, (step) => {
      this.presentation?.applyGraphicsQuality();
      this.problems.showNotice(step === 'lowered' ? graphicsLowered() : graphicsEmergency());
    });
    this.loop = new GameLoop({
      update: () => this.update(),
      render: (alpha, frameSeconds) => this.render(alpha, frameSeconds),
      onFailure: () => this.deps.onFailure(),
    });
  }

  /** Builds the race of a setup: the map, the cats and karts, the own kart's prediction. Throws when drawing is impossible (no WebGL). */
  prepare(setup: RaceSetup): void {
    const mode = kartModeById(setup.mode)!;
    this.deps.sound.playMusic(mode.music);
    const map = mapOfGame(mode, setup.mapIndex, createRuntimeModes());
    if (!map) throw new Error('unknown map');
    this.setup = setup;
    this.map = map;
    this.items = createRuntimeItems(map.itemOverrides);
    this.world = createRaceWorld(map, mode.itemsEnabled);
    this.rules = mode.createRules ? mode.createRules({ count: setup.players.length, rng: createRng(0), tuning: createRuntimeModes() }) : null;
    this.results.reset();
    this.timeline = new SnapshotTimeline(setup.snapshotHz, this.deps.config);
    this.latestSnapshot = null;
    this.lastSnapshotAt = 0;
    this.debug.resetGap();
    this.readySent = false;
    this.waitingForMap = true;
    this.governor.restart();
    this.buildPresentation(map);
    this.buildRacers(setup);
    const own = setup.players.find((player) => player.slot === setup.seat)!;
    this.ownKart.reset(map, this.items, own.loadout);
    this.phase = 'racing';
    this.hud.show();
    this.running = true;
    this.loop.start();
  }

  private buildPresentation(map: MapConfig): void {
    if (!this.presentation) {
      this.presentation = new RacePresentation(this.deps.canvas, map, this.cameraConfig, this.deps.sound, this.graphics);
    } else {
      for (const racer of this.racers) this.presentation.removeRacer(racer);
      if (this.presentedMapName !== map.name) this.presentation.setMap(map);
    }
    this.presentedMapName = map.name;
  }

  private buildRacers(setup: RaceSetup): void {
    const presentation = this.presentation!;
    this.racers = setup.players.map((player) => {
      const racer = createRemoteRacer(player.slot !== setup.seat);
      presentation.addRacer(racer, colorNumber(player.color), player.appearance, player.loadout);
      return racer;
    });
  }

  /** The host's pause and the end of the race arrive as the phase of the status messages, with the players whose connection is gone. */
  onStatus(phase: RemotePhase, away: readonly string[]): void {
    this.phase = phase;
    this.awayNames = away;
    if (phase === 'lobby') this.leave();
  }

  onSnapshot(raw: unknown): void {
    if (!(raw instanceof ArrayBuffer) || !this.timeline || !this.setup) return;
    const snapshot = decodeSnapshot(raw);
    if (!snapshot || snapshot.karts.length !== this.setup.players.length) return;
    const now = performance.now();
    if (!this.timeline.push(snapshot, now)) return;
    this.rules?.fromExtras(snapshot.extras);
    if (this.lastSnapshotAt > 0) this.debug.noteSnapshotGap(now - this.lastSnapshotAt);
    this.lastSnapshotAt = now;
    this.latestSnapshot = snapshot;
    const own = snapshot.karts[this.setup.seat];
    if (own) this.ownKart.onSnapshot(own, snapshot.ackInputSequence, now, this.isPredicting(snapshot));
  }

  onEvent(event: RaceEvent): void {
    if (event.type === 'results') this.results.show(event.rows);
    else playRaceEvent(event, { sound: this.deps.sound, presentation: this.presentation, racers: this.racers, items: this.items, seat: this.setup?.seat });
  }

  setDecision(canDecide: boolean, selected: ResultChoice): void {
    this.results.setDecision(canDecide, selected);
  }

  /** The race is over for this phone: back to the lobby view. */
  leave(): void {
    this.running = false;
    this.loop.stop();
    this.deps.sound.stopAllEngines();
    this.hud.hide();
    this.results.clear();
    this.debug.clear();
    this.readySent = false;
    this.waitingForMap = false;
  }

  /** The race plays with the driving controls (only games that are not on the kart engine name their own buttons). */
  readonly touchGame = undefined;

  get itemLabel(): string | undefined {
    return this.setup ? kartModeById(this.setup.mode)?.itemButtonLabel : undefined;
  }

  /** Whether the race loop runs and sends the guest's input itself (otherwise the page does). */
  get isRunning(): boolean {
    return this.running;
  }

  getState() {
    return {
      ready: this.readySent,
      phase: this.phase,
      seat: this.setup?.seat ?? -1,
      snapshots: this.timeline?.statistics ?? { received: 0, dropped: 0 },
      predicting: this.latestSnapshot ? this.isPredicting(this.latestSnapshot) : false,
      prediction: { ...this.ownKart.statistics },
      karts: this.racers.map((racer) => ({ x: racer.state.x, z: racer.state.z, yaw: racer.state.yaw, speed: speedOf(racer.state), lap: racer.progress.lap })),
      ownShown: this.ownKart.shownPose(),
      gameId: this.setup?.mode ?? null,
      statusLines: this.rules?.statusLines() ?? [],
      outSeats: this.racers.flatMap((_, slot) => (this.rules?.isOut(slot) ? [slot] : [])),
      camera: this.presentation?.diagnostics().camera ?? null,
      raceTimeSeconds: this.world?.raceTimeSeconds ?? 0,
      graphicsQuality: this.graphics.quality,
      emergencyGraphics: this.graphics.emergency,
      roundTripMilliseconds: Math.round(this.ownKart.roundTripMilliseconds),
      rendering: this.presentation?.diagnostics().rendering ?? null,
      results: this.results.shownRows,
    };
  }

  private isPredicting(snapshot: RaceSnapshot): boolean {
    const own = snapshot.karts[this.setup?.seat ?? -1];
    return own !== undefined && snapshot.countdownSecondsLeft <= 0 && !own.finished && this.phase === 'racing';
  }

  /** One 60 Hz step: send the input, move the others to where the timeline says, run the own kart. */
  private update(): void {
    const { presentation, setup, timeline, world } = this;
    const message = this.deps.nextInput();
    const now = performance.now();
    this.ownKart.noteSent(message, now);
    if (!presentation || !setup || !timeline || !world) return;
    presentation.snapshotPoses(this.racers);
    this.ownKart.countStep();
    const sample = timeline.sample(now);
    if (sample) {
      sample.karts.forEach((kart, slot) => {
        const racer = this.racers[slot];
        if (!racer) return;
        if (slot !== setup.seat) applyKartSnapshot(racer.state, kart);
        applyKartProgress(racer, kart);
      });
      applyWorldSnapshot(world, sample.latest);
    }
    const own = this.racers[setup.seat];
    const newest = this.latestSnapshot;
    if (!own || !newest) return;
    this.ownKart.step(
      message,
      {
        predicting: this.isPredicting(newest) && now - this.lastSnapshotAt < STALE_SNAPSHOT_MILLISECONDS,
        hostKart: sample ? newest.karts[setup.seat] : undefined,
        simpleMode: simplifiedModeFor(this.cameraConfig.mode),
      },
      own.state,
    );
  }

  private render(alpha: number, frameSeconds: number): void {
    const { presentation, map, world } = this;
    if (!presentation || !map || !world) return;
    presentation.setFrameAlpha(alpha);
    const racing = this.phase === 'racing' && this.latestSnapshot !== null;
    this.racers.forEach((racer, slot) => {
      racer.hidden = this.rules?.isOut(slot) ?? false;
    });
    presentation.update(frameSeconds, this.racers, world, this.items, racing);
    presentation.setModeVisual(this.rules?.visual ?? { kind: 'none' }, this.racers, frameSeconds);
    const ready = presentation.isMapReady();
    this.loading.update(this.waitingForMap && !ready, t().race.loading(placeName(map.name)), frameSeconds);
    if (ready && !this.readySent) {
      this.readySent = true;
      this.waitingForMap = false;
      this.deps.sendReady(true);
    }
    this.updateHud(map);
    if (racing && ready) this.governor.observe(frameSeconds);
    this.problems.update(frameSeconds);
    presentation.render(frameSeconds, this.racers);
    if (this.showDebug) this.debug.frame(frameSeconds, () => ({ roundTripMilliseconds: this.ownKart.roundTripMilliseconds, ...this.ownKart.statistics }));
  }

  private updateHud(map: MapConfig): void {
    const { setup, latestSnapshot: snapshot } = this;
    const own = setup ? this.racers[setup.seat] : undefined;
    if (!setup || !own || !snapshot) return;
    this.hud.update({ setup, map, own, snapshot, phase: this.phase, away: this.awayNames, lastSnapshotAt: this.lastSnapshotAt, rules: this.rules });
  }
}
