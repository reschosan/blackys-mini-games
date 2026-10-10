import { describe, expect, it } from 'vitest';
import { decodeSignal, encodeSignal } from '../../src/shared/net/signalCodec';

// What a browser writes for a connection with only the two data channels and local candidates (measured in Chromium, 05.10.2026).
const TYPICAL_SDP = [
  'v=0',
  'o=- 9081128497101374162 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=candidate:23043277 1 udp 2113937151 c2a910ce-a9c3-4879-9a39-798e6db8fbcc.local 62847 typ host generation 0 network-cost 999',
  'a=candidate:696506919 1 udp 2113939711 bd9534fa-de2a-4928-842a-8202bc186c66.local 58285 typ host generation 0 network-cost 999',
  'a=ice-ufrag:yI37',
  'a=ice-pwd:zd2KRWFUaAtdgye0eIkTVp0U',
  'a=ice-options:trickle',
  'a=fingerprint:sha-256 D6:54:53:A9:8D:DB:7B:16:AB:9E:17:B8:59:5A:53:BF:76:2D:F4:B3:EA:8A:DA:00:E8:53:01:95:DC:0A:08:13',
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
  '',
].join('\r\n');

// A QR code of error level L holds about 2.9 KB; the address of the page and the margin take some of it.
const QR_BUDGET_CHARACTERS = 1500;

describe('signal codec', () => {
  it('gives the same offer back that went in', async () => {
    const code = await encodeSignal({ kind: 'offer', sdp: TYPICAL_SDP });
    expect(await decodeSignal(code)).toEqual({ kind: 'offer', sdp: TYPICAL_SDP });
  });

  it('keeps the seat of a returning player and tells answers from offers', async () => {
    const code = await encodeSignal({ kind: 'answer', sdp: TYPICAL_SDP, seatId: 2 });
    expect(await decodeSignal(code)).toEqual({ kind: 'answer', sdp: TYPICAL_SDP, seatId: 2 });
  });

  it('fits a QR code with room to spare', async () => {
    const code = await encodeSignal({ kind: 'offer', sdp: TYPICAL_SDP });
    expect(code.length).toBeLessThan(QR_BUDGET_CHARACTERS);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each(['', 'hello', '%%%', 'eJwDAAAAAAE', 'a'.repeat(5000)])('ignores something that is not a code: %j', async (text) => {
    expect(await decodeSignal(text)).toBeNull();
  });

  it('ignores a code of another version', async () => {
    const wrongVersion = Buffer.from(JSON.stringify({ v: 99, t: 'o', s: 'x' }));
    const stream = new Blob([wrongVersion]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const code = Buffer.from(await new Response(stream).arrayBuffer()).toString('base64url');
    expect(await decodeSignal(code)).toBeNull();
  });
});
