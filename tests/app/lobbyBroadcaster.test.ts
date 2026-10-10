import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LobbyBroadcaster, type LobbyBroadcastSource } from '../../src/party/app/lobbyBroadcaster';
import { createRuntimeRemote } from '../../src/shared/config/remote';
import { createRuntimeTouchSteering } from '../../src/shared/config/touch';
import type { LobbyStage } from '../../src/shared/core/gameFlow';
import { InputManager } from '../../src/shared/input/inputManager';
import { RemoteInput, type RemoteLink } from '../../src/shared/input/remote/remoteInput';

beforeEach(() => {
  (globalThis as unknown as { document: { hasFocus(): boolean } }).document = { hasFocus: () => true };
  Object.defineProperty(globalThis.navigator, 'getGamepads', { value: () => [], configurable: true });
});

function fixture() {
  const input = new InputManager(createRuntimeTouchSteering());
  const link: RemoteLink = { send: vi.fn(), sendState: vi.fn(), close: vi.fn() };
  const guest = new RemoteInput(input.nextRemoteId(), link, createRuntimeRemote());
  input.joinTouch();
  input.addRemote(guest);
  const state = { stage: 'customizing' as LobbyStage, inviting: false };
  const source: LobbyBroadcastSource = {
    input,
    stage: () => state.stage,
    gameIndex: () => 1,
    entryOf: () => undefined,
    pickOf: () => ({ mapIndex: 1, confirmed: true }),
    nameOfSlot: (slot) => `Katze ${slot + 1}`,
    inviting: () => state.inviting,
  };
  return { broadcaster: new LobbyBroadcaster(source), guest, link, state };
}

const lobbyMessages = (link: RemoteLink) => vi.mocked(link.send).mock.calls.filter(([message]) => message.kind === 'lobby');

describe('LobbyBroadcaster', () => {
  it('shows a guest nothing of the lobby while the host still has the invitation page open, and everything once it is closed', () => {
    const { broadcaster, link, state } = fixture();
    state.inviting = true;
    for (let step = 0; step < 10; step += 1) broadcaster.update(0.1);
    expect(lobbyMessages(link)).toHaveLength(0);
    state.inviting = false;
    broadcaster.update(0.1);
    expect(lobbyMessages(link)).toHaveLength(1);
  });

  it('sends a guest the lobby of its own seat as soon as the first check is due', () => {
    const { broadcaster, link } = fixture();
    broadcaster.update(0.05);
    expect(lobbyMessages(link)).toHaveLength(0);
    broadcaster.update(0.05);
    const [message] = lobbyMessages(link)[0]!;
    expect(message.kind === 'lobby' && message.lobby).toMatchObject({ stage: 'customizing', seat: 1, game: 1, entry: null, picks: [] });
  });

  it('sends nothing new while the state stays the same, only a repeat once a second', () => {
    const { broadcaster, link } = fixture();
    for (let step = 0; step < 10; step += 1) broadcaster.update(0.1);
    expect(lobbyMessages(link)).toHaveLength(1);
    for (let step = 0; step < 10; step += 1) broadcaster.update(0.1);
    expect(lobbyMessages(link).length).toBeGreaterThanOrEqual(2);
    expect(lobbyMessages(link).length).toBeLessThanOrEqual(3);
  });

  it('sends at once when the stage changes, and includes the votes of all players in the vote', () => {
    const { broadcaster, link, state } = fixture();
    broadcaster.update(0.1);
    state.stage = 'trackVote';
    broadcaster.update(0.1);
    const [message] = lobbyMessages(link)[1]!;
    expect(message.kind === 'lobby' && (message.lobby as { picks: unknown[] }).picks).toHaveLength(2);
    state.stage = 'gameVote';
    broadcaster.update(0.1);
    const [gameVoteMessage] = lobbyMessages(link)[2]!;
    expect(gameVoteMessage.kind === 'lobby' && gameVoteMessage.lobby).toMatchObject({ stage: 'gameVote' });
  });

  it('sends everything again after resend, and nothing to a guest that is gone', () => {
    const { broadcaster, guest, link } = fixture();
    broadcaster.update(0.1);
    broadcaster.resend();
    broadcaster.update(0.1);
    expect(lobbyMessages(link)).toHaveLength(2);
    guest.markLost();
    broadcaster.update(0.1);
    broadcaster.resend();
    broadcaster.update(0.1);
    expect(lobbyMessages(link)).toHaveLength(2);
  });
});
