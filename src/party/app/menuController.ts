import { html, nothing, type TemplateResult } from 'lit';
import type { AudioConfig } from '../../shared/config/audio';
import type { GraphicsQuality } from '../../shared/config/graphics';
import type { MenuScrollConfig } from '../../shared/config/input';
import type { RaceConfig } from '../../shared/config/race';
import type { TouchSettings } from '../../shared/config/touch';
import type { ScreenTone } from '../../shared/ui/components/cScreen';
import type { GameFlow, InfoPageKind } from '../../shared/core/gameFlow';
import type { InputFrame } from '../../shared/input/actions';
import type { SoundEngine } from '../../shared/audio/soundEngine';
import { saveAudioSettings } from '../../shared/ui/menus/audioPersistence';
import {
  pauseOptions,
  resultOptions,
  backOption,
  scrollPageHint,
  aboutBody,
  audioMenuOptions,
  controlsBody,
  creditsBody,
  privacyBody,
  settingsMenuOptions,
} from '../../shared/ui/menus/menuContent';
import type { MenuInput } from '../../shared/ui/menus/menuInput';
import { MenuOverlay, type MenuOption } from '../../shared/ui/menus/menuOverlay';
import { inviteHint } from '../../shared/ui/invite/inviteView';
import { t, type Texts } from '../../shared/i18n';
import { nextLanguage, setLanguage } from '../../shared/i18n/language';

const VOLUME_STEP = 0.1;

interface InfoPage {
  readonly title: (menus: Texts['menus']) => string;
  readonly body: () => TemplateResult;
}

/** The pages that only show something and lead back. Each has the option `<kind>` that opens it and `<kind>Back` that leaves it. */
const INFO_PAGES: Readonly<Record<InfoPageKind, InfoPage>> = {
  controls: { title: (menus) => menus.controls, body: controlsBody },
  about: { title: (menus) => menus.about, body: aboutBody },
  credits: { title: (menus) => menus.credits, body: creditsBody },
  privacy: { title: (menus) => menus.privacy, body: privacyBody },
};

export interface MenuActions {
  resumeRace(): void;
  returnToLobby(): void;
  startRace(): void;
  /** After a game: back to the choice of the next one, with the players and the score kept. */
  nextGame(): void;
  toggleGraphics(): void;
  cycleTouchMode(): void;
  cycleTouchLayout(): void;
}

/** The "Invite players" page; what it shows and does lives with the invitations, the menu only hosts it. */
interface InvitePage {
  open(): void;
  close(): void;
  renew(): void;
  switchCamera(): void;
  body(): TemplateResult;
  options(): readonly MenuOption[];
}

export interface MenuDependencies {
  readonly flow: GameFlow;
  readonly sound: SoundEngine;
  readonly audio: AudioConfig;
  readonly race: RaceConfig;
  readonly menuInput: MenuInput;
  readonly menuScroll: MenuScrollConfig;
  readonly graphicsQuality: () => GraphicsQuality;
  /** The on-screen control settings, or null while nobody plays with the on-screen controls. */
  readonly touchSettings: () => TouchSettings | null;
  readonly invite: InvitePage;
  /** "Invite players" in the settings: in the lobby, and in a paused race when a guest has dropped out. */
  readonly canInvite: () => boolean;
}

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

/** Pause, settings, controls, credits and results menus: what they show and what their options do. */
export class MenuController {
  private readonly overlay: MenuOverlay;
  private resultsIdleSeconds = 0;
  private pausedBy: string | undefined;
  private readonly optionActions: Readonly<Record<string, () => void>>;

  constructor(
    overlayRoot: HTMLElement,
    private readonly deps: MenuDependencies,
    private readonly actions: MenuActions,
  ) {
    this.overlay = new MenuOverlay(overlayRoot, (optionId) => this.select(optionId));
    this.optionActions = {
      settings: () => this.openSettings(),
      invite: () => this.openInvite(),
      inviteBack: () => this.closeInvite(),
      inviteRenew: () => deps.invite.renew(),
      inviteCamera: () => deps.invite.switchCamera(),
      audio: () => this.openAudioSettings(),
      audioBack: () => this.closeInfoPage(),
      graphics: () => this.toggleGraphics(),
      language: () => this.switchLanguage(),
      touchMode: () => this.cycleTouch(actions.cycleTouchMode, 'touchMode'),
      touchLayout: () => this.cycleTouch(actions.cycleTouchLayout, 'touchLayout'),
      settingsBack: () => this.closeSettings(),
      audioToggle: () => {
        this.toggleSound();
        this.refreshAudioSettings();
      },
      pauseSound: () => {
        this.toggleSound();
        this.showPauseMenu();
        this.overlay.selectOption('pauseSound');
      },
      musicDown: () => this.adjustMusicVolume(-VOLUME_STEP),
      musicUp: () => this.adjustMusicVolume(VOLUME_STEP),
      raceDown: () => this.adjustRaceVolume(-VOLUME_STEP),
      raceUp: () => this.adjustRaceVolume(VOLUME_STEP),
      lobby: () => actions.returnToLobby(),
      again: () => actions.startRace(),
      next: () => actions.nextGame(),
      resume: () => actions.resumeRace(),
      ...this.infoPageActions(),
    };
  }

