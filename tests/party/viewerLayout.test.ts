import { describe, expect, it } from 'vitest';
import { canSplitScreen } from '../../src/party/app/viewerLayout';

describe('which screens may show a split screen', () => {
  it.each([
    ['a phone held upright', 390, 844, true, false],
    ['a phone held sideways', 844, 390, true, false],
    ['a tablet in landscape', 1024, 768, true, true],
    ['a tablet upright', 768, 1024, true, false],
    ['a laptop', 1280, 720, false, true],
    ['a monitor', 1920, 1080, false, true],
    ['a small window on a desktop (no touch screen)', 700, 500, false, true],
    ['a square window', 800, 800, false, false],
  ])('%s: %s', (_name, width, height, coarse, expected) => {
    expect(canSplitScreen(width, height, coarse)).toBe(expected);
  });
});
