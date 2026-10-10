import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { encodeSignal } from '../../src/shared/net/signalCodec';

const QUIET_ZONE_MODULES = 4;
const PIXELS_PER_MODULE = 4;

/** The QR code the page draws (same matrix, same quiet zone), as the picture a camera would see. */
function pictureOf(text: string): { readonly data: Uint8ClampedArray; readonly size: number } {
  const { size, data } = QRCode.create(text, { errorCorrectionLevel: 'L' }).modules;
  const modules = size + QUIET_ZONE_MODULES * 2;
  const pixels = modules * PIXELS_PER_MODULE;
  const picture = new Uint8ClampedArray(pixels * pixels * 4).fill(255);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (!data[row * size + column]) continue;
      for (let y = 0; y < PIXELS_PER_MODULE; y += 1) {
        for (let x = 0; x < PIXELS_PER_MODULE; x += 1) {
          const at = (((row + QUIET_ZONE_MODULES) * PIXELS_PER_MODULE + y) * pixels + (column + QUIET_ZONE_MODULES) * PIXELS_PER_MODULE + x) * 4;
          picture.fill(0, at, at + 3);
        }
      }
    }
  }
  return { data: picture, size: pixels };
}

describe('QR code round trip', () => {
  it('reads back a short text', () => {
    const { data, size } = pictureOf('catkart-a:hello');
    expect(jsQR(data, size, size)?.data).toBe('catkart-a:hello');
  });

  it('reads back the address of the join page with a whole offer in it', async () => {
    const sdp = [
      'v=0',
      'a=fingerprint:sha-256 D6:54:53:A9:8D:DB:7B:16:AB:9E:17:B8:59:5A:53:BF:76:2D:F4:B3:EA:8A:DA:00:E8:53:01:95:DC:0A:08:13',
      'a=ice-ufrag:yI37',
      'a=ice-pwd:zd2KRWFUaAtdgye0eIkTVp0U',
      ...Array.from({ length: 6 }, (_, index) => `a=candidate:${index} 1 udp 2113937151 192.168.178.${index} 5000 typ host`),
    ].join('\r\n');
    const text = `https://192.168.178.68:8745/join.html#o=${await encodeSignal({ kind: 'offer', sdp })}`;
    const { data, size } = pictureOf(text);
    expect(jsQR(data, size, size)?.data).toBe(text);
  });
});
