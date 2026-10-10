/** Checks for data that came from another device or out of storage, before anything trusts it. */

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isIntegerIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function isTextUpTo(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

export function isListOf<T>(value: unknown, minLength: number, maxLength: number, isItem: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.length >= minLength && value.length <= maxLength && value.every(isItem);
}