  close(): void {
    this.overlay.close();
  }

  setAudioMuted(muted: boolean): void {
    this.deps.sound.setMuted(muted);
    saveAudioSettings(this.deps.audio);
  }

  /** Over the lobby a menu is opaque so the cards behind do not shine through its buttons; over a race it stays see-through. */
  private get menuTone(): ScreenTone {
    return this.deps.flow.phase === 'lobby' ? 'solid' : 'dim';
  }

  /** `by` names the player who paused; everyone sees who it was. */
  openPause(by?: string): void {
    this.pausedBy = by;
    this.deps.flow.pause();
    this.showPauseMenu();
    this.deps.menuInput.suppressUntilRelease();
  }

  private showPauseMenu(): void {
    const by = this.pausedBy;
    const { menus } = t();
    this.overlay.open(menus.paused, by ? html`<c-text tone="soft">${menus.pausedBy(by)}</c-text>` : nothing, pauseOptions(this.deps.audio));
  }

  /** Switching the sound on answers with the confirm sound, so the player hears at once that it worked. */
  private toggleSound(): void {
    this.setAudioMuted(!this.deps.audio.muted);
    if (!this.deps.audio.muted) this.deps.sound.playMenuConfirm();
  }

  openResults(title: string, table: TemplateResult): void {
    this.deps.flow.showResults();
    this.resultsIdleSeconds = 0;
    this.overlay.open(title, table, resultOptions(), 'dim', html`${t().menus.scoreLegend}`);
    this.deps.menuInput.suppressUntilRelease();
  }

  /** The result page, chosen from elsewhere (a guest phone that stands in for a host without a player). */
  chooseResult(optionId: 'again' | 'next' | 'lobby'): void {
    if (this.deps.flow.phase === 'results') this.select(optionId);
  }

  openSettings(): void {
    if (!this.deps.flow.openSettings()) return;
    this.overlay.open(t().menus.settings, nothing, this.settingsOptions(), this.menuTone);
    this.deps.menuInput.suppressUntilRelease();
  }

  update(frames: readonly InputFrame[], stepSeconds: number, canResume: boolean): void {
    const command = this.deps.menuInput.read(frames, this.deps.flow.scrollPageOpen);
    if (command.toggle && canResume) {
      this.actions.resumeRace();
      return;
    }
    if (command.move !== 0) this.deps.sound.playMenuNavigate();
    this.overlay.moveSelection(command.move);
    this.overlay.scrollContent(command.scroll * this.deps.menuScroll.pixelsPerSecond * stepSeconds);
    if (this.deps.flow.phase === 'results' && this.autoReturnDue(command.move !== 0 || command.confirm, stepSeconds)) {
      this.actions.returnToLobby();
      return;
    }
    const selected = this.overlay.selectedOptionId;
    if (command.confirm && selected) this.select(selected);
  }

  private autoReturnDue(userActive: boolean, stepSeconds: number): boolean {
    this.resultsIdleSeconds = userActive ? 0 : this.resultsIdleSeconds + stepSeconds;
    return this.resultsIdleSeconds >= this.deps.race.resultsAutoReturnSeconds;
  }

  private select(optionId: string): void {
    if (optionId !== 'audioToggle' && optionId !== 'pauseSound') this.deps.sound.playMenuConfirm();
    this.optionActions[optionId]?.();
  }

  private openInvite(): void {
    this.deps.flow.setSettingsSection('invite');
    this.deps.invite.open();
    this.overlay.open(t().menus.invite, this.deps.invite.body(), this.deps.invite.options(), 'solid', inviteHint());
    this.deps.menuInput.suppressUntilRelease();
  }

