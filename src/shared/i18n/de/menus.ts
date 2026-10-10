import { html } from 'lit';
import type { Texts } from '../en';

export const menus: Texts['menus'] = {
  back: 'Zurück',
  resume: 'Weiter',
  soundOn: 'Ton einschalten',
  soundOff: 'Ton ausschalten',
  controls: 'Steuerung',
  settings: 'Einstellungen',
  backToLobby: 'Zurück zur Lobby',
  again: 'Nochmal',
  nextGame: 'Nächstes Spiel',
  sound: 'Ton',
  graphics: (level) => `Grafik: ${level}`,
  language: (name) => `Sprache: ${name}`,
  touchMode: (mode) => `Touch-Steuerung: ${mode}`,
  touchLayout: (layout) => `Touch-Layout: ${layout}`,
  graphicsLevels: { high: 'Hoch', low: 'Niedrig' },
  touchModes: { auto: 'Auto-Gas', simple: 'Vereinfacht', classic: 'Klassisch' },
  touchLayouts: { overlay: 'Über dem Bild', split: 'Geteilter Bildschirm' },
  about: 'Über Blacky',
  credits: 'Mitwirkende',
  privacy: 'Datenschutz',
  invite: 'Mitspieler einladen',
  musicDown: (percent) => `Musik − (${percent} %)`,
  musicUp: (percent) => `Musik + (${percent} %)`,
  effectsDown: (percent) => `Geräusche − (${percent} %)`,
  effectsUp: (percent) => `Geräusche + (${percent} %)`,
  paused: 'Pausiert',
  pausedBy: (name) => `${name} hat pausiert`,
  defaultHint: html`Wählen mit <b>Hoch/Runter</b> oder <b>Links/Rechts</b> (Stick oder Steuerkreuz), bestätigen mit <b>✕</b>; am Handy tippst du die Option an`,
  scrollHint: html`Scrollen mit <b>Hoch/Runter</b> (Stick, Steuerkreuz oder Pfeile am Handy), zurück mit <b>✕</b> (Handy: <b>OK</b>)`,
  resultsTitle: 'Ergebnis',
  draw: 'Unentschieden!',
  wins: (name) => `${name} gewinnt!`,
  winTogether: (names, last) => `${names.join(', ')} und ${last} gewinnen!`,
  scoreLegend: 'Rechts: Punkte dieses Spiels · Gesamtstand',
  controlsLobby: html`<b>Lobby:</b> Hoch/Runter wählt die Zeile (Stick oder Steuerkreuz, am Handy die Pfeile), Links/Rechts ändert den Wert.
    <b>✕</b> (Handy: <b>OK</b>) setzt dich auf „Bereit“, egal auf welcher Zeile; auf „Ausklinken“ (letzte Zeile) verlässt du den Platz. Ganz
    oben (Hoch von „Vorlage“) wählst du deinen <b>Katzennamen</b>: Links/Rechts wechselt den Namen, jeder Name ist nur einmal vergeben. Alles
    geht auch mit Maus oder Touch: Platz antippen zum Beitreten, Zeile antippen, ◀/▶ zum Ändern. <b>Select</b> öffnet die Einstellungen (Ton,
    Grafik, Steuerung, Über Blacky, Mitwirkende). <b>Start</b> oder der Button „KI-Gegner“ ändert die Anzahl der KI-Gegner; sobald Spieler 1
    bereit ist, richtet er nacheinander die Schwierigkeit jedes KI-Gegners ein. Das Rennen startet automatisch, sobald alle bereit sind.`,
};
