export type GamePhase = 'lobby' | 'racing' | 'paused' | 'results';
export type LobbyStage = 'customizing' | 'gameVote' | 'trackVote';
/** The pages that only show something and lead back; they open from the settings and from the pause menu. */
export type InfoPageKind = 'controls' | 'about' | 'credits' | 'privacy';
type SettingsSection = 'overview' | 'audio' | 'invite' | InfoPageKind;
type SettingsMenu = { readonly kind: 'settings'; readonly section: SettingsSection };
type PauseMenu = { readonly kind: 'pause' | InfoPageKind } | SettingsMenu;
/** Pages whose body scrolls; up/down then scroll instead of moving the selection. */
const SCROLLABLE_PAGES: readonly string[] = ['about', 'controls', 'privacy'];

export type GameFlowState =
  | { readonly phase: 'lobby'; readonly stage: LobbyStage; readonly menu: SettingsMenu | null }
  | { readonly phase: 'racing' }
  | { readonly phase: 'paused'; readonly menu: PauseMenu }
  | { readonly phase: 'results' };

export class GameFlow {
  private current: GameFlowState = { phase: 'lobby', stage: 'customizing', menu: null };

  get state(): GameFlowState {
    return this.current;
  }
  get phase(): GamePhase {
    return this.current.phase;
  }
  get lobbyStage(): LobbyStage {
    return this.current.phase === 'lobby' ? this.current.stage : 'customizing';
  }
  get settingsOpen(): boolean {
    return (this.current.phase === 'lobby' || this.current.phase === 'paused') && this.current.menu?.kind === 'settings';
  }

  get settingsSection(): SettingsSection | null {
    if (this.current.phase !== 'lobby' && this.current.phase !== 'paused') return null;
    return this.current.menu?.kind === 'settings' ? this.current.menu.section : null;
  }

  get scrollPageOpen(): boolean {
    if (this.current.phase !== 'lobby' && this.current.phase !== 'paused') return false;
    const menu = this.current.menu;
    if (!menu) return false;
    return SCROLLABLE_PAGES.includes(menu.kind === 'settings' ? menu.section : menu.kind);
  }

  enterLobby(): void {
    this.current = { phase: 'lobby', stage: 'customizing', menu: null };
  }
  startRace(): void {
    this.current = { phase: 'racing' };
  }
  pause(): void {
    this.current = { phase: 'paused', menu: { kind: 'pause' } };
  }
  showResults(): void {
    this.current = { phase: 'results' };
  }

  setLobbyStage(stage: LobbyStage): void {
    if (this.current.phase === 'lobby') this.current = { ...this.current, stage };
  }

  openSettings(): boolean {
    if (this.current.phase !== 'lobby' && this.current.phase !== 'paused') return false;
    this.current = { ...this.current, menu: { kind: 'settings', section: 'overview' } };
    return true;
  }

  setSettingsSection(section: SettingsSection): void {
    if (!this.settingsOpen) return;
    if (this.current.phase === 'lobby' || this.current.phase === 'paused') {
      this.current = { ...this.current, menu: { kind: 'settings', section } };
    }
  }

  closeSettings(): void {
    if (!this.settingsOpen) return;
    if (this.current.phase === 'lobby') this.current = { ...this.current, menu: null };
    else this.pause();
  }

  showPausePage(kind: InfoPageKind): void {
    if (this.current.phase === 'paused') this.current = { phase: 'paused', menu: { kind } };
  }
}
