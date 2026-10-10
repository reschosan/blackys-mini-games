import { describe, expect, it } from 'vitest';
import { GameFlow } from '../../src/shared/core/gameFlow';

describe('authoritative game flow', () => {
  it('starts in customization with no menu open', () => {
    const flow = new GameFlow();
    expect(flow.state).toEqual({ phase: 'lobby', stage: 'customizing', menu: null });
    expect(flow.lobbyStage).toBe('customizing');
  });

  it.each(['overview', 'audio'] as const)('opens settings in the %s section inside the lobby', (section) => {
    const flow = new GameFlow();
    flow.openSettings();
    flow.setSettingsSection(section);
    expect(flow.state).toEqual({ phase: 'lobby', stage: 'customizing', menu: { kind: 'settings', section } });
    expect(flow.settingsOpen).toBe(true);
  });

  it('closes all settings back to the unchanged lobby stage', () => {
    const flow = new GameFlow();
    flow.setLobbyStage('trackVote');
    flow.openSettings();
    flow.setSettingsSection('audio');
    flow.closeSettings();
    expect(flow.settingsOpen).toBe(false);
    expect(flow.lobbyStage).toBe('trackVote');
  });

  it('returns pause settings to pause, not to the lobby or the race', () => {
    const flow = new GameFlow();
    flow.startRace();
    flow.pause();
    flow.openSettings();
    flow.setSettingsSection('audio');
    flow.closeSettings();
    expect(flow.state).toEqual({ phase: 'paused', menu: { kind: 'pause' } });
  });

  it.each(['controls', 'credits', 'privacy'] as const)('shows the %s page in the pause menu and clears it on resume', (page) => {
    const flow = new GameFlow();
    flow.startRace();
    flow.pause();
    flow.showPausePage(page);
    expect(flow.state).toEqual({ phase: 'paused', menu: { kind: page } });
    flow.startRace();
    expect(flow.state).toEqual({ phase: 'racing' });
  });

  it.each(['racing', 'results'] as const)('cannot open settings in %s', (phase) => {
    const flow = new GameFlow();
    flow.startRace();
    if (phase === 'results') flow.showResults();
    expect(flow.openSettings()).toBe(false);
    flow.setSettingsSection('audio');
    flow.setLobbyStage('trackVote');
    expect(flow.state).toEqual({ phase });
  });

  it('drops settings and map-vote state when returning to the lobby', () => {
    const flow = new GameFlow();
    flow.setLobbyStage('trackVote');
    flow.openSettings();
    flow.startRace();
    flow.showResults();
    flow.enterLobby();
    expect(flow.state).toEqual({ phase: 'lobby', stage: 'customizing', menu: null });
  });

  it('marks the about page as a scrollable page for pause and lobby settings', () => {
    const pause = new GameFlow();
    pause.startRace();
    pause.pause();
    expect(pause.scrollPageOpen).toBe(false);
    pause.showPausePage('about');
    expect(pause.scrollPageOpen).toBe(true);

    const lobby = new GameFlow();
    lobby.openSettings();
    expect(lobby.scrollPageOpen).toBe(false);
    lobby.setSettingsSection('about');
    expect(lobby.scrollPageOpen).toBe(true);
    lobby.setSettingsSection('overview');
    expect(lobby.scrollPageOpen).toBe(false);
  });

  it('marks the controls and privacy pages as scrollable and the credits page not', () => {
    const flow = new GameFlow();
    flow.startRace();
    flow.pause();
    flow.showPausePage('controls');
    expect(flow.scrollPageOpen).toBe(true);
    flow.showPausePage('privacy');
    expect(flow.scrollPageOpen).toBe(true);
    flow.showPausePage('credits');
    expect(flow.scrollPageOpen).toBe(false);
  });

  it('opens the credits page inside the settings, for pause and lobby, as a normal settings screen', () => {
    const lobby = new GameFlow();
    lobby.openSettings();
    lobby.setSettingsSection('credits');
    expect(lobby.state).toEqual({ phase: 'lobby', stage: 'customizing', menu: { kind: 'settings', section: 'credits' } });
    expect(lobby.scrollPageOpen).toBe(false);

    const pause = new GameFlow();
    pause.startRace();
    pause.pause();
    pause.openSettings();
    pause.setSettingsSection('credits');
    expect(pause.settingsOpen).toBe(true);
  });

  it('tells which settings page is open and nothing outside the settings', () => {
    const flow = new GameFlow();
    expect(flow.settingsSection).toBeNull();
    flow.openSettings();
    expect(flow.settingsSection).toBe('overview');
    flow.setSettingsSection('about');
    expect(flow.settingsSection).toBe('about');
    flow.closeSettings();
    expect(flow.settingsSection).toBeNull();
  });
});
