import { currentLanguage } from '../../../shared/i18n/language';
import { t } from '../../../shared/i18n';
import { html, nothing, render, type TemplateResult } from 'lit';
import type { GuestGame } from '../../client/guestGame';
import { GuestGames } from './guestGames';
import { GuestLobby } from './guestLobby';
import { guestTouchState } from './guestTouchState';
import { createRuntimeRemote, REMOTE_OFFER_HASH_KEY } from '../../../shared/config/remote';
import { TouchSource } from '../../../shared/input/touch/touchSource';
import { AVAILABLE_MAPS } from '../../../games/kart/maps/registry';
import { GAMES } from '../../games';
import { parseGuestLobbyState } from '../../../games/kart/replication/lobbyState';
import { parseRaceEvent } from '../../../games/kart/replication/raceSetup';
import { parseHostMessage, type HostMessage, type InputMessage, type StatusMessage } from '../../../shared/net/messages';
import { ScreenWakeLock } from '../../../shared/net/screenWakeLock';
import { PausePanel } from '../pausePanel';
import { ResultsChoice, resultChoiceOf } from '../resultsChoice';
import { RememberedProfile } from './rememberedProfile';
import type { ViewMode } from './guestViewMode';
import { GuestControls } from './guestControls';
import { HostLink } from './hostLink';
import { answerContent, connectedContent, problemContent, type JoinView } from './joinContent';
import { TouchControls } from '../../../shared/touch/touchControls';

const BUZZ_MILLISECONDS = 250;

type HostMessageHandlers = { readonly [Kind in HostMessage['kind']]: (message: Extract<HostMessage, { kind: Kind }>) => void };

/** The page a guest phone opens from the host's QR code: it answers with a QR code of its own, then shows its seat and the
 *  on-screen controls. In a race it draws the picture itself (`ClientRace`, loaded only then) or stays a plain controller,
 *  as the guest chose. The game itself always runs on the host. */
export class JoinPage {
  private view: JoinView = { kind: 'noCode' };
  private readonly source = new TouchSource();
  private readonly touchControls: TouchControls;
  private readonly controls = new GuestControls();
  private readonly config = createRuntimeRemote();
  private readonly wakeLock = new ScreenWakeLock();
  private readonly statusRoot = document.createElement('div');
  private readonly host = new HostLink();
  private readonly games: GuestGames;
  /** The game this phone draws now. */
  private activeGame: GuestGame | null = null;
  private readonly guestLobby: GuestLobby;
  private readonly profile = new RememberedProfile((profile) => this.host.sendProfile(profile));
  private readonly resultsChoice = new ResultsChoice({
    choose: (choice) => this.host.sendDecision(choice),
    changed: () => this.draw(),
  });
  private readonly pausePanel = new PausePanel({
    resume: () => this.resumeRace(),
    leave: () => this.leaveGame(),
    changed: () => this.draw(),
  });
  private raceShown = false;
  private notice: string | null = null;
  private sendTimer: number | null = null;

  constructor(
    overlay: HTMLElement,
    touchRoot: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.touchControls = new TouchControls(touchRoot, this.source);
    this.guestLobby = new GuestLobby({
      overlay,
      sendTap: (tap) => this.host.sendTap(tap),
      ownScreenChosen: () => this.shownMode === 'own',
      loaded: () => this.draw(),
      failed: () => {
        this.notice = t().problems.join.lobbyUnavailable;
        this.draw();
      },
    });
    this.games = new GuestGames({
      canvas,
      overlay,
      config: this.config,
      nextInput: () => this.tickInput(),
      sendReady: (renders) => this.host.sendReady(renders),
      onFailure: () => this.stayController(t().problems.join.raceUnavailable),
    });
    overlay.appendChild(this.statusRoot);
    overlay.addEventListener('pointerup', this.onPointerUp);
    canvas.hidden = true;
    window.__guest = { getState: () => this.getState() };
  }

  start(): void {
    this.draw();
    const code = new URLSearchParams(window.location.hash.slice(1)).get(REMOTE_OFFER_HASH_KEY);
    if (!code) return;
    if (typeof RTCPeerConnection === 'undefined') {
      this.show({ kind: 'noWebRtc' });
      return;
    }
    void this.answer(code);
  }

  getState() {
    return {
      view: this.view.kind,
      viewMode: this.controls.viewMode,
      raceShown: this.raceShown,
      notice: this.notice,
      seat: this.view.kind === 'connected' ? (this.view.status?.seatIndex ?? null) : null,
      phase: this.view.kind === 'connected' ? (this.view.status?.phase ?? null) : null,
      race: this.activeGame?.getState() ?? null,
    };
  }

