import { ByteReader, ByteWriter } from './byteStream';
import { readKart, writeKart } from './kartSnapshotCodec';
import type {
  HairballSnapshot,
  TrapSnapshot,
  LaserSnapshot,
  GravityBubbleSnapshot,
  VacuumSnapshot,
  ShellSnapshot,
  ExplosionSnapshot,
  RaceSnapshot,
} from './snapshotTypes';

const SNAPSHOT_FORMAT_VERSION = 4;
const MAX_KARTS = 8;
const MAX_OBJECTS = 64;
const MAX_EXTRAS = 48;
/** Where the acknowledged input of the receiving guest sits: after version (1), spare (1) and sequence (2). */
const ACK_BYTE_OFFSET = 4;

function writeList<T>(writer: ByteWriter, items: readonly T[], write: (item: T) => void): void {
  writer.u8(Math.min(items.length, MAX_OBJECTS));
  for (const item of items.slice(0, MAX_OBJECTS)) write(item);
}

function readList<T>(reader: ByteReader, read: () => T): T[] {
  return Array.from({ length: reader.count(MAX_OBJECTS) }, read);
}

function writeWorld(writer: ByteWriter, snapshot: RaceSnapshot): void {
  writeList(writer, snapshot.hairballs, (item) => {
    writer.u8(item.kind === 'yarn' ? 1 : 0);
    writer.f32(item.x);
    writer.f32(item.z);
    writer.f32(item.vx);
    writer.f32(item.vz);
    writer.u8(item.ownerIndex);
    writer.text(item.levelId);
    writer.optionalF32(item.elevation);
  });
  writeList(writer, snapshot.traps, (item) => {
    writer.u8(item.kind === 'cowpat' ? 1 : 0);
    writer.f32(item.x);
    writer.f32(item.z);
    writer.u8(item.ownerIndex);
    writer.text(item.levelId);
    writer.optionalF32(item.elevation);
  });
  writeList(writer, snapshot.lasers, (item) => {
    writer.f32(item.x);
    writer.f32(item.z);
    writer.f32(item.vx);
    writer.f32(item.vz);
    writer.u8(item.ownerIndex);
    writer.text(item.levelId);
    writer.f32(item.secondsLeft);
  });
  writeList(writer, snapshot.gravityBubbles, (item) => {
    writer.f32(item.x);
    writer.f32(item.z);
    writer.u8(item.ownerIndex);
    writer.text(item.levelId);
    writer.f32(item.elevation);
    writer.f32(item.secondsLeft);
  });
  writeList(writer, snapshot.vacuumPulses, (item) => {
    writer.f32(item.x);
    writer.f32(item.z);
    writer.f32(item.yaw);
    writer.text(item.levelId);
    writer.f32(item.ageSeconds);
  });
  writeList(writer, snapshot.shells, (item) => {
    writer.f32(item.x);
    writer.f32(item.z);
    writer.f32(item.heading);
    writer.f32(item.ageSeconds);
    writer.u8(item.ownerIndex);
    writer.u8(item.targetIndex);
    writer.text(item.levelId);
    writer.f32(item.elevation);
  });
  writeList(writer, snapshot.explosions, (item) => {
    writer.f32(item.x);
    writer.f32(item.z);
    writer.text(item.levelId);
    writer.f32(item.elevation);
    writer.f32(item.ageSeconds);
  });
  writer.u8(Math.min(snapshot.itemBoxCollected.length, 255));
  for (let from = 0; from < Math.min(snapshot.itemBoxCollected.length, 255); from += 8) {
    let bits = 0;
    for (let bit = 0; bit < 8; bit += 1) if (snapshot.itemBoxCollected[from + bit]) bits |= 1 << bit;
    writer.u8(bits);
  }
  writer.u8(Math.min(snapshot.extras.length, MAX_EXTRAS));
  for (const value of snapshot.extras.slice(0, MAX_EXTRAS)) writer.f32(value);
}

