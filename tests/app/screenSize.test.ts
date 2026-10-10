import { describe, expect, it } from 'vitest';
import { isPhoneScreen, screenSizeClassFor } from '../../src/party/app/screenSize';

describe('screen size classes', () => {
  it.each([
    [844, 390, 'S'],
    [390, 844, 'S'],
    [1024, 768, 'M'],
    [768, 1024, 'M'],
    [1280, 720, 'M'],
    [1440, 900, 'L'],
    [1920, 1080, 'XL'],
  ] as const)('classifies %i x %i as %s', (width, height, expected) => {
    expect(screenSizeClassFor(width, height)).toBe(expected);
  });
});

describe('phone detection', () => {
  it.each([
    [390, 844, true, true],
    [844, 390, true, true],
    [744, 1133, true, true],
    [768, 1024, true, false],
    [1180, 820, true, false],
    [390, 844, false, false],
  ] as const)('%i x %i with touch %s is a phone: %s', (width, height, coarse, expected) => {
    expect(isPhoneScreen(width, height, coarse)).toBe(expected);
  });
});
