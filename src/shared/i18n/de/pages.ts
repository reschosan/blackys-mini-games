import { html } from 'lit';
import type { Texts } from '../en';

export const pages: Texts['pages'] = {
  aboutStory: [
    'Blacky ist ein Kater aus der Ukraine. Vermutlich 2021 wurde er auf die Straße gesetzt und von einem örtlichen Tierschutzverein aufgenommen. Später fand er ein neues Zuhause.',
    'In den letzten Jahren kamen einige Herausforderungen dazu. Er kam mit einer Augenverletzung an und wurde gepflegt. Monate später wurde Calici festgestellt, seine Zähne waren von FORL befallen – mittlerweile sind sie alle gezogen. 2025 kam die Diagnose Asthma dazu. Nach Jahren der Behandlung ging es ihm wieder besser. Eine Anfrage für einen Katzenkumpel wurde wegen seiner FIV-Diagnose zunächst abgelehnt. Die Suche geht weiter.',
    'Heute hat er gesicherten Freigang und lebt nach Jahren voller Herausforderungen halbwegs gesund.',
    'Blacky hat Narben in der Seele aus seiner Zeit als Straßenkatze. Er hat Angst vor Hunden, ist extrem eifersüchtig und spielt, sobald er wach ist.',
  ],
  whatIsThat: 'Was ist das eigentlich?',
  illnesses: {
    calici: {
      explanation:
        'Das Feline Calicivirus ist ein ansteckendes Virus und einer der Erreger des Katzenschnupfens. Typisch sind Niesen, Fieber und schmerzhafte Entzündungen im Maul. Bei manchen Katzen bleibt die Infektion dauerhaft bestehen.',
      sourceLabel: 'Cornell College of Veterinary Medicine (englisch)',
    },
    forl: {
      explanation:
        'Bei FORL (Feline Odontoklastische Resorptive Läsionen) lösen körpereigene Zellen die Zahnwurzeln auf. Es betrifft je nach Untersuchung einen großen Teil der Katzen, ist schmerzhaft und schreitet fort. Die Ursache ist unbekannt. Behandelt wird, indem der Zahn gezogen oder die Krone entfernt wird.',
      sourceLabel: 'Fachartikel (VIN, englisch)',
    },
    asthma: {
      explanation:
        'Katzenasthma ist eine allergische Reaktion der Atemwege auf eingeatmete Stoffe. Die Atemwege entzünden sich und verengen sich, die Katze hustet, keucht oder atmet schwer. Heilbar ist es nicht, mit Medikamenten und Beobachtung können viele Katzen aber gut damit leben.',
      sourceLabel: 'Cornell Feline Health Center (englisch)',
    },
    fiv: {
      explanation:
        'FIV (Katzen-Aids) schwächt das Immunsystem und wird vor allem durch Bisse übertragen. Für Menschen ist es ungefährlich. Mit guter Pflege können infizierte Katzen ein normales Alter erreichen. Ein Zusammenleben mit nicht infizierten Katzen kann in einer ruhigen Gruppe funktionieren, das Risiko bleibt aber, wenn sie sich beißen.',
      sourceLabel: 'Cornell Feline Health Center (englisch)',
    },
  },
  source: 'Quelle:',
  noVetAdvice: 'Das ist allgemeine Information und ersetzt keine tierärztliche Beratung.',
  notAPurpose: 'Ein Tier ist kein Zweck',
  notAPurposeText: [
    'Hol dir ein Haustier nie zu einem bestimmten Zweck oder aus einem Impuls. Ein Tier ist ein Teil der Familie, mit allem, was dazugehört, auch wenn es krank wird.',
    'Das ist ein persönliches Projekt. Wenn du überlegst, eine Katze zu adoptieren: Frag in deinem Tierheim oder bei einem Tierschutzverein in deiner Nähe nach.',
  ],
  privacy: [
    {
      heading: null,
      text: 'Dieses Spiel sammelt keine Daten über dich. Es gibt keine Konten, keine Statistik, keine Werbung und keine Cookies. Das Spiel schickt nichts ins Internet.',
    },
    {
      heading: 'Auf deinem Gerät gespeichert',
      text: 'Deine Katze, dein Kart und deine Einstellungen (Ton, Grafik, Steuerung, Ansicht, Sprache) merkt sich der Browser auf deinem Gerät. Das sind keine Personendaten, und sie verlassen dein Gerät nicht. Du löschst sie, indem du in den Browser-Einstellungen die Website-Daten dieser Seite löschst.',
    },
    {
      heading: 'Kamera',
      text: 'Die Kamera wird nur bei „Mitspieler einladen“ gebraucht, um den QR-Code eines Handys zu lesen. Das Bild wird nur auf deinem Gerät ausgewertet und nie gespeichert oder gesendet.',
    },
    {
      heading: 'Mitspieler-Handys',
      text: 'Die Handys verbinden sich direkt miteinander im selben WLAN, ohne Server dazwischen. Dabei tauschen sie ihre Netzwerkadressen und die Eingaben für das Spiel aus. Danach ist nichts davon gespeichert.',
    },
    {
      heading: 'Beim Aufrufen der Seite',
      text: 'Wie bei jeder Website sieht der Anbieter, bei dem das Spiel liegt, deine IP-Adresse und die Uhrzeit des Aufrufs in seinen Protokolldateien. Darauf hat dieses Spiel keinen Einfluss.',
    },
    { heading: 'Links', text: 'Hinter Links auf fremde Seiten (zum Beispiel bei „Über Blacky“ und „Mitwirkende“) gelten deren Datenschutzregeln.' },
  ],
  credits: (cat, link) => html`
    Katzenmodell ${link(cat.sourceUrl, `"${cat.modelName}"`)} von ${link(cat.authorUrl, cat.author)}, lizenziert unter
    ${link(cat.licenseUrl, cat.license)}. Farben, Muster und Proportionen wurden für dieses Spiel angepasst.
    <br /><br />
    Hausmodell ${link('https://poly.pizza/m/9UGOIbCy8C', '"House Interiors"')} von Gabriele Romagnoli, lizenziert unter
    ${link('https://creativecommons.org/licenses/by/3.0/', 'CC-BY')} via Poly Pizza.
    <br /><br />
    Natur-Modelle "Stylized Nature MegaKit" von ${link('https://quaternius.com', 'Quaternius')} via Poly Pizza (CC0). Weltraum-Modelle "Ultimate Space
    Kit" ebenfalls von Quaternius via Poly Pizza (CC0). Bodentexturen von ${link('https://polyhaven.com', 'Rob Tuytel')} via Poly Haven (CC0).
  `,
};