function readWorld(
  reader: ByteReader,
): Pick<RaceSnapshot, 'hairballs' | 'traps' | 'lasers' | 'gravityBubbles' | 'vacuumPulses' | 'shells' | 'explosions' | 'itemBoxCollected' | 'extras'> {
  const hairballs = readList(reader, (): HairballSnapshot => ({
    kind: reader.u8() === 1 ? 'yarn' : 'hairball',
    x: reader.f32(),
    z: reader.f32(),
    vx: reader.f32(),
    vz: reader.f32(),
    ownerIndex: reader.u8(),
    levelId: reader.text() ?? '',
    elevation: reader.optionalF32(),
  }));
  const traps = readList(reader, (): TrapSnapshot => ({
    kind: reader.u8() === 1 ? 'cowpat' : 'cup',
    x: reader.f32(),
    z: reader.f32(),
    ownerIndex: reader.u8(),
    levelId: reader.text() ?? '',
    elevation: reader.optionalF32(),
  }));
  const lasers = readList(reader, (): LaserSnapshot => ({
    x: reader.f32(),
    z: reader.f32(),
    vx: reader.f32(),
    vz: reader.f32(),
    ownerIndex: reader.u8(),
    levelId: reader.text() ?? '',
    secondsLeft: reader.f32(),
  }));
  const gravityBubbles = readList(reader, (): GravityBubbleSnapshot => ({
    x: reader.f32(),
    z: reader.f32(),
    ownerIndex: reader.u8(),
    levelId: reader.text() ?? '',
    elevation: reader.f32(),
    secondsLeft: reader.f32(),
  }));
  const vacuumPulses = readList(reader, (): VacuumSnapshot => ({
    x: reader.f32(),
    z: reader.f32(),
    yaw: reader.f32(),
    levelId: reader.text() ?? '',
    ageSeconds: reader.f32(),
  }));
  const shells = readList(reader, (): ShellSnapshot => ({
    x: reader.f32(),
    z: reader.f32(),
    heading: reader.f32(),
    ageSeconds: reader.f32(),
    ownerIndex: reader.u8(),
    targetIndex: reader.u8(),
    levelId: reader.text() ?? '',
    elevation: reader.f32(),
  }));
  const explosions = readList(reader, (): ExplosionSnapshot => ({
    x: reader.f32(),
    z: reader.f32(),
    levelId: reader.text() ?? '',
    elevation: reader.f32(),
    ageSeconds: reader.f32(),
  }));
  const boxCount = reader.u8();
  const itemBoxCollected: boolean[] = [];
  for (let from = 0; from < boxCount; from += 8) {
    const bits = reader.u8();
    for (let bit = 0; bit < 8 && from + bit < boxCount; bit += 1) itemBoxCollected.push((bits & (1 << bit)) !== 0);
  }
  const extras = Array.from({ length: reader.count(MAX_EXTRAS) }, () => reader.f32());
  return { hairballs, traps, lasers, gravityBubbles, vacuumPulses, shells, explosions, itemBoxCollected, extras };
}

export function encodeSnapshot(snapshot: RaceSnapshot): ArrayBuffer {
  const writer = new ByteWriter();
  writer.u8(SNAPSHOT_FORMAT_VERSION);
  writer.u8(0);
  writer.u16(snapshot.sequence & 0xffff);
  writer.u16(snapshot.ackInputSequence & 0xffff);
  writer.f32(snapshot.raceTimeSeconds);
  writer.f32(snapshot.countdownSecondsLeft);
  writer.bool(snapshot.goDisplayActive);
  writer.optionalF32(snapshot.finishCountdownSeconds);
  writer.u8(Math.min(snapshot.karts.length, MAX_KARTS));
  for (const kart of snapshot.karts.slice(0, MAX_KARTS)) writeKart(writer, kart);
  writeWorld(writer, snapshot);
  return writer.toArrayBuffer();
}

/** The same snapshot for another guest: only the acknowledged input differs, so the rest is copied as it is. */
export function withAckInputSequence(encoded: ArrayBuffer, ackInputSequence: number): ArrayBuffer {
  const copy = encoded.slice(0);
  new DataView(copy).setUint16(ACK_BYTE_OFFSET, ackInputSequence & 0xffff, true);
  return copy;
}

/** Null for anything that is not a well-formed snapshot of this version: wrong version, cut off, too many entries, broken numbers. */
export function decodeSnapshot(buffer: ArrayBuffer): RaceSnapshot | null {
  try {
    const reader = new ByteReader(buffer);
    if (reader.u8() !== SNAPSHOT_FORMAT_VERSION) return null;
    reader.u8();
    const sequence = reader.u16();
    const ackInputSequence = reader.u16();
    const raceTimeSeconds = reader.f32();
    const countdownSecondsLeft = reader.f32();
    const goDisplayActive = reader.bool();
    const finishCountdownSeconds = reader.optionalF32();
    const karts = Array.from({ length: reader.count(MAX_KARTS) }, () => readKart(reader));
    const world = readWorld(reader);
    if (!reader.atEnd()) return null;
    return { sequence, ackInputSequence, raceTimeSeconds, countdownSecondsLeft, goDisplayActive, finishCountdownSeconds, karts, ...world };
  } catch {
    return null;
  }
}

/** Is `candidate` newer than `reference`? Sequence numbers wrap, so the difference is read as a signed 16 bit number. */
export function isNewerSequence(candidate: number, reference: number): boolean {
  return ((candidate - reference) & 0xffff) !== 0 && ((candidate - reference) & 0x8000) === 0;
}
