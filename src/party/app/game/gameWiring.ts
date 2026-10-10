import type { RemoteConfig } from '../../../shared/config/remote';
import { nextTouchControlMode, nextTouchLayout } from '../../../shared/config/touch';
import { GAMES } from '../../games';
import { LobbyController } from '../lobbyController';
import { MenuController } from '../menuController';
import { PlayerRoster } from '../playerRoster';
import { RemoteSide } from '../remoteSide';
import { thisScreenCanSplit } from '../viewerLayout';
import { EngineCoordinator } from './engineCoordinator';
import { GameOverlays } from './gameOverlays';
import type { GameParts } from './gameParts';
import { lobbyClicks } from './lobbyClicks';
import { RaceLifecycle } from './raceLifecycle';
import { RaceSession } from './raceSession';

// How each part of the game is connected to the others. Most parts need parts that are built after them (see the order in `GameParts`),
// so they get small functions (`() => parts.lifecycle`) instead of the parts themselves.

export function rosterFor(parts: GameParts): PlayerRoster {
  const { input, customization, aiWizard, presentation } = parts;
  return new PlayerRoster({ input, customization, aiWizard, presentation, rng: parts.lobbyRng, currentMap: () => parts.lifecycle.map });
}

export function enginesFor(parts: GameParts, overlay: HTMLElement): EngineCoordinator {
  const engineRoot = document.createElement('div');
  overlay.appendChild(engineRoot);
  const { sessionSeed, players, presentation } = parts;
  return new EngineCoordinator({
    sessionSeed,
    players,
    presentation,
    planeOf: (slot) => parts.customization.planeOf(parts.input.players[slot], slot),
    startCountdownSeconds: () => parts.configs.race.startCountdownSeconds,
    tuning: parts.configs.modes,
    root: engineRoot,
  });
}

export function overlaysFor(parts: GameParts, overlay: HTMLElement, touchRoot: HTMLElement): GameOverlays {
  const { configs, flow, input, players, world, presentation, customization, aiWizard, gameVoteStage, mapVoteStage, sound } = parts;
  const clicks = lobbyClicks({
    input,
    customization,
    aiWizard,
    sound,
    lobby: () => parts.lobby,
    menus: () => parts.menus,
    toggleGraphicsQuality: () => parts.toggleGraphicsQuality(),
  });
  return new GameOverlays(overlay, touchRoot, clicks, {
    flow,
    input,
    players,
    world,
    presentation,
    customization,
    aiWizard,
    gameVoteStage,
    mapVoteStage,
    audio: configs.audio,
    graphics: configs.graphics,
    kartStats: configs.kartStats,
    touchSettings: configs.touchSettings,
    lapCount: () => configs.race.lapCount,
    currentMap: () => parts.lifecycle.map,
    rules: () => parts.lifecycle.info(),
    countdownLabel: () => parts.countdownLabel(),
    remainingFinishSeconds: () => parts.session.remainingFinishSeconds(),
    waitingForGuests: () => parts.remote.race.waitingForGuests,
    currentGame: () => GAMES[parts.lifecycle.gameIndex]!,
    engineGameCard: () => parts.engineGameCard(),
    lobby: () => parts.lobby,
    chosenNameOf: (slot) => parts.chosenNameOf(slot),
    labelOfSlot: (slot) => parts.labelOfSlot(slot),
  });
}

export function remoteFor(parts: GameParts, remoteConfig: RemoteConfig): RemoteSide {
  const { flow, input, customization, gameVoteStage, mapVoteStage } = parts;
  return new RemoteSide({
    flow,
    input,
    customization,
    gameVoteStage,
    mapVoteStage,
    config: remoteConfig,
    players: () => parts.players,
    world: () => parts.world,
    map: () => parts.lifecycle.map,
    lapCount: () => parts.configs.race.lapCount,
    gameStatusOf: (slot) => parts.lifecycle.info()?.cardText(slot) ?? null,
    appearanceOf: (player) => parts.presentation.appearanceFor(player),
    countdown: () => ({ secondsLeft: parts.session.startCountdown.secondsRemaining, goDisplayActive: parts.session.startCountdown.showingGo }),
    finishCountdownSeconds: () => parts.session.remainingFinishSeconds(),
    extras: () => parts.session.rules?.toExtras() ?? [],
    engine: () => parts.engines.round,
    nameOfSlot: (slot) => parts.labelOfSlot(slot),
    chosenNameOf: (slot) => parts.chosenNameOf(slot),
    pausedBy: () => (parts.flow.phase === 'paused' && parts.lifecycle.pausedBy >= 0 ? parts.labelOfSlot(parts.lifecycle.pausedBy) : null),
    lobby: () => parts.lobby,
    menus: () => parts.menus,
    modeId: () => parts.lifecycle.gameId,
    gameIndex: () => parts.lifecycle.gameIndex,
    showsSharedPicture: thisScreenCanSplit,
  });
}

