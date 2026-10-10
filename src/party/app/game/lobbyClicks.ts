import type { SoundEngine } from '../../../shared/audio/soundEngine';
import type { InputManager } from '../../../shared/input/inputManager';
import type { AiWizard } from '../../lobby/aiWizard';
import type { LobbyCustomization } from '../../lobby/catCustomization';
import type { LobbyPresentation } from '../../lobby/lobbyPresentation';
import type { LobbyController } from '../lobbyController';
import type { MenuController } from '../menuController';

interface LobbyClickTargets {
  readonly input: InputManager;
  readonly customization: LobbyCustomization;
  readonly aiWizard: AiWizard;
  readonly sound: SoundEngine;
  readonly lobby: () => LobbyController;
  readonly menus: () => MenuController;
  readonly toggleGraphicsQuality: () => void;
}

type LobbyClicks = ConstructorParameters<typeof LobbyPresentation>[1];

/** What a mouse click or tap on the lobby does; every button is a shortcut for something the gamepad reaches too. */
export function lobbyClicks({ input, customization, aiWizard, sound, lobby, menus, toggleGraphicsQuality }: LobbyClickTargets): LobbyClicks {
  return {
    onPlayerRowClick: (playerIndex, rowIndex) => {
      const player = input.players[playerIndex];
      if (!player) return;
      customization.selectRow(player, rowIndex);
      sound.playMenuNavigate();
    },
    onPlayerArrowClick: (playerIndex, delta) => {
      const player = input.players[playerIndex];
      if (!player) return;
      customization.changeValue(player, delta);
      sound.playMenuNavigate();
    },
    onAiRowClick: (rowIndex) => lobby().clickAiRow(rowIndex),
    onAiArrowClick: (delta) => {
      aiWizard.changeValue(delta);
      sound.playMenuNavigate();
    },
    onAudioMutedChange: (muted) => menus().setAudioMuted(muted),
    onGraphicsClick: toggleGraphicsQuality,
    onControlsClick: () => menus().openInfoPageFromLobby('controls'),
    onAboutClick: () => menus().openInfoPageFromLobby('about'),
    onSettingsClick: () => menus().openSettings(),
    onInviteClick: () => menus().openInviteFromLobby(),
    onJoinClick: () => lobby().joinTouchPlayer(),
    onAiFillClick: () => lobby().cycleAiFillByClick(),
    onGameClick: (gameIndex) => lobby().clickGame(gameIndex),
    onMapClick: (mapIndex) => lobby().clickMap(mapIndex),
    onLeaveClick: (playerIndex) => lobby().leavePlayer(playerIndex),
    onBackClick: () => lobby().stepBack(),
  };
}
