import { html } from 'lit';

export const menus = {
  back: 'Back',
  resume: 'Resume',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  controls: 'Controls',
  settings: 'Settings',
  backToLobby: 'Back to lobby',
  again: 'Play again',
  nextGame: 'Next game',
  sound: 'Sound',
  graphics: (level: string) => `Graphics: ${level}`,
  language: (name: string) => `Language: ${name}`,
  touchMode: (mode: string) => `Touch controls: ${mode}`,
  touchLayout: (layout: string) => `Touch layout: ${layout}`,
  graphicsLevels: { high: 'High', low: 'Low' },
  touchModes: { auto: 'Auto gas', simple: 'Simple', classic: 'Classic' },
  touchLayouts: { overlay: 'Over the picture', split: 'Split screen' },
  about: 'About Blacky',
  credits: 'Credits',
  privacy: 'Privacy',
  invite: 'Invite players',
  musicDown: (percent: number) => `Music − (${percent} %)`,
  musicUp: (percent: number) => `Music + (${percent} %)`,
  effectsDown: (percent: number) => `Effects − (${percent} %)`,
  effectsUp: (percent: number) => `Effects + (${percent} %)`,
  paused: 'Paused',
  pausedBy: (name: string) => `${name} paused`,
  defaultHint: html`Choose with <b>Up/Down</b> or <b>Left/Right</b> (stick or d-pad), confirm with <b>✕</b>; on a phone, tap the option`,
  scrollHint: html`Scroll with <b>Up/Down</b> (stick, d-pad or the arrows on a phone), back with <b>✕</b> (phone: <b>OK</b>)`,
  resultsTitle: 'Results',
  draw: 'Draw!',
  wins: (name: string) => `${name} wins!`,
  winTogether: (names: readonly string[], last: string) => `${names.join(', ')} and ${last} win!`,
  scoreLegend: 'Right: points of this game · total',
  controlsLobby: html`<b>Lobby:</b> Up/Down picks the row (stick or d-pad, the arrows on a phone), Left/Right changes the value. <b>✕</b> (phone:
    <b>OK</b>) sets you “Ready”, whatever row you are on; on “Leave” (last row) you give up your seat. At the very top (Up from “Template”) you
    pick your <b>cat’s name</b>: Left/Right switches the name, every name can only be taken once. Everything also works with a mouse or touch:
    tap a seat to join, tap a row, ◀/▶ to change. <b>Select</b> opens the settings (sound, graphics, controls, about Blacky, credits).
    <b>Start</b> or the button “AI opponents” changes the number of AI opponents; once player 1 is ready, they set up the difficulty of each AI
    opponent in turn. The race starts by itself as soon as everybody is ready.`,
};