export function sessionFor(parts: GameParts): RaceSession {
  const { configs, sessionSeed, players, world, sound, presentation } = parts;
  const { driving, ai, aiDifficulty, kartStats, items, race } = configs;
  return new RaceSession({
    sessionSeed,
    players,
    world,
    sound,
    presentation,
    driving,
    ai,
    aiDifficulty,
    kartStats,
    items,
    race,
    tuning: configs.modes,
    broadcaster: parts.remote.race,
    currentMap: () => parts.lifecycle.map,
    currentMode: () => parts.lifecycle.mode,
  });
}

export function lifecycleFor(parts: GameParts): RaceLifecycle {
  const { configs, flow, session, roster, aiWizard, input, menuInput, customization } = parts;
  const { sound, presentation, governor, debugPanel, world, players, scoreboard, engines } = parts;
  return new RaceLifecycle({
    flow,
    session,
    roster,
    aiWizard,
    input,
    menuInput,
    customization,
    sound,
    presentation,
    governor,
    debugPanel,
    world,
    players,
    scoreboard,
    engines,
    race: configs.race,
    items: configs.items,
    tuning: configs.modes,
    broadcaster: parts.remote.race,
    labelOfSlot: (slot) => parts.labelOfSlot(slot),
    joinTouchPlayerOnPhone: () => parts.joinTouchPlayerOnPhone(),
    lobby: () => parts.lobby,
    menus: () => parts.menus,
  });
}

export function menusFor(parts: GameParts, overlay: HTMLElement): MenuController {
  const { configs, flow, sound, menuInput } = parts;
  return new MenuController(
    overlay,
    {
      flow,
      sound,
      menuInput,
      audio: configs.audio,
      race: configs.race,
      menuScroll: configs.menuScroll,
      graphicsQuality: () => configs.graphics.quality,
      touchSettings: () => (parts.input.hasTouchPlayer() ? configs.touchSettings : null),
      canInvite: () => parts.remote.canInvite(),
      invite: parts.remote.invitePage,
    },
    {
      resumeRace: () => parts.lifecycle.resumeRace(),
      returnToLobby: () => parts.lifecycle.returnToLobby(),
      startRace: () => parts.lifecycle.startRace(),
      nextGame: () => parts.lifecycle.nextGame(),
      toggleGraphics: () => parts.toggleGraphicsQuality(),
      cycleTouchMode: () => parts.changeTouchSettings({ mode: nextTouchControlMode(configs.touchSettings.mode) }),
      cycleTouchLayout: () => parts.changeTouchSettings({ layout: nextTouchLayout(configs.touchSettings.layout) }),
    },
  );
}

export function lobbyFor(parts: GameParts, remoteConfig: RemoteConfig): LobbyController {
  const { flow, input, customization, aiWizard, gameVoteStage, mapVoteStage, roster, menuInput, menus, sound } = parts;
  return new LobbyController(
    {
      flow,
      input,
      customization,
      aiWizard,
      gameVoteStage,
      mapVoteStage,
      roster,
      menuInput,
      menus,
      sound,
      rng: parts.lobbyRng,
      remote: remoteConfig,
    },
    {
      chooseGame: (gameIndex) => parts.lifecycle.chooseGame(gameIndex),
      startRaceOnMap: (mapIndex) => parts.lifecycle.startRaceOnMap(mapIndex),
    },
  );
}
