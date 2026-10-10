import { mapModelsMissing } from '../../../shared/ui/problemTexts';
import { GameLoop } from '../../../shared/core/loop';
import { RuntimeMetrics } from '../../../shared/debug/runtimeMetrics';
import type { InputFrame } from '../../../shared/input/actions';
import type { KartOrientation } from '../../../shared/input/inputManager';
import { simplifiedModeFor } from '../../../shared/input/touch/touchSteering';
import type { ProblemView } from '../../../shared/ui/problemView';
import { forwardSpeedOf } from '../../../games/kart/kart/kartState';
import { menuFramesFor } from '../menuFrames';
import { thisScreenCanSplit } from '../viewerLayout';
import { BrowserGuards } from './browserGuards';
import { GameParts } from './gameParts';
import { gameStateOf } from './gameStateReport';
import type { DevHooks } from './devHooks';
import { placeName, t } from '../../../shared/i18n';

const ENDURANCE_STEPS_PER_FRAME = 30;

/** The game on the host: drives its parts (built and wired in `GameParts`) every 60 Hz step and every drawn frame. */
export class Game {
  private readonly parts: GameParts;
  private readonly guards: BrowserGuards;
  private readonly loop: GameLoop;
  private readonly runtimeMetrics = new RuntimeMetrics();
  private simulationMillisecondsThisFrame = 0;
  /** Endurance races of the browser tests run many simulation steps per drawn frame. */
  private enduranceMode = false;

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement, touchRoot: HTMLElement, problems: ProblemView) {
    this.parts = new GameParts(canvas, overlay, touchRoot, problems, (on) => {
      this.enduranceMode = on;
    });
    this.guards = new BrowserGuards({
      canvas,
      problems,
      sound: this.parts.sound,
      pauseRunningRace: () => this.parts.lifecycle.pauseRunningRace(),
    });
    this.loop = new GameLoop({
      update: (stepSeconds) => this.update(stepSeconds),
      render: (alpha, frameSeconds, elapsedFrameSeconds) => this.render(alpha, frameSeconds, elapsedFrameSeconds),
      onFailure: (error) => this.guards.reportLoopFailure(error),
    });
  }

  /** The entry points of the browser tests (development server only). */
  get dev(): DevHooks {
    return this.parts.dev;
  }

  start(): void {
    this.loop.start();
  }

  getState() {
    return gameStateOf(this.parts, { runtime: this.runtimeMetrics.snapshot(), enduranceMode: this.enduranceMode });
  }

  /** The seats that look at this screen: the humans whose own phone does not draw for them (all of them when the screen can be split, otherwise one). */
  private viewerSeats(): readonly number[] {
    const { players, remote } = this.parts;
    const seats = players.flatMap((player, slot) => (!player.isAi && !remote.race.drawsItself(slot) ? [slot] : []));
    return thisScreenCanSplit() ? seats : seats.slice(0, 1);
  }

  private kartOrientations(): readonly KartOrientation[] {
    const { flow, engines, players, configs } = this.parts;
    if (flow.phase !== 'racing') return [];
    if (engines.round) return players.map(() => ({ yaw: 0, forwardSpeed: 0 }));
    return players.map((player) => ({
      yaw: player.state.yaw,
      forwardSpeed: forwardSpeedOf(player.state),
      simpleMode: simplifiedModeFor(configs.camera.mode),
    }));
  }

  private update(stepSeconds: number): void {
    const startMilliseconds = performance.now();
    try {
      this.runSimulationStep(stepSeconds);
    } finally {
      this.simulationMillisecondsThisFrame += performance.now() - startMilliseconds;
    }
  }

  private runSimulationStep(stepSeconds: number): void {
    const { input, configs, remote, players, flow, presentation } = this.parts;
    input.controlMode = configs.touchSettings.mode;
    remote.tick(stepSeconds);
    if (input.players.length > 0) this.guards.startAudioOnce();
    const frames = input.readFrames(this.kartOrientations());
    players.forEach((player, index) => {
      player.viewedElsewhere = remote.race.drawsItself(index);
    });

    const updateCount = this.enduranceMode && flow.phase === 'racing' ? ENDURANCE_STEPS_PER_FRAME : 1;
    for (let step = 0; step < updateCount; step += 1) {
      this.runtimeMetrics.recordSimulationTick();
      presentation.snapshotPoses(players);
      this.updatePhase(frames, stepSeconds);
      if (flow.phase !== 'racing') break;
    }
  }

  private updatePhase(frames: readonly InputFrame[], stepSeconds: number): void {
    const { flow, lobby, menus, lifecycle, players } = this.parts;
    const menuFrames = menuFramesFor(frames, players);
    if (flow.phase === 'lobby' && flow.settingsOpen) {
      lobby.noteSettingsOpen();
      menus.update(menuFrames, stepSeconds, false);
    } else if (flow.phase === 'lobby') lobby.update(frames);
    else if (flow.phase === 'racing') lifecycle.updateRace(frames, stepSeconds);
    else menus.update(menuFrames, stepSeconds, flow.phase === 'paused');
  }

  private render(alpha: number, frameSeconds: number, elapsedFrameSeconds: number): void {
    const startMilliseconds = performance.now();
    this.runtimeMetrics.recordFrame(elapsedFrameSeconds);
    this.drawScene(alpha, frameSeconds);
    this.updateScreens(frameSeconds);
    const { engines, flow, presentation, players } = this.parts;
    if (!engines.draw(frameSeconds, flow.phase, this.viewerSeats())) presentation.render(frameSeconds, players);
    this.runtimeMetrics.recordWork(this.simulationMillisecondsThisFrame, performance.now() - startMilliseconds);
    this.simulationMillisecondsThisFrame = 0;
    this.parts.performanceView.update(frameSeconds, () => this.runtimeMetrics.snapshot());
  }

  /** The 3D picture of the kart games: interpolated poses, effects, the mode's own pieces, and the graphics governor watching the frame rate. */
  private drawScene(alpha: number, frameSeconds: number): void {
    const { presentation, debugPanel, players, world, configs, session, flow, governor } = this.parts;
    const racing = flow.phase === 'racing';
    presentation.setFrameAlpha(alpha);
    presentation.setSplitScreenAllowed(thisScreenCanSplit());
    debugPanel?.trackFrame(frameSeconds);
    presentation.update(frameSeconds, players, world, configs.items, racing);
    presentation.setModeVisual(session.rules?.visual ?? { kind: 'none' }, players, frameSeconds);
    if (racing && presentation.isMapReady()) governor.observe(frameSeconds);
  }

  /** Everything over the picture: HUD and menus, the guests' screens, the loading screen and notices. */
  private updateScreens(frameSeconds: number): void {
    const { overlays, remote, loading, presentation, problems, flow, lifecycle } = this.parts;
    const racing = flow.phase === 'racing';
    const { name: mapName } = lifecycle.map;
    overlays.update(frameSeconds);
    remote.update(frameSeconds);
    loading.update(racing && !presentation.isMapReady(), t().race.loading(placeName(mapName)), frameSeconds);
    if (racing && presentation.hasMapAssetsFailed()) problems.showNotice(mapModelsMissing(placeName(mapName)));
    problems.update(frameSeconds);
  }
}
