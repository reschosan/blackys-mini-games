import { describe, expect, it } from 'vitest';
import { AVAILABLE_MAPS } from '../../src/games/kart/maps/registry';
import { createArenaMap } from '../../src/games/kart/modes/arena/arenaMaps';
import { KART_MODES } from '../../src/games/kart/modes/kartModes';
import { GAMES } from '../../src/party/games';
import { createRuntimeModes } from '../../src/shared/config/modes';
import { EN } from '../../src/shared/i18n/en';
import { inLanguage } from '../../src/shared/i18n/language';

const CREDIT = { modelName: 'Cat', sourceUrl: '', author: 'Author', authorUrl: '', license: 'CC', licenseUrl: '' };
const SAMPLE_ARGUMENTS: readonly (readonly unknown[])[] = [
  ['Mitzi', 2, 3],
  [['Mitzi'], 'Crumbs'],
  [CREDIT, (_url: string, label: string) => label],
];

/** A text function gets sample values of whichever kind it takes. */
function callWithSamples(make: (...args: unknown[]) => unknown): unknown {
  for (const args of SAMPLE_ARGUMENTS) {
    try {
      return make(...args);
    } catch {
      // Not this kind of arguments: try the next.
    }
  }
  throw new Error(`no sample arguments fit ${make.toString()}`);
}

/** Every plain text in a texts tree: strings, lists, the fixed parts of templates and what functions give for sample values. */
function textsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') return textsIn(callWithSamples(value as (...args: unknown[]) => unknown));
  if (Array.isArray(value)) return value.flatMap(textsIn);
  if (typeof value === 'object' && value !== null) {
    if ('strings' in value) return [...(value as { strings: readonly string[] }).strings];
    return Object.values(value).flatMap(textsIn);
  }
  return [];
}

const GERMAN = /[äöüÄÖÜß]|\b(und|der|die|das|mit|nicht|für|wählen|Zurück|Hoppla|Katze|Runde|Spiel)\b/;

describe('the English texts', () => {
  it('hold no German left behind', () => {
    const { places: _places, ...rest } = EN;
    const german = textsIn(rest).filter((text) => GERMAN.test(text));
    expect(german).toEqual([]);
  });

  it('name every map, gate and own item name the maps show', () => {
    const maps = [...AVAILABLE_MAPS, ...(['platform', 'tiles', 'walled', 'field'] as const).map((kind) => createArenaMap(kind, createRuntimeModes()))];
    const shown = maps.flatMap((map) => [
      map.name,
      ...map.checkpoints.flatMap((gate) => (gate.name ? [gate.name] : [])),
      ...Object.values(map.itemNames ?? {}),
    ]);
    const missing = [...new Set(shown)].filter((name) => !(name in EN.places));
    expect(missing).toEqual([]);
  });

  it('give every game its title, summary and rules in both languages', () => {
    for (const language of ['en', 'de'] as const) {
      for (const game of [...GAMES, ...KART_MODES]) {
        const { title, summary, rules } = inLanguage(language, () => ({ title: game.title, summary: game.summary, rules: game.rules }));
        expect(title.length, `${language} ${game.id}`).toBeGreaterThan(0);
        expect(summary.length, `${language} ${game.id}`).toBeGreaterThan(0);
        expect(rules.length, `${language} ${game.id}`).toBeGreaterThan(0);
      }
    }
    expect(inLanguage('en', () => KART_MODES.find((mode) => mode.id === 'sumo')!.title)).toBe('Sumo karts');
  });
});
