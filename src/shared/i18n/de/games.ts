import type { Texts } from '../en';

export const games: Texts['games'] = {
  cards: {
    race: {
      title: 'Rennen',
      summary: 'Mehrere Runden mit Items, wer zuerst im Ziel ist, gewinnt.',
      rules: [
        'Fahre die Runden und sei als Erster im Ziel.',
        'Sammle Item-Kisten und setze die Items gegen die anderen ein.',
        'Drift mit R: je länger, desto stärker der Boost beim Loslassen.',
      ],
    },
    timetrial: {
      title: 'Zeitfahren',
      summary: 'Eine Runde ohne Items, die schnellste Zeit gewinnt.',
      rules: [
        'Fahre eine Runde so schnell du kannst, es gibt keine Items.',
        'Die schnellste Zeit gewinnt.',
        'Drift mit R in den Kurven: der Boost spart Zeit.',
      ],
    },
    drift: {
      title: 'Drift-Challenge',
      summary: '60 Sekunden driften, die meisten Punkte gewinnen.',
      rules: [
        'Drifte mit R so lange du kannst: jede Sekunde im Drift bringt Punkte, höhere Stufen mehr.',
        'Die Punkte zählen, sobald du den Drift löst.',
        'Wer gegen eine Wand fährt, verliert die Punkte des laufenden Drifts.',
      ],
    },
    tag: {
      title: 'Fangen',
      summary: 'Ein Fänger jagt die anderen, wer am kürzesten gejagt hat, gewinnt.',
      rules: [
        'Ein Kart ist der Fänger, die anderen laufen davon.',
        'Eine Berührung gibt das Fangen weiter, dann hat der neue Fänger kurz Ruhe.',
        'Nach 60 Sekunden gewinnt, wer am kürzesten Fänger war.',
        'Sammle Item-Kisten: Haarball und Nickerchen helfen dir beim Jagen und Fliehen.',
      ],
    },
    sumo: {
      title: 'Sumo-Karts',
      summary: 'Rammen und Stoßen auf einer schrumpfenden Plattform, die letzte Katze gewinnt.',
      rules: [
        'Schubse die anderen von der runden Plattform.',
        'Stoß mit Quadrat oder L (Handy: Stoß): die Katze vor dir fliegt weg. Danach lädt der Stoß kurz nach.',
        'Nach einer Weile wird die Plattform kleiner.',
        'Wer herunterfällt, ist raus, die letzte Katze gewinnt.',
      ],
    },
    lavakart: {
      title: 'Boden ist Lava (Kart)',
      summary: 'Die Kacheln verschwinden, die letzte Katze auf dem Boden gewinnt.',
      rules: [
        'Der Boden besteht aus Kacheln, die erst glühen und dann verschwinden.',
        'Fahre immer auf eine Kachel, die noch nicht glüht.',
        'Wer in die Lava fällt, ist raus, die letzte Katze gewinnt.',
      ],
    },
    soccer: {
      title: 'Fußball',
      summary: 'Zwei Teams schieben einen Ball ins Tor.',
      rules: [
        'Schiebe den Ball mit dem Kart ins gegnerische Tor.',
        'Gerade Plätze spielen gegen ungerade Plätze, die Teams sind an der Farbe zu erkennen.',
        'Nach 90 Sekunden oder beim dritten Tor gewinnt das Team mit mehr Toren.',
        'Sammle Item-Kisten in der Mitte: ein Haarball setzt einen Gegner kurz außer Gefecht.',
      ],
    },
    memory: {
      title: 'Memory',
      summary: 'Katzen-Paare aufdecken, die meisten Paare gewinnen.',
      rules: [
        'Vor dem Start wählt ihr die Stufe: 5, 7, 10 oder 12 Paare.',
        'Die Katzen sind abwechselnd dran und decken zwei Karten auf: mit ✕, am Handy durch Antippen der Karte.',
        'Passen die beiden zusammen, bleiben sie liegen und du darfst nochmal. Das Goldfisch-Paar zählt drei Punkte.',
        'Wer zu lange braucht, bekommt eine Karte aufgedeckt. Die meisten Punkte gewinnen.',
      ],
    },
    walk: {
      title: 'Boden ist Lava (zu Fuß)',
      summary: 'Über Hügel springen, die Lava steigt: die letzte Katze über der Lava gewinnt.',
      rules: [
        'Lauf mit dem Stick, dreh die Kamera mit dem rechten Stick (am Handy: wischen). Kacheln glühen und fallen weg.',
        'Spring mit ✕ oder R eine Stufe höher. Die Lava steigt Stufe um Stufe: rechtzeitig nach oben!',
        'Hau andere mit Quadrat von der Kante, Fische machen dich kurz schneller. Wer in die Lava fällt, schaut zu (✕ wechselt die Katze).',
      ],
    },
    jets: {
      title: 'Kampfjets',
      summary: 'Fliegen, Item-Kisten sammeln und die anderen abschießen.',
      rules: [
        'Lenke mit dem Stick: links und rechts kurven, hoch steigen, runter sinken.',
        'Schieß mit ✕ oder R. Flieg durch Item-Kisten und nutze das Item mit Quadrat: Boost, Schild oder Rakete.',
        'Wer dreimal getroffen wird, ist raus. Nach zwei Minuten gewinnt, wer die wenigsten Treffer hat. Wer raus ist, schaut zu und wechselt mit ✕.',
      ],
    },
  },
  buttons: { shove: 'Stoß', fire: 'Feuer', item: 'Item', jump: 'Springen', paw: 'Pfotenhieb', flip: 'Umdrehen' },
  arenas: { platform: 'Sumo-Plattform', tiles: 'Lavaboden', walled: 'Fangen-Arena', field: 'Fußballfeld' },
  status: {
    stillIn: (count) => `Noch ${count} dabei`,
    time: (clock) => `Zeit ${clock}`,
    platform: (metres) => `Plattform ${metres} m`,
    tiles: (count) => `${count} Kacheln`,
    lavaRises: (seconds) => `Lava steigt in ${seconds} s`,
    lastCat: 'Letzte Katze',
    lastPilot: 'Letzter Pilot',
    outAfter: (time) => `raus nach ${time}`,
    fellAfter: (time) => `gefallen nach ${time}`,
    seconds: (seconds) => `${seconds} s`,
    in: 'dabei',
    out: 'raus',
    watching: (name) => `raus · schaut ${name}`,
    shoveReady: 'Stoß bereit',
    shoveCharging: 'Stoß lädt …',
    hunter: 'Fänger!',
    asHunter: (seconds) => `${seconds} s als Fänger`,
    points: (points) => `${points} Punkte`,
    streak: (points) => ` (+${points})`,
    yourTurn: ' · dran',
    turnOf: (name) => `${name} ist dran`,
    pairs: (found, total) => `${found}/${total} Paare`,
    teams: ['Rot', 'Blau'],
    team: (name) => `Team ${name}`,
    hits: (hits) => `${hits} Treffer`,
    lives: (lives) => `${lives} Leben`,
    jetItems: ['', 'Boost', 'Schild', 'Rakete'],
  },
  memoryMotifs: ['Goldfisch', 'Wollknäuel', 'Maus', 'Milch', 'Vogel', 'Feder', 'Knochen', 'Pfote', 'Katze', 'Katzengras', 'Glöckchen', 'Körbchen'],
  memoryHidden: 'Karte verdeckt',
};
