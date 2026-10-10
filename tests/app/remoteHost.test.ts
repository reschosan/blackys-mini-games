import { t } from '../../src/shared/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteHost } from '../../src/party/app/remoteHost';
import { createRuntimeRemote, REMOTE_ANSWER_PREFIX } from '../../src/shared/config/remote';
import { createRuntimeTouchSteering } from '../../src/shared/config/touch';
import { InputManager } from '../../src/shared/input/inputManager';
import { RemoteInput } from '../../src/shared/input/remote/remoteInput';

const { FakeInvitation } = vi.hoisted(() => {
  type Events = { onOpen(): void; onLost(): void; onRawInput(raw: unknown): void; onRawControl(raw: unknown): void };
  class FakeInvitation {
    static all: FakeInvitation[] = [];
    readonly sent: string[] = [];
    cancelled = false;
    answerAccepted = true;
    readonly peerLink = { sendControl: (text: string) => this.sent.push(text), sendState: vi.fn() };
    constructor(
      _config: unknown,
      readonly events: Events,
      readonly seatId?: number,
    ) {
      FakeInvitation.all.push(this);
    }
    async createOfferCode(): Promise<string> {
      return `offer-${FakeInvitation.all.length}`;
    }
    async acceptAnswerCode(): Promise<boolean> {
      return this.answerAccepted;
    }
    cancel(): void {
      this.cancelled = true;
    }
  }
  return { FakeInvitation };
});

vi.mock('../../src/shared/net/hostInvitation', () => ({ HostInvitation: FakeInvitation }));

beforeEach(() => {
  FakeInvitation.all = [];
  (globalThis as unknown as { document: { hasFocus(): boolean } }).document = { hasFocus: () => true };
  Object.defineProperty(globalThis.navigator, 'getGamepads', { value: () => [], configurable: true });
  vi.stubGlobal('window', { location: { href: 'https://host.example/index.html', search: '' } });
});

function fixture(canAddSeats = true) {
  const input = new InputManager(createRuntimeTouchSteering());
  input.joinTouch();
  const events = { guestJoined: vi.fn(), canAddSeats: () => canAddSeats, guestReturned: vi.fn(), guestMessage: vi.fn(), changed: vi.fn() };
  const host = new RemoteHost(input, createRuntimeRemote(), events);
  return { host, input, events };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const latest = () => FakeInvitation.all[FakeInvitation.all.length - 1]!;

describe('RemoteHost', () => {
  it('opens with a code for the next seat that holds the address of the join page', async () => {
    const { host } = fixture();
    host.open();
    await settle();
    expect(host.state.status).toBe('waiting');
    expect(host.state.qrText).toBe('https://host.example/join.html#o=offer-1');
  });

  it('ignores a code that is not an answer and reports a wrong code only once', async () => {
    const { host, events } = fixture();
    host.open();
    await settle();
    await host.submitScan('something else');
    const callsAfterFirst = events.changed.mock.calls.length;
    await host.submitScan('something else');
    expect(host.state.problem).toBe(t().problems.invite.notMyCode);
    expect(events.changed.mock.calls.length).toBe(callsAfterFirst);
    expect(host.state.status).toBe('waiting');
  });

  it('tells the host when the code it scanned is an invitation, not an answer', async () => {
    const { host } = fixture();
    host.open();
    await settle();
    await host.submitScan('https://host.example/join.html#o=abc');
    expect(host.state.problem).toBe(t().problems.invite.invitationScanned);
  });

  it('seats a phone whose connection opens, and offers the next seat', async () => {
    const { host, input, events } = fixture();
    host.open();
    await settle();
    const first = latest();
    await host.submitScan(`${REMOTE_ANSWER_PREFIX}answer`);
    expect(host.state.status).toBe('connecting');
    first.events.onOpen();
    await settle();
    expect(input.remoteInputs).toHaveLength(1);
    expect(events.guestJoined).toHaveBeenCalledTimes(1);
    expect(latest()).not.toBe(first);
    expect(host.state.status).toBe('waiting');
    expect(host.state.guestCount).toBe(1);
  });

  it('starts again with a problem when the answer is refused', async () => {
    const { host } = fixture();
    host.open();
    await settle();
    latest().answerAccepted = false;
    await host.submitScan(`${REMOTE_ANSWER_PREFIX}answer`);
    await settle();
    expect(host.state.problem).toBe(t().problems.invite.notMyCode);
    expect(host.state.status).toBe('waiting');
  });

  it('gives a phone that dropped out its old seat back instead of a new one', async () => {
    const { host, input, events } = fixture();
    host.open();
    await settle();
    latest().events.onOpen();
    await settle();
    const guest = input.remoteInputs[0]!;
    guest.markLost();
    host.renew();
    await settle();
    expect(host.state.reclaiming).toBe(true);
    expect(latest().seatId).toBe(guest.id);
    latest().events.onOpen();
    await settle();
    expect(input.remoteInputs).toHaveLength(1);
    expect(guest.connected).toBe(true);
    expect(events.guestReturned).toHaveBeenCalledWith(guest);
  });

  it('is complete, not waiting, when no new seats may be taken and nobody is missing', async () => {
    const { host } = fixture(false);
    host.open();
    await settle();
    expect(host.state.status).toBe('complete');
    expect(FakeInvitation.all).toHaveLength(0);
  });

  it('says all seats are taken at four players', async () => {
    const { host, input } = fixture();
    for (let seat = 0; seat < 3; seat += 1) {
      input.addRemote(new RemoteInput(input.nextRemoteId(), { send: vi.fn(), sendState: vi.fn(), close: vi.fn() }, createRuntimeRemote()));
    }
    host.open();
    await settle();
    expect(host.state.status).toBe('full');
    expect(host.state.problem).toBe(t().problems.invite.full);
  });

  it('replaces a code nobody answered after its lifetime, and gives up a connection that never opens', async () => {
    const { host } = fixture();
    host.open();
    await settle();
    host.tick(61);
    await settle();
    expect(FakeInvitation.all).toHaveLength(2);
    await host.submitScan(`${REMOTE_ANSWER_PREFIX}answer`);
    host.tick(16);
    await settle();
    expect(host.state.problem).toBe(t().problems.invite.connectionFailed);
  });

  it('routes what a guest sends: input to its seat, control messages to the game, and drops garbage', async () => {
    const { host, input, events } = fixture();
    host.open();
    await settle();
    const invitation = latest();
    invitation.events.onOpen();
    await settle();
    invitation.events.onRawInput('not json');
    invitation.events.onRawControl('not json');
    expect(events.guestMessage).not.toHaveBeenCalled();
    invitation.events.onRawControl(JSON.stringify({ k: 'r', m: 1 }));
    expect(events.guestMessage).toHaveBeenCalledWith(input.remoteInputs[0], { kind: 'ready', renders: true });
    invitation.events.onRawInput(JSON.stringify({ k: 'i', x: 0, y: 0, b: 0, m: 0, n: 5 }));
    expect(input.remoteInputs[0]!.lastInputSequence).toBe(5);
  });

  it('marks a seated phone lost when its connection ends', async () => {
    const { host, input } = fixture();
    host.open();
    await settle();
    latest().events.onOpen();
    await settle();
    const guest = input.remoteInputs[0]!;
    FakeInvitation.all[0]!.events.onLost();
    expect(guest.connected).toBe(false);
  });
});