  private async answer(offerCode: string): Promise<void> {
    try {
      const answerCode = await this.host.answer(this.config, offerCode, {
        onOpen: () => this.onOpen(),
        onLost: () => this.onLost(),
        onRawInput: () => undefined,
        onRawControl: (raw) => this.onHostMessage(raw),
        onRawState: (raw) => this.activeGame?.onSnapshot(raw),
      });
      this.show(answerCode ? { kind: 'answer', answerCode } : { kind: 'badCode' });
    } catch {
      this.show({ kind: 'failed' });
    }
  }

  private onOpen(): void {
    this.show({ kind: 'connected', status: null });
    this.host.sendLanguage(currentLanguage());
    this.profile.sendSaved();
    this.wakeLock.hold(true);
    this.sendTimer = window.setInterval(() => {
      if (!this.activeGame?.isRunning) this.tickInput();
    }, 1000 / this.config.inputSendHz);
  }

  private stopPlaying(): void {
    if (this.sendTimer !== null) window.clearInterval(this.sendTimer);
    this.sendTimer = null;
    this.wakeLock.hold(false);
    this.source.releaseAll();
    this.activeGame?.leave();
    this.raceShown = false;
  }

  private onLost(): void {
    this.stopPlaying();
    this.show({ kind: this.view.kind === 'connected' ? 'ended' : 'failed' });
  }

  /** Reads the keys, sends them to the host and hands the message back (the race predicts the own kart from it). */
  private tickInput(): InputMessage {
    const snapshot = this.source.takeSnapshot();
    const message = this.host.sendInput(snapshot, this.controls.touchSettings.mode);
    this.pausePanel.followKeys(snapshot.pressedBits, this.isPaused());
    this.resultsChoice.followKeys(snapshot.pressedBits, this.isDeciding());
    return message;
  }

  /** The pause panel of this phone shows (and takes the cross) only when the race is drawn here; otherwise the host's screen has the menu. */
  private isPaused(): boolean {
    return this.raceShown && this.view.kind === 'connected' && this.view.status?.phase === 'paused';
  }

  /** The result page of a race drawn here, on a phone that chooses for a host without a player. */
  private isDeciding(): boolean {
    const status = this.currentStatus();
    return this.raceShown && status?.phase === 'results' && status.canDecide;
  }

  /** "Resume" is the pause key pressed again: the host resumes. */
  private resumeRace(): void {
    this.source.setHeld('pause', true);
    this.source.setHeld('pause', false);
  }

  private leaveGame(): void {
    this.host.close();
    this.stopPlaying();
    this.show({ kind: 'left' });
  }

  /** What each message of the host does on this phone. */
  private readonly hostHandlers: HostMessageHandlers = {
    buzz: () => navigator.vibrate?.(BUZZ_MILLISECONDS),
    ping: (message) => this.host.answerPing(message.sentAt),
    status: (message) => this.onStatus(message),
    setup: (message) => this.onSetup(message.game, message.setup),
    lobby: (message) => this.onLobby(message.lobby),
    event: (message) => this.onEvent(message.event),
  };

  private onHostMessage(raw: unknown): void {
    const message = parseHostMessage(raw);
    if (message) (this.hostHandlers[message.kind] as (message: HostMessage) => void)(message);
  }

  private onStatus(status: StatusMessage): void {
    this.activeGame?.onStatus(status.phase, status.away);
    if (status.phase === 'lobby') this.raceShown = false;
    this.show({ kind: 'connected', status });
  }

  private onEvent(raw: unknown): void {
    const event = parseRaceEvent(raw);
    if (event) this.activeGame?.onEvent(event);
  }

  /** The host's lobby state: it is what the own lobby screen draws, and what this phone remembers for the next time. */
  private onLobby(raw: unknown): void {
    const lobby = parseGuestLobbyState(raw, Math.max(AVAILABLE_MAPS.length, GAMES.length));
    if (!lobby) return;
    if (lobby.entry) this.profile.onLobbyEntry(lobby.entry);
    this.guestLobby.receive(lobby);
    this.draw();
  }

  /** The host has a game ready. This phone either builds it and draws it, or tells the host it stays a controller. */
  private onSetup(game: string, raw: unknown): void {
    const plan = this.games.plan(game, raw);
    if (plan) void this.startGame(plan.buildId, plan.build);
  }

  /** This phone either builds the game and draws it, or tells the host it stays a controller (its own choice, another build, a game it cannot draw). */
  private async startGame(buildId: string, build: () => Promise<GuestGame>): Promise<void> {
    this.notice = null;
    if (this.shownMode === 'controller') {
      this.host.sendReady(false);
      return;
    }
    if (buildId !== __BUILD_ID__) {
      this.stayController(t().problems.join.versionMismatch);
      return;
    }
    try {
      const previous = this.activeGame;
      const game = await build();
      if (previous && previous !== game) previous.leave();
      this.activeGame = game;
      this.raceShown = true;
      this.draw();
    } catch {
      this.stayController(t().problems.join.raceUnavailable);
    }
  }

