import { playerDisplayName } from '../../src/shared/i18n/labels';
import { describe, expect, it } from 'vitest';

describe('playerDisplayName', () => {
  it('shows the chosen name', () => {
    expect(playerDisplayName('Luna', 0)).toBe('Luna');
  });

  it('falls back to "Katze N" of the slot while unnamed or only blanks', () => {
    expect(playerDisplayName('', 0)).toBe('Katze 1');
    expect(playerDisplayName('   ', 2)).toBe('Katze 3');
  });
});
