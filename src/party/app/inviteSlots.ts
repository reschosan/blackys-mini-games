import { hexColor } from '../../shared/core/color';
import { PLAYER_APPEARANCES } from '../../shared/config/players';
import type { InputManager } from '../../shared/input/inputManager';
import { isInvitationClosed, type InviteSlot, type InviteSlotState } from '../../shared/ui/invite/inviteView';
import type { InviteState } from './remoteHost';

function stateOfSlot(input: InputManager, invite: InviteState, slot: number): InviteSlotState {
  const player = input.players[slot];
  if (!player) return slot === input.players.length && !isInvitationClosed(invite.status) ? 'next' : 'free';
  if (player.source.kind !== 'remote') return 'you';
  return input.remoteById(player.source.remoteId)?.connected ? 'connected' : 'lost';
}

/** The four seats as the invitation page shows them: who is in, who is next, who dropped out. */
export function inviteSlotsFor(input: InputManager, invite: InviteState): readonly InviteSlot[] {
  return PLAYER_APPEARANCES.map((appearance, slot) => ({
    symbol: appearance.symbol,
    color: hexColor(appearance.bodyColor),
    state: stateOfSlot(input, invite, slot),
  }));
}
