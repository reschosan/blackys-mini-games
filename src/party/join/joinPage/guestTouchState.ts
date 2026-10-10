import type { TouchControlMode, TouchLayout } from '../../../shared/config/touch';
import type { TouchGame } from '../../../shared/game/gameCard';
import type { RemotePhase, StatusMessage } from '../../../shared/net/messages';
import type { TouchControlsState } from '../../../shared/touch/touchControls';

/** In the pause and on the result page the guest taps the options of the panel; the cross would only lie over them. */
function showsMenuPhase(phase: RemotePhase | undefined): boolean {
  return phase === 'paused' || phase === 'results';
}

/** Drawn on the phone, the race takes the layout the player chose; as a plain controller the keys sit beside each other. */
function raceDock(drawingRace: boolean, layout: TouchLayout): TouchLayout | 'split' {
  return drawingRace ? layout : 'split';
}

interface GuestTouchInput {
  readonly status: StatusMessage | null;
  readonly drawingRace: boolean;
  readonly connected: boolean;
  readonly settings: { readonly mode: TouchControlMode; readonly layout: TouchLayout };
  readonly touchGame: TouchGame | undefined;
  readonly itemLabel?: string | undefined;
}

/** What the on-screen controls of a guest phone show: the cross in the lobby, stick and keys in the race, nothing over a menu. */
export function guestTouchState({ status, drawingRace, connected, settings, touchGame, itemLabel }: GuestTouchInput): TouchControlsState {
  const menuShown = drawingRace && showsMenuPhase(status?.phase);
  return {
    active: connected,
    racing: status?.phase === 'racing',
    mode: settings.mode,
    layout: settings.layout,
    playerColor: status?.color ?? '#ffffff',
    crossHidden: menuShown,
    ...(touchGame ? { touchGame } : {}),
    ...(itemLabel ? { itemLabel } : {}),
    dock: menuShown ? 'overlay' : raceDock(drawingRace, settings.layout),
  };
}
