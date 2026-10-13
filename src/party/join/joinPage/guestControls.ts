import { touchControlModeLabel, touchLayoutLabel } from '../../../shared/i18n/labels';
import { html, nothing, type TemplateResult } from 'lit';
import { SoundEngine, unlockOnGestures } from '../../../shared/audio/soundEngine';
import { createRuntimeAudio } from '../../../shared/config/audio';
import { createRuntimeTouchSettings, nextTouchControlMode, nextTouchLayout, type TouchSettings } from '../../../shared/config/touch';
import { loadAudioSettings, saveAudioSettings } from '../../../shared/ui/menus/audioPersistence';
import { loadTouchSettings, saveTouchSettings } from '../../../shared/ui/menus/touchPersistence';
import { loadViewMode, saveViewMode, type ViewMode } from './guestViewMode';
import { t } from '../../../shared/i18n';
import type { RemotePhase } from '../../../shared/net/messages';
import { currentLanguage, LANGUAGE_NAMES, nextLanguage, setLanguage, type Language } from '../../../shared/i18n/language';

/** The settings of a guest phone that it keeps for itself: how it steers, where the keys sit, sound, and whether it draws its own screen. */
export class GuestControls {
  readonly touchSettings: TouchSettings = loadTouchSettings(createRuntimeTouchSettings());
  viewMode: ViewMode = loadViewMode();
  private readonly audio = loadAudioSettings(createRuntimeAudio());
  /** One sound for the whole visit with this phone's own setting: the lobby music and the sound of every game drawn here. */
  readonly sound = new SoundEngine(this.audio);
  /** Set when the phone cannot play sound at all; it shows beside the sound button. */
  private soundProblem: string | null = null;

  constructor() {
    unlockOnGestures(this.sound, () => {
      this.soundProblem = t().problems.audioUnavailable;
    });
  }

  nextSteeringMode(): void {
    this.touchSettings.mode = nextTouchControlMode(this.touchSettings.mode);
    saveTouchSettings(this.touchSettings);
  }

  nextLayout(): void {
    this.touchSettings.layout = nextTouchLayout(this.touchSettings.layout);
    saveTouchSettings(this.touchSettings);
  }

  toggleSound(): void {
    this.audio.muted = !this.audio.muted;
    saveAudioSettings(this.audio);
    this.sound.setMuted(this.audio.muted);
  }

  /** The lobby music in the lobby; while the phone draws a game, that game has started its own; otherwise (controller only, gone) quiet. */
  followMusic(phase: RemotePhase | undefined, drawingGame: boolean): void {
    if (phase === 'lobby') this.sound.playMusic('lobby');
    else if (!drawingGame) this.sound.stopMusic();
  }

  /** The phone's own texts change at once; the caller tells the host, which makes what it sends in the new language too. */
  switchLanguage(): Language {
    setLanguage(nextLanguage());
    return currentLanguage();
  }

  toggleViewMode(): ViewMode {
    this.viewMode = this.viewMode === 'own' ? 'controller' : 'own';
    saveViewMode(this.viewMode);
    return this.viewMode;
  }

  /** The choices of this phone: steering mode, own screen or controller only (only when the host can show a shared picture), sound, layout of the keys in a race. */
  buttons(shownMode: ViewMode, controllerOnlyAllowed: boolean): TemplateResult {
    const { join } = t();
    return html`<c-stack direction="row" gap="s" justify="center" wrap>
      <c-button size="s" data-guest-mode label=${join.steering(touchControlModeLabel(this.touchSettings.mode))}></c-button>
      ${controllerOnlyAllowed ? html`<c-button size="s" data-guest-view label=${join.view(join.viewModes[this.viewMode])}></c-button>` : nothing}
      <c-button size="s" data-guest-sound label=${join.sound(!this.audio.muted)}></c-button>
      ${shownMode === 'own' ? html`<c-button size="s" data-guest-layout label=${join.layout(touchLayoutLabel(this.touchSettings.layout))}></c-button>` : nothing}
      <c-button size="s" data-guest-language label=${t().menus.language(LANGUAGE_NAMES[currentLanguage()])}></c-button>
    </c-stack>
    ${this.soundProblem ? html`<c-text tone="warn" size="s" role="alert">${this.soundProblem}</c-text>` : nothing}`;
  }
}