  /** The invitation changed (a new code, a guest joined, a problem): the open page shows it. */
  refreshInvite(): void {
    if (this.deps.flow.settingsSection !== 'invite') return;
    this.overlay.refresh(this.deps.invite.body(), this.deps.invite.options());
  }

  private closeInvite(): void {
    this.deps.invite.close();
    this.closeInfoPage();
  }

  private openAudioSettings(): void {
    this.deps.flow.setSettingsSection('audio');
    this.overlay.open(t().menus.sound, nothing, audioMenuOptions(this.deps.audio), this.menuTone);
  }

  private closeSettings(): void {
    this.overlay.close();
    const fromLobby = this.deps.flow.phase === 'lobby';
    this.deps.flow.closeSettings();
    if (!fromLobby) this.openPause();
  }

  /** "Controls" and "About Blacky" have buttons of their own in the lobby: the page opens as a section of the settings. */
  openInfoPageFromLobby(kind: InfoPageKind): void {
    if (!this.deps.flow.openSettings()) return;
    this.openInfoPage(kind);
  }

  private infoPageActions(): Record<string, () => void> {
    return Object.fromEntries(
      (Object.keys(INFO_PAGES) as InfoPageKind[]).flatMap((kind) => [
        [kind, () => this.openInfoPage(kind)],
        [`${kind}Back`, () => this.closeInfoPage()],
      ]),
    );
  }

  /** Opened from the settings it is one of their sections; opened from the pause menu it is a page of its own that leads back there.
   *  A long page scrolls and its hint says how; a page that fits on one screen keeps the tone of the menu it was opened from. */
  private openInfoPage(kind: InfoPageKind): void {
    const page = INFO_PAGES[kind];
    if (this.deps.flow.settingsOpen) this.deps.flow.setSettingsSection(kind);
    else this.deps.flow.showPausePage(kind);
    const scrolls = this.deps.flow.scrollPageOpen;
    this.overlay.open(page.title(t().menus), page.body(), backOption(`${kind}Back`), scrolls ? 'solid' : this.menuTone, scrolls ? scrollPageHint() : undefined);
    this.deps.menuInput.suppressUntilRelease();
  }

  private closeInfoPage(): void {
    if (!this.deps.flow.settingsOpen) {
      this.openPause();
      return;
    }
    const cameFrom = this.deps.flow.settingsSection;
    this.deps.flow.setSettingsSection('overview');
    this.overlay.open(t().menus.settings, nothing, this.settingsOptions(), this.menuTone);
    if (cameFrom) this.overlay.selectOption(cameFrom);
    this.deps.menuInput.suppressUntilRelease();
  }

  openInviteFromLobby(): void {
    if (!this.deps.flow.openSettings()) return;
    this.openInvite();
  }

  private settingsOptions(): readonly MenuOption[] {
    return settingsMenuOptions(this.deps.graphicsQuality(), this.deps.touchSettings(), this.deps.canInvite());
  }

  /** Every text of the settings changes with the language, so the overview is rebuilt; the selection stays on the language entry. */
  private switchLanguage(): void {
    setLanguage(nextLanguage());
    this.reopenSettingsOn('language');
  }

  /** The label shows the level, so the overview is rebuilt; the selection stays on the graphics entry. */
  private toggleGraphics(): void {
    this.actions.toggleGraphics();
    this.reopenSettingsOn('graphics');
  }

  private cycleTouch(change: () => void, optionId: string): void {
    change();
    this.reopenSettingsOn(optionId);
  }

  private reopenSettingsOn(optionId: string): void {
    this.overlay.open(t().menus.settings, nothing, this.settingsOptions(), this.menuTone);
    this.overlay.selectOption(optionId);
  }

  private adjustMusicVolume(delta: number): void {
    this.deps.audio.musicVolume = clamp01(this.deps.audio.musicVolume + delta);
    this.saveAndRefreshAudio();
  }

  private adjustRaceVolume(delta: number): void {
    this.deps.audio.sfxVolume = clamp01(this.deps.audio.sfxVolume + delta);
    this.deps.audio.engineVolume = clamp01(this.deps.audio.engineVolume + delta);
    this.saveAndRefreshAudio();
  }

  private saveAndRefreshAudio(): void {
    saveAudioSettings(this.deps.audio);
    this.refreshAudioSettings();
  }

  /** The labels show the volumes, so the page is rebuilt; the selection stays where the player was adjusting. */
  private refreshAudioSettings(): void {
    const selected = this.overlay.selectedOptionId;
    this.openAudioSettings();
    if (selected) this.overlay.selectOption(selected);
  }
}
