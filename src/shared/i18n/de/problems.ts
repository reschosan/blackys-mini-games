import type { Texts } from '../en';

export const problems: Texts['problems'] = {
  invite: {
    notMyCode: 'Hoppla … das ist nicht der Code vom Mitspieler. Der Mitspieler soll sein Handy mit dem Code zeigen.',
    invitationScanned:
      'Hoppla … das ist ein Einladungs-Code. Er gehört auf das Handy des Mitspielers: dort mit der Kamera-App scannen, nicht hier. Danach zeigt der Mitspieler seinen Code.',
    connectionFailed: 'Hoppla … die Verbindung klappt nicht. Beide Handys im selben WLAN? Ein Gäste-WLAN geht meist nicht.',
    codeFailed: 'Hoppla … der Code konnte nicht erstellt werden. Neuer Versuch mit „Neuer Code“.',
    cameraDenied: 'Hoppla … die Kamera ist nicht erlaubt. Erlaube sie im Browser und wähle „Kamera wechseln“.',
    cameraUnavailable: 'Hoppla … keine Kamera gefunden. Mit „Kamera wechseln“ probierst du die andere.',
    full: 'Hoppla … alle vier Plätze sind besetzt.',
  },
  join: {
    badCode: "Hoppla … dieser Code gehört nicht zu Blacky's Mini Games. Scanne den Code am Handy des Gastgebers noch einmal.",
    connectionFailed: 'Hoppla … die Verbindung klappt nicht. Seid ihr im selben WLAN? Ein Gäste-WLAN geht meist nicht.',
    noWebRtc: 'Hoppla … dein Browser kann keine Verbindung zu einem anderen Handy aufbauen. Nutze einen aktuellen Browser.',
    versionMismatch: 'dieses Handy hat eine andere Version des Spiels als der Gastgeber. Lade die Seite neu. Bis dahin bist du nur Controller.',
    raceUnavailable: 'das Rennen lässt sich auf diesem Handy nicht zeichnen. Du bist in diesem Rennen nur Controller.',
    lobbyUnavailable: 'die Lobby lässt sich auf diesem Handy nicht zeichnen. Der Gastgeber zeigt deine Katze weiter.',
    left: 'Du hast das Spiel verlassen. Scanne den Code am Handy des Gastgebers noch einmal, um wieder mitzuspielen.',
    ended: 'Hoppla … die Verbindung ist beendet. Scanne den Code am Handy des Gastgebers noch einmal.',
  },
  webglTitle: "Hoppla, dein Browser kann Blacky's Mini Games nicht anzeigen",
  webglText:
    "Blacky's Mini Games braucht 3D-Grafik (WebGL). Schalte die Hardwarebeschleunigung ein oder nutze einen aktuellen Browser wie Chrome, Edge, Firefox oder Safari.",
  tryAgain: 'Nochmal versuchen',
  graphicsNapTitle: 'Hoppla, die Grafik macht ein Nickerchen',
  graphicsRecovering: 'Einen Moment, das Spiel versucht sich zu erholen.',
  graphicsLostText: 'Das hat nicht geklappt. Lade die Seite neu, um weiterzuspielen.',
  reloadPage: 'Seite neu laden',
  gameLoopTitle: 'Hoppla, da ist etwas schiefgelaufen',
  gameLoopText: 'Das Spiel musste angehalten werden. Lade die Seite neu, um weiterzuspielen.',
  catModelMissing: 'Hoppla, das Katzenmodell hat sich versteckt. Die Katzen werden vereinfacht angezeigt.',
  audioUnavailable: 'Hoppla, der Ton konnte nicht gestartet werden. Das Spiel läuft ohne Ton weiter.',
  mapModelsMissing: (map) => `Hoppla, die Modelle von ${map} konnten nicht geladen werden. Die Karte wird vereinfacht angezeigt.`,
  graphicsLowered: 'Hoppla, das Spiel ruckelt. Die Grafik wurde auf „Niedrig“ gestellt.',
  graphicsEmergency: 'Hoppla, es ruckelt noch immer. Ein Teil der Umgebung wird nicht mehr gezeichnet.',
};