  private stayController(reason: string): void {
    this.activeGame?.leave();
    this.raceShown = false;
    this.notice = reason;
    this.host.sendReady(false);
    this.draw();
  }

  /** What a tap on each of the page's own buttons does. */
  private readonly tapActions: readonly (readonly [selector: string, action: (button: Element) => void])[] = [
    ['[data-guest-mode]', () => this.controls.nextSteeringMode()],
    ['[data-guest-layout]', () => this.controls.nextLayout()],
    ['[data-guest-view]', () => this.switchViewMode()],
    ['[data-guest-sound]', () => this.activeGame?.setMuted(this.controls.toggleSound())],
    ['[data-guest-language]', () => this.host.sendLanguage(this.controls.switchLanguage())],
    ['[data-result-option]', (button) => this.resultsChoice.choose(resultChoiceOf(button.getAttribute('data-result-option')))],
    ['[data-pause-option]', (button) => this.pausePanel.choose(button.getAttribute('data-pause-option') === 'leave' ? 'leave' : 'resume')],
  ];

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!(event.target instanceof Element)) return;
    const target = event.target;
    const tap = this.tapActions.find(([selector]) => target.closest(selector) !== null);
    if (!tap) return;
    tap[1](target.closest(tap[0])!);
    this.draw();
  };

  /** "Nur Controller" takes effect at once (the host stops sending the picture). "Eigener Bildschirm" in a running race asks the host for
   *  the setup again; before a race it simply holds from the next race on. */
  private switchViewMode(): void {
    const viewMode = this.controls.toggleViewMode();
    if (viewMode === 'controller' && this.raceShown) {
      this.activeGame?.leave();
      this.raceShown = false;
      this.host.sendReady(false);
    } else if (viewMode === 'own' && this.raceIsOn()) {
      this.host.askForPicture();
    }
  }

  /** What this phone really does: a host that cannot show a shared picture (a phone) takes the choice away, every guest draws its own screen. */
  private get shownMode(): ViewMode {
    return this.currentStatus()?.allowsControllerOnly === false ? 'own' : this.controls.viewMode;
  }

  private raceIsOn(): boolean {
    const phase = this.currentStatus()?.phase;
    return phase === 'racing' || phase === 'paused';
  }

  private show(view: JoinView): void {
    this.view = view;
    this.draw();
  }

  private currentStatus(): StatusMessage | null {
    return this.view.kind === 'connected' ? this.view.status : null;
  }

  private updateTouchControls(status: StatusMessage | null, drawingRace: boolean): void {
    this.touchControls.update(
      guestTouchState({
        status,
        drawingRace,
        connected: this.view.kind === 'connected',
        settings: this.controls.touchSettings,
        touchGame: this.activeGame?.touchGame,
        itemLabel: this.activeGame?.itemLabel,
      }),
    );
  }

  /** The page's own buttons (steering, layout, view, sound); "Nur Controller" only where the host can show a shared picture. */
  private controlButtons(): TemplateResult {
    return this.controls.buttons(this.shownMode, this.currentStatus()?.allowsControllerOnly !== false);
  }

  private draw(): void {
    const status = this.currentStatus();
    const drawingRace = this.raceShown && this.view.kind === 'connected';
    this.canvas.hidden = !drawingRace;
    this.updateTouchControls(status, drawingRace);
    if (!this.isDeciding()) this.resultsChoice.reset();
    this.activeGame?.setDecision(this.isDeciding(), this.resultsChoice.selected);
    const drawingLobby = this.guestLobby.update(status, this.controlButtons(), this.view.kind === 'connected' && !drawingRace);
    if (status?.phase === 'paused' && drawingRace) {
      render(this.pausePanel.template(status, this.controlButtons()), this.statusRoot);
      return;
    }
    this.pausePanel.reset();
    if (drawingRace || drawingLobby) render(nothing, this.statusRoot);
    else render(html`<c-screen tone="solid" data-join-view=${this.view.kind}>${this.content()}</c-screen>`, this.statusRoot);
  }

  private content(): TemplateResult {
    const { view } = this;
    if (view.kind === 'answer') return answerContent(view.answerCode);
    if (view.kind === 'connected') {
      return connectedContent({ status: view.status, waitingForHost: this.guestLobby.waitingForHost(), notice: this.notice, buttons: this.controlButtons() });
    }
    return problemContent(view.kind);
  }
}
