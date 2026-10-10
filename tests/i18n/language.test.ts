import { afterEach, describe, expect, it } from 'vitest';
import { t } from '../../src/shared/i18n';
import { currentLanguage, inLanguage, languageFromBrowser, nextLanguage, onLanguageChange, setLanguage } from '../../src/shared/i18n/language';
import { settingsMenuOptions } from '../../src/shared/ui/menus/menuContent';

describe('languages', () => {
  afterEach(() => setLanguage('de'));

  it('takes the first browser language the game speaks, a regional one counts as its language, otherwise English', () => {
    expect(languageFromBrowser(['de-AT', 'en-US'])).toBe('de');
    expect(languageFromBrowser(['fr-FR', 'de'])).toBe('de');
    expect(languageFromBrowser(['fr-FR', 'es'])).toBe('en');
    expect(languageFromBrowser([])).toBe('en');
  });

  it('switches every text at once and tells who listens', () => {
    const heard: string[] = [];
    const stop = onLanguageChange((language) => heard.push(language));
    setLanguage('en');
    expect(currentLanguage()).toBe('en');
    expect(t().menus.back).toBe('Back');
    expect(settingsMenuOptions('high').find((option) => option.id === 'language')!.label).toBe('Language: English');
    setLanguage('de');
    expect(t().menus.back).toBe('Zurück');
    stop();
    expect(heard).toEqual(['en', 'de']);
  });

  it('cycles through the languages for the button', () => {
    expect(nextLanguage('en')).toBe('de');
    expect(nextLanguage('de')).toBe('en');
  });

  it('makes texts in another language for a guest and keeps the own language', () => {
    expect(inLanguage('en', () => t().menus.resume)).toBe('Resume');
    expect(currentLanguage()).toBe('de');
  });
});
