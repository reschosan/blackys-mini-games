import { DE } from './de';
import { EN, type Texts } from './en';
import { currentLanguage, type Language } from './language';

export type { Texts } from './en';

const TEXTS: Readonly<Record<Language, Texts>> = { en: EN, de: DE };

/** The texts in the language being shown. Read them while drawing and never keep them: the language can change at any time. */
export function t(): Texts {
  return TEXTS[currentLanguage()];
}

/** A name from the map data (a map, a gate, a map's own item name) in the language being shown; names without a translation stay. */
export function placeName(name: string): string {
  return t().places[name] ?? name;
}
