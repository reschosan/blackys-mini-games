import { beforeEach, describe, expect, it, vi } from 'vitest';
import { inviteSlotsFor } from '../../src/party/app/inviteSlots';
import type { InviteState } from '../../src/party/app/remoteHost';
import { createRuntimeRemote } from '../../src/shared/config/remote';
import { createRuntimeTouchSteering } from '../../src/shared/config/touch';
import { InputManager } from '../../src/shared/input/inputManager';
import { RemoteInput } from '../../src/shared/input/remote/remoteInput';

const WAITING: InviteState = { status: 'waiting', qrText: 'x', secondsLeft: 60, problem: null, reclaiming: false, guestCount: 0 };

beforeEach(() => {
  (globalThis as unknown as { document: { hasFocus(): boolean } }).document = { hasFocus: () => true };
  Object.defineProperty(globalThis.navigator, 'getGamepads', { value: () => [], configurable: true });
});

function managerWith(...kinds: ('touch' | 'remote' | 'lostRemote')[]): InputManager {
  const input = new InputManager(createRuntimeTouchSteering());
  for (const kind of kinds) {
    if (kind === 'touch') {
      input.joinTouch();
      continue;
    }
    const remote = new RemoteInput(input.nextRemoteId(), { send: vi.fn(), sendState: vi.fn(), close: vi.fn() }, createRuntimeRemote());
    input.addRemote(remote);
    if (kind === 'lostRemote') remote.markLost();
  }
  return input;
}

describe('invitation seats', () => {
  it('shows the host, a connected phone, the next seat and a free one', () => {
    const slots = inviteSlotsFor(managerWith('touch', 'remote'), WAITING);
    expect(slots.map((slot) => slot.state)).toEqual(['you', 'connected', 'next', 'free']);
  });

  it('marks a phone that dropped out', () => {
    expect(inviteSlotsFor(managerWith('touch', 'lostRemote'), WAITING)[1]?.state).toBe('lost');
  });

  it('has no next seat when all four are taken', () => {
    const slots = inviteSlotsFor(managerWith('touch', 'remote', 'remote', 'remote'), { ...WAITING, status: 'full' });
    expect(slots.some((slot) => slot.state === 'next' || slot.state === 'free')).toBe(false);
  });

  it('tells the seats apart by a symbol as well as by colour', () => {
    const slots = inviteSlotsFor(managerWith(), WAITING);
    expect(new Set(slots.map((slot) => slot.symbol)).size).toBe(slots.length);
    expect(new Set(slots.map((slot) => slot.color)).size).toBe(slots.length);
  });
});
