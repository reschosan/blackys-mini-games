const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: true });
const MAX_STRING_BYTES = 60;

/** Writes numbers and short texts into a growing byte buffer, little endian. */
export class ByteWriter {
  private bytes = new Uint8Array(512);
  private view = new DataView(this.bytes.buffer);
  private length = 0;

  private reserve(count: number): void {
    if (this.length + count <= this.bytes.length) return;
    const bigger = new Uint8Array(Math.max(this.bytes.length * 2, this.length + count));
    bigger.set(this.bytes);
    this.bytes = bigger;
    this.view = new DataView(bigger.buffer);
  }

  u8(value: number): void {
    this.reserve(1);
    this.view.setUint8(this.length, value);
    this.length += 1;
  }

  i8(value: number): void {
    this.reserve(1);
    this.view.setInt8(this.length, value);
    this.length += 1;
  }

  u16(value: number): void {
    this.reserve(2);
    this.view.setUint16(this.length, value, true);
    this.length += 2;
  }

  f32(value: number): void {
    this.reserve(4);
    this.view.setFloat32(this.length, value, true);
    this.length += 4;
  }

  /** A number that may be missing: a flag, then the number (0 when missing). */
  optionalF32(value: number | null): void {
    this.bool(value !== null);
    this.f32(value ?? 0);
  }

  bool(value: boolean): void {
    this.u8(value ? 1 : 0);
  }

  /** Text up to 60 bytes; an empty text stands for "none". */
  text(value: string | null): void {
    const encoded = TEXT_ENCODER.encode(value ?? '');
    if (encoded.length > MAX_STRING_BYTES) throw new RangeError('text too long for a snapshot');
    this.u8(encoded.length);
    this.reserve(encoded.length);
    this.bytes.set(encoded, this.length);
    this.length += encoded.length;
  }

  toArrayBuffer(): ArrayBuffer {
    return this.bytes.slice(0, this.length).buffer;
  }
}

/** Reads what `ByteWriter` wrote. Any read past the end or any broken text throws, so a damaged message is dropped as a whole. */
export class ByteReader {
  private readonly view: DataView;
  private position = 0;

  constructor(private readonly buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  private take(count: number): number {
    if (this.position + count > this.buffer.byteLength) throw new RangeError('message ends too early');
    const start = this.position;
    this.position += count;
    return start;
  }

  u8(): number {
    return this.view.getUint8(this.take(1));
  }

  i8(): number {
    return this.view.getInt8(this.take(1));
  }

  u16(): number {
    return this.view.getUint16(this.take(2), true);
  }

  /** Always a finite number: NaN and infinity never reach the game. */
  f32(): number {
    const value = this.view.getFloat32(this.take(4), true);
    if (!Number.isFinite(value)) throw new RangeError('number is not finite');
    return value;
  }

  optionalF32(): number | null {
    const present = this.bool();
    const value = this.f32();
    return present ? value : null;
  }

  bool(): boolean {
    return this.u8() === 1;
  }

  text(): string | null {
    const length = this.u8();
    if (length > MAX_STRING_BYTES) throw new RangeError('text too long');
    const start = this.take(length);
    return length === 0 ? null : TEXT_DECODER.decode(new Uint8Array(this.buffer, start, length));
  }

  /** A count of things that follow, at most `limit`. */
  count(limit: number): number {
    const value = this.u8();
    if (value > limit) throw new RangeError('too many entries');
    return value;
  }

  atEnd(): boolean {
    return this.position === this.buffer.byteLength;
  }
}
