import type { EngineSnapshot } from '../../shared/game/engine';
import { isIntegerIn, isListOf, isRecord, isTextUpTo } from '../../shared/core/wireChecks';

const MAX_SNAPSHOT_BYTES = 12_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** The state of a game, with what the HUD shows, as it goes over the state channel: UTF-8 JSON. */
export interface EngineFrame {
  readonly state: EngineSnapshot;
  readonly hud: {
    readonly places: readonly number[];
    readonly cards: readonly string[];
    readonly lines: readonly string[];
    readonly countdown: string | null;
  };
}

export function encodeEngineFrame(frame: EngineFrame): ArrayBuffer {
  const bytes = encoder.encode(JSON.stringify(frame));
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

const MAX_PLACES = 8;
const MAX_LINES = 8;
const MAX_LINE_CHARACTERS = 60;

const isPlace = (value: unknown): value is number => isIntegerIn(value, 0, MAX_PLACES);
const isLine = (value: unknown): value is string => isTextUpTo(value, MAX_LINE_CHARACTERS);

function isStringList(value: unknown): value is string[] {
  return isListOf(value, 0, MAX_LINES, isLine);
}

/** Null for anything that is not a well-formed frame: not JSON, too big, wrong shape. */
export function decodeEngineFrame(buffer: ArrayBuffer): EngineFrame | null {
  if (buffer.byteLength > MAX_SNAPSHOT_BYTES) return null;
  try {
    const value: unknown = JSON.parse(decoder.decode(buffer));
    if (typeof value !== 'object' || value === null) return null;
    const { state, hud } = value as { state?: unknown; hud?: Record<string, unknown> };
    if (!isRecord(state) || !isRecord(hud)) return null;
    const { places, cards, lines, countdown } = hud;
    if (!isListOf(places, 0, MAX_PLACES, isPlace) || !isStringList(cards) || !isStringList(lines) || !(countdown === null || typeof countdown === 'string'))
      return null;
    return { state: state as EngineSnapshot, hud: { places, cards, lines, countdown } };
  } catch {
    return null;
  }
}
