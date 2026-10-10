import { ITEM_TYPES } from '../../../shared/config/items';
import type { ByteReader, ByteWriter } from './byteStream';
import type { KartSnapshot } from './snapshotTypes';

/** Marks an empty item slot in the byte that otherwise holds the index into `ITEM_TYPES`. */
const NO_ITEM = 255;

/** One kart of a snapshot, field by field in a fixed order: `readKart` reads exactly what `writeKart` writes. */
export function writeKart(writer: ByteWriter, kart: KartSnapshot): void {
  writer.f32(kart.x);
  writer.f32(kart.z);
  writer.f32(kart.yaw);
  writer.f32(kart.velocityX);
  writer.f32(kart.velocityZ);
  writer.text(kart.levelId);
  writer.text(kart.stairTransitionId);
  writer.i8(kart.driftDirection);
  writer.u8(kart.driftStage);
  writer.f32(kart.driftCharge);
  writer.text(kart.lastBoostFieldId);
  writer.text(kart.lastWindowJumpId);
  writer.f32(kart.boostSeconds);
  writer.f32(kart.stunSecondsLeft);
  writer.f32(kart.stickySecondsLeft);
  writer.f32(kart.shieldSecondsLeft);
  writer.f32(kart.catnipSecondsLeft);
  writer.f32(kart.penaltySecondsLeft);
  writer.f32(kart.airborneSecondsLeft);
  writer.f32(kart.airborneSeconds);
  writer.f32(kart.shoveCooldownSeconds);
  writer.bool(kart.onCarpet);
  writer.text(kart.surfaceKind);
  writer.text(kart.windowJumpId);
  writer.f32(kart.windowJumpElapsedSeconds);
  writer.u8(kart.lap);
  writer.u8(kart.nextCheckpoint);
  writer.bool(kart.finished);
  writer.optionalF32(kart.finishTimeSeconds);
  writer.u8(kart.heldItem === null ? NO_ITEM : ITEM_TYPES.indexOf(kart.heldItem));
  writer.u8(kart.place);
}

export function readKart(reader: ByteReader): KartSnapshot {
  const x = reader.f32();
  const z = reader.f32();
  const yaw = reader.f32();
  const velocityX = reader.f32();
  const velocityZ = reader.f32();
  const levelId = reader.text() ?? '';
  const stairTransitionId = reader.text();
  const drift = reader.i8();
  if (drift < -1 || drift > 1) throw new RangeError('drift direction');
  const driftStage = reader.u8();
  const driftCharge = reader.f32();
  const lastBoostFieldId = reader.text();
  const lastWindowJumpId = reader.text();
  const boostSeconds = reader.f32();
  const stunSecondsLeft = reader.f32();
  const stickySecondsLeft = reader.f32();
  const shieldSecondsLeft = reader.f32();
  const catnipSecondsLeft = reader.f32();
  const penaltySecondsLeft = reader.f32();
  const airborneSecondsLeft = reader.f32();
  const airborneSeconds = reader.f32();
  const shoveCooldownSeconds = reader.f32();
  const onCarpet = reader.bool();
  const surfaceKind = reader.text();
  const windowJumpId = reader.text();
  const windowJumpElapsedSeconds = reader.f32();
  const lap = reader.u8();
  const nextCheckpoint = reader.u8();
  const finished = reader.bool();
  const finishTimeSeconds = reader.optionalF32();
  const itemIndex = reader.u8();
  const heldItem = itemIndex === NO_ITEM ? null : ITEM_TYPES[itemIndex];
  if (heldItem === undefined) throw new RangeError('item');
  return {
    x,
    z,
    yaw,
    velocityX,
    velocityZ,
    levelId,
    stairTransitionId,
    driftDirection: drift as -1 | 0 | 1,
    driftStage,
    driftCharge,
    lastBoostFieldId,
    lastWindowJumpId,
    boostSeconds,
    stunSecondsLeft,
    stickySecondsLeft,
    shieldSecondsLeft,
    catnipSecondsLeft,
    penaltySecondsLeft,
    airborneSecondsLeft,
    airborneSeconds,
    shoveCooldownSeconds,
    onCarpet,
    surfaceKind,
    windowJumpId,
    windowJumpElapsedSeconds,
    lap,
    nextCheckpoint,
    finished,
    finishTimeSeconds,
    heldItem,
    place: reader.u8(),
  };
}
