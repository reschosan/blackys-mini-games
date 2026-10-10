import { REMOTE_PROTOCOL_VERSION } from '../config/remote';

type SignalKind = 'offer' | 'answer';

/** What a QR code carries to set up one connection: the browser's session description and, for a returning
 *  player, the seat they get back. */
export interface Signal {
  readonly kind: SignalKind;
  readonly sdp: string;
  readonly seatId?: number;
}

interface WireSignal {
  readonly v: number;
  readonly t: 'o' | 'a';
  readonly s: string;
  readonly i?: number;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(text.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function pipeThrough(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const piped = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

export async function encodeSignal(signal: Signal): Promise<string> {
  const wire: WireSignal = {
    v: REMOTE_PROTOCOL_VERSION,
    t: signal.kind === 'offer' ? 'o' : 'a',
    s: signal.sdp,
    ...(signal.seatId === undefined ? {} : { i: signal.seatId }),
  };
  const packed = await pipeThrough(new TextEncoder().encode(JSON.stringify(wire)), new CompressionStream('deflate-raw'));
  return toBase64Url(packed);
}

function isWireSignal(value: unknown): value is WireSignal {
  if (typeof value !== 'object' || value === null) return false;
  const wire = value as Record<string, unknown>;
  const seatOk = wire.i === undefined || (Number.isInteger(wire.i) && (wire.i as number) >= 0 && (wire.i as number) < 16);
  return wire.v === REMOTE_PROTOCOL_VERSION && (wire.t === 'o' || wire.t === 'a') && typeof wire.s === 'string' && seatOk;
}

/** Null for anything that is not a code of this game, so a wrong QR code is simply ignored. */
export async function decodeSignal(code: string): Promise<Signal | null> {
  try {
    const unpacked = await pipeThrough(fromBase64Url(code), new DecompressionStream('deflate-raw'));
    const wire: unknown = JSON.parse(new TextDecoder().decode(unpacked));
    if (!isWireSignal(wire)) return null;
    return { kind: wire.t === 'o' ? 'offer' : 'answer', sdp: wire.s, ...(wire.i === undefined ? {} : { seatId: wire.i }) };
  } catch {
    return null;
  }
}
