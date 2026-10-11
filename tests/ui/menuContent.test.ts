import { describe, expect, it } from 'vitest';
import type { TemplateResult } from 'lit';
import { controlsDiagramHtml } from '../../src/shared/ui/components/controlsGuideMarkup';
import { CAT_ILLNESSES } from '../../src/shared/config/about';
import { createRuntimeAudio } from '../../src/shared/config/audio';
import {
  pauseOptions,
  scoreLegend,
  aboutBody,
  audioMenuOptions,
  creditsBody,
  privacyBody,
  resultsTitle,
  resultTableRows,
  settingsMenuOptions,
} from '../../src/shared/ui/menus/menuContent';

function valueText(value: unknown): string {
  if (Array.isArray(value)) return value.map(valueText).join('');
  if (typeof value === 'object' && value !== null && 'strings' in value) return templateText(value as TemplateResult);
  return String(value);
}

function templateText(template: TemplateResult): string {
  const values = template.values.map(valueText);
  return template.strings.map((chunk, index) => chunk + (values[index] ?? '')).join('');
}

describe('menu content', () => {
  it('offers the pause options in the intended order', () => {
    expect(pauseOptions({ muted: true }).map((option) => option.id)).toEqual(['resume', 'pauseSound', 'controls', 'settings', 'lobby']);
    expect(pauseOptions({ muted: true })[1]!.label).toBe('Ton einschalten');
    expect(pauseOptions({ muted: false })[1]!.label).toBe('Ton ausschalten');
  });

  it('labels the audio toggle and volumes from the current settings', () => {
    const audio = { ...createRuntimeAudio(), muted: false, musicVolume: 0.4, sfxVolume: 0.8, engineVolume: 0.4 };
    const labels = audioMenuOptions(audio).map((option) => option.label);
    expect(labels[0]).toBe('Ton ausschalten');
    expect(labels).toContain('Musik − (40 %)');
    expect(labels).toContain('Geräusche + (60 %)');
    expect(audioMenuOptions({ ...audio, muted: true })[0]!.label).toBe('Ton einschalten');
  });

  it('draws the gamepad with PSP button names from the input config', () => {
    const html = controlsDiagramHtml();
    expect(html).toContain('Gamepad');
    expect(html).toContain('L · Item');
    expect(html).toContain('R · Drift');
    for (const symbol of ['✕', '○', '□', '△']) expect(html).toContain(symbol);
    expect(html.match(/<svg /g)).toHaveLength(1);
    for (const action of ['Gas', 'Bremse', 'Lenken', 'Drift', 'Item', 'Pause', 'Einstellungen']) expect(html).toContain(action);
  });

  it('offers sound, graphics, controls, about and credits from the settings menu so every device reaches them', () => {
    expect(settingsMenuOptions('high').map((option) => option.id)).toEqual([
      'audio',
      'graphics',
      'language',
      'controls',
      'about',
      'credits',
      'privacy',
      'settingsBack',
    ]);
  });

  it('offers "Mitspieler einladen" only in the lobby, after the info pages, so the first entry stays harmless', () => {
    const ids = settingsMenuOptions('high', null, true).map((option) => option.id);
    expect(ids).toEqual(['audio', 'graphics', 'language', 'controls', 'about', 'credits', 'privacy', 'invite', 'settingsBack']);
    expect(settingsMenuOptions('high').map((option) => option.id)).not.toContain('invite');
  });

  it('offers the touch settings only while the on-screen controls are in use', () => {
    const touch = { mode: 'auto' as const, layout: 'overlay' as const };
    const labels = settingsMenuOptions('high', touch).map((option) => option.label);
    expect(labels).toContain('Touch-Steuerung: Auto-Gas');
    expect(labels).toContain('Touch-Layout: Über dem Bild');
    expect(settingsMenuOptions('high').map((option) => option.id)).not.toContain('touchMode');
  });

  it('shows the current graphics level in its settings entry', () => {
    const label = (quality: 'high' | 'low') => settingsMenuOptions(quality).find((option) => option.id === 'graphics')?.label;
    expect(label('high')).toBe('Grafik: Hoch');
    expect(label('low')).toBe('Grafik: Niedrig');
  });

  it('links the cat model attribution in the credits', () => {
    const text = templateText(creditsBody());
    expect(text).toContain('https://creativecommons.org/licenses/by/3.0/');
    expect(text).toContain('Toon Cat');
  });

  it('shows Blacky’s story without a dedication, photos or a contact address', () => {
    const text = templateText(aboutBody());
    expect(text).toContain('Blacky ist ein Kater aus der Ukraine.');
    expect(text).not.toContain('Ich widme');
    expect(text).not.toContain('Much love');
    expect(text).not.toContain('<c-photo');
    expect(text).not.toContain('mailto:');
  });

  it('tells that the game collects nothing and names storage, camera and phones on the privacy page', () => {
    const text = templateText(privacyBody());
    for (const topic of ['Cookies', 'Kamera', 'Mitspieler-Handys', 'IP-Adresse']) expect(text).toContain(topic);
  });

  it('links a source for every illness on the about page', () => {
    const text = templateText(aboutBody());
    for (const illness of CAT_ILLNESSES) expect(text).toContain(illness.name);
    expect(CAT_ILLNESSES.every((illness) => illness.sourceUrl.startsWith('https://'))).toBe(true);
  });

  it('names the CC0 authors in the credits', () => {
    const text = templateText(creditsBody());
    expect(text).toContain('Quaternius');
    expect(text).toContain('Rob Tuytel');
  });

  it('orders the result rows by place and shows a dash for karts without a finish time', () => {
    const rows = resultTableRows([
      { place: 2, label: 'Blau', color: 0x0000ff, finishTimeSeconds: null, points: 1, total: 4 },
      { place: 1, label: 'Rot', color: 0xff0000, finishTimeSeconds: 65.5, points: 2, total: 7 },
    ]);
    expect(rows).toEqual([
      { place: 1, name: 'Rot', color: '#ff0000', time: '1:05.50', score: '+2 · 7' },
      { place: 2, name: 'Blau', color: '#0000ff', time: '—', score: '+1 · 4' },
    ]);
  });

  it('explains the points column under the result table', () => {
    const text = templateText(scoreLegend());
    expect(text).toContain('Punkte dieses Spiels');
    expect(text).toContain('Gesamtstand');
  });
});

describe('result title', () => {
  it('names the winner of any game instead of a race word', () => {
    expect(
      resultsTitle([
        { place: 2, name: 'Mauzi' },
        { place: 1, name: 'Krümel' },
      ]),
    ).toBe('Krümel gewinnt!');
  });

  it('names every cat on a shared first place', () => {
    expect(
      resultsTitle([
        { place: 1, name: 'Mauzi' },
        { place: 1, name: 'Krümel' },
        { place: 1, name: 'Schnurri' },
        { place: 4, name: 'Mieze' },
      ]),
    ).toBe('Mauzi, Krümel und Schnurri gewinnen!');
  });

  it('calls it a draw when everybody shares the first place', () => {
    expect(
      resultsTitle([
        { place: 1, name: 'Mauzi' },
        { place: 1, name: 'Krümel' },
      ]),
    ).toBe('Unentschieden!');
  });

  it('falls back to a neutral word without a winner', () => {
    expect(resultsTitle([])).toBe('Ergebnis');
  });
});
