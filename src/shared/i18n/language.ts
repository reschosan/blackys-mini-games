/** The languages of the game. English is the main language: it is used when the browser speaks none of these. */
export const LANGUAGES = ['en', 'de'] as const;
export type Language = (typeof LANGUAGES)[number];

const FALLBACK_LANGUAGE: Language = 'en';

/** Each language named in itself, so that anybody finds their own. */
export const LANGUAGE_NAMES: Readonly<Record<Language, string>> = { en: 'English', de: 'Deutsch' };

const STORAGE_KEY = 'catkart:language';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** The first browser language the game speaks (`de-AT` counts as `de`), otherwise English. */
export function languageFromBrowser(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLanguage(base)) return base;
  }
  return FALLBACK_LANGUAGE;
}

function savedLanguage(): Language | null {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    return isLanguage(saved) ? saved : null;
  } catch {
    return null;
  }
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

let current: Language = savedLanguage() ?? languageFromBrowser(browserLanguages());
const listeners = new Set<(language: Language) => void>();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export function currentLanguage(): Language {
  return current;
}

/** Switches the language for the whole game and keeps it for the next visit. */
export function setLanguage(language: Language): void {
  if (language === current) return;
  current = language;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, language);
  } catch {
    // Without storage the choice only lasts until the page is closed.
  }
  if (typeof document !== 'undefined') document.documentElement.lang = language;
  for (const listener of listeners) listener(language);
}

/** The next language in the list, round: a button cycles through them. */
export function nextLanguage(language: Language = current): Language {
  return LANGUAGES[(LANGUAGES.indexOf(language) + 1) % LANGUAGES.length]!;
}

/** Called after every switch; returns the function that stops listening. */
export function onLanguageChange(listener: (language: Language) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Runs `make` with the texts of another language, for a guest phone that speaks it; the own language stays as it was. */
export function inLanguage<T>(language: Language, make: () => T): T {
  const own = current;
  current = language;
  try {
    return make();
  } finally {
    current = own;
  }
}
