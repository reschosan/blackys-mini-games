import { html } from 'lit';
import type { Texts } from '../en';

export const invite: Texts['invite'] = {
  slotStates: { you: 'Du', connected: 'Verbunden', lost: 'Weg', next: 'Dran', free: 'Frei' },
  hint: html`Der Mitspieler scannt den Code mit der Kamera-App und hält danach sein Handy vor die Kamera hier. Wählen mit <b>Hoch/Runter</b>,
    bestätigen mit <b>✕</b> (Handy: Knopf antippen)`,
  done: 'Fertig',
  back: 'Zurück',
  newCode: 'Neuer Code',
  switchCamera: 'Kamera wechseln',
  cameraHint: 'Kamera: hier erscheint der Code des Mitspielers',
  seat: (seat, state) => `Platz ${seat}: ${state}`,
  allSeatsTaken: 'Alle vier Plätze sind besetzt.',
  allBack: 'Alle Mitspieler sind wieder da.',
  connecting: 'Verbinde … einen Moment.',
  scanReturning:
    'Der Mitspieler, der weg war, scannt diesen Code mit der Kamera-App seines Handys (nicht in diesem Spiel). Danach hält er sein Handy mit dem Code vor die Kamera hier.',
  scanNext:
    'Der nächste Mitspieler scannt diesen Code mit der Kamera-App seines Handys (nicht in diesem Spiel). Danach hält er sein Handy mit dem Code vor die Kamera hier.',
  qrLabel: 'QR-Code zum Beitreten',
  makingCode: 'Code wird erstellt …',
};
