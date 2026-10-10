import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PeerLink, type PeerLinkEvents } from '../../src/shared/net/peerLink';
import { createRuntimeRemote } from '../../src/shared/config/remote';

type Listener = (event: { data?: unknown }) => void;

class FakeChannel {
  readyState = 'open';
  binaryType = 'blob';
  readonly sent: unknown[] = [];
  private readonly listeners = new Map<string, Listener[]>();
  constructor(readonly id: number) {}
  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  send(data: unknown): void {
    this.sent.push(data);
  }
  emit(type: string, event: { data?: unknown } = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class FakeConnection {
  static last: FakeConnection;
  connectionState = 'new';
  iceGatheringState = 'complete';
  closed = false;
  readonly channels: FakeChannel[] = [];
  private readonly listeners = new Map<string, Listener[]>();
  constructor() {
    FakeConnection.last = this;
  }
  createDataChannel(_label: string, options: { id: number }): FakeChannel {
    const channel = new FakeChannel(options.id);
    this.channels.push(channel);
    return channel;
  }
  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  removeEventListener(): void {}
  close(): void {
    this.closed = true;
  }
  changeState(state: string): void {
    this.connectionState = state;
    for (const listener of this.listeners.get('connectionstatechange') ?? []) listener({});
  }
}

const INPUT = 0;
const CONTROL = 1;
const STATE = 2;

function events(): PeerLinkEvents {
  return { onOpen: vi.fn(), onLost: vi.fn(), onRawInput: vi.fn(), onRawControl: vi.fn(), onRawState: vi.fn() };
}

function open(heartbeat: 'input' | 'control' = 'input', timeoutMilliseconds = 2000) {
  const listener = events();
  const link = new PeerLink(createRuntimeRemote(), { channel: heartbeat, timeoutMilliseconds }, listener);
  const connection = FakeConnection.last;
  connection.channels[CONTROL]!.emit('open');
  return { link, connection, listener, channel: (id: number) => connection.channels[id]! };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('RTCPeerConnection', FakeConnection);
  vi.stubGlobal('window', globalThis);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('PeerLink', () => {
  it('reports open once, when the control channel opens', () => {
    const { link, listener, channel } = open();
    channel(CONTROL).emit('open');
    expect(link.linkState).toBe('open');
    expect(listener.onOpen).toHaveBeenCalledTimes(1);
  });

  it('hands received messages to the matching handler', () => {
    const { listener, channel } = open();
    channel(INPUT).emit('message', { data: 'i' });
    channel(CONTROL).emit('message', { data: 'c' });
    expect(listener.onRawInput).toHaveBeenCalledWith('i');
    expect(listener.onRawControl).toHaveBeenCalledWith('c');
  });

  it('passes on snapshots of a sane size and drops text and oversized ones', () => {
    const { listener, channel } = open();
    channel(STATE).emit('message', { data: new ArrayBuffer(200) });
    channel(STATE).emit('message', { data: 'text' });
    channel(STATE).emit('message', { data: new ArrayBuffer(100_000) });
    expect(listener.onRawState).toHaveBeenCalledTimes(1);
  });

  it('drops input beyond the rate limit', () => {
    const { listener, channel } = open();
    for (let count = 0; count < 300; count += 1) channel(INPUT).emit('message', { data: 'i' });
    expect(vi.mocked(listener.onRawInput).mock.calls.length).toBe(240);
  });

  it('counts the host as lost when the channel it listens to stays silent', () => {
    const { link, listener, connection } = open('input', 1000);
    vi.advanceTimersByTime(2000);
    expect(listener.onLost).toHaveBeenCalledTimes(1);
    expect(link.linkState).toBe('lost');
    expect(connection.closed).toBe(true);
  });

  it('stays open while messages keep arriving on the heartbeat channel', () => {
    const { listener, channel } = open('input', 1000);
    for (let step = 0; step < 10; step += 1) {
      vi.advanceTimersByTime(400);
      channel(INPUT).emit('message', { data: 'i' });
    }
    expect(listener.onLost).not.toHaveBeenCalled();
  });

  it('does not take the other channels as a sign of life', () => {
    const { listener, channel } = open('input', 1000);
    for (let step = 0; step < 10; step += 1) {
      vi.advanceTimersByTime(400);
      channel(CONTROL).emit('message', { data: 'c' });
    }
    expect(listener.onLost).toHaveBeenCalledTimes(1);
  });

  it('reports a lost connection only once, however it ends', () => {
    const { listener, connection, channel } = open();
    connection.changeState('failed');
    channel(CONTROL).emit('close');
    vi.advanceTimersByTime(5000);
    expect(listener.onLost).toHaveBeenCalledTimes(1);
  });

  it('sends only on open channels, and a closed link reports nothing', () => {
    const { link, listener, channel } = open();
    link.sendInput('x');
    link.sendControl('y');
    link.sendState(new ArrayBuffer(4));
    expect(channel(INPUT).sent).toEqual(['x']);
    expect(channel(CONTROL).sent).toEqual(['y']);
    channel(INPUT).readyState = 'closed';
    link.sendInput('z');
    expect(channel(INPUT).sent).toEqual(['x']);
    link.close();
    vi.advanceTimersByTime(5000);
    expect(listener.onLost).not.toHaveBeenCalled();
  });
});
