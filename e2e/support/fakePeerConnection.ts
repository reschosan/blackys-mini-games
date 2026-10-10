import type { BrowserContext } from '@playwright/test';

/** Stands in for the browser's `RTCPeerConnection` so two pages of one browser can "connect" without a network: the pages
 *  talk through a `BroadcastChannel`. It checks the game's own logic (codes, seats, messages, lost connections), not the
 *  browser's WebRTC; `remoteGuestsReal.spec.ts` covers that where the machine allows it. */
export async function installFakePeerConnection(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    type Listener = (event: unknown) => void;
    const bus = new BroadcastChannel('fake-peer-connection');

    class Emitter {
      private readonly listeners = new Map<string, Listener[]>();
      addEventListener(type: string, listener: Listener): void {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
      }
      removeEventListener(type: string, listener: Listener): void {
        this.listeners.set(
          type,
          (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener),
        );
      }
      protected emit(type: string, event: unknown = {}): void {
        for (const listener of this.listeners.get(type) ?? []) listener(event);
      }
    }

    class FakeChannel extends Emitter {
      readyState = 'connecting';
      binaryType = 'blob';
      constructor(
        private readonly owner: FakeConnection,
        readonly id: number,
      ) {
        super();
      }
      send(data: string | ArrayBuffer): void {
        if (this.readyState === 'open') bus.postMessage({ to: this.owner.remoteId, kind: 'data', channel: this.id, data });
      }
      receive(data: unknown): void {
        this.emit('message', { data });
      }
      open(): void {
        this.readyState = 'open';
        this.emit('open');
      }
      end(): void {
        this.readyState = 'closed';
        this.emit('close');
      }
    }

    class FakeConnection extends Emitter {
      readonly id = Math.random().toString(36).slice(2);
      remoteId = '';
      iceGatheringState = 'new';
      connectionState = 'new';
      localDescription: { type: string; sdp: string } | null = null;
      private readonly channels = new Map<number, FakeChannel>();
      private readonly onBus = (event: MessageEvent): void => this.handle(event.data);

      constructor() {
        super();
        bus.addEventListener('message', this.onBus);
      }
      createDataChannel(_label: string, options: { id: number }): FakeChannel {
        const channel = new FakeChannel(this, options.id);
        this.channels.set(options.id, channel);
        return channel;
      }
      async createOffer() {
        return { type: 'offer', sdp: `fake-offer:${this.id}` };
      }
      async createAnswer() {
        return { type: 'answer', sdp: `fake-answer:${this.id}` };
      }
      async setLocalDescription(description: { type: string; sdp: string }): Promise<void> {
        this.localDescription = description;
        this.iceGatheringState = 'complete';
        this.emit('icegatheringstatechange');
      }
      async setRemoteDescription(description: { type: string; sdp: string }): Promise<void> {
        this.remoteId = description.sdp.split(':')[1] ?? '';
        if (description.type === 'answer') {
          bus.postMessage({ to: this.remoteId, kind: 'hello', from: this.id });
          this.connect();
        }
      }
      close(): void {
        if (this.connectionState === 'closed') return;
        this.connectionState = 'closed';
        bus.removeEventListener('message', this.onBus);
        for (const channel of this.channels.values()) channel.end();
        this.emit('connectionstatechange');
      }
      private connect(): void {
        this.connectionState = 'connected';
        this.emit('connectionstatechange');
        window.setTimeout(() => this.channels.forEach((channel) => channel.open()), 20);
      }
      private handle(message: { to: string; kind: string; from?: string; channel?: number; data?: unknown }): void {
        if (message.to !== this.id) return;
        if (message.kind === 'hello') {
          this.remoteId = message.from ?? '';
          this.connect();
        } else if (message.kind === 'data') {
          this.channels.get(message.channel ?? -1)?.receive(message.data);
        }
      }
    }

    (window as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = FakeConnection;
  });
}
