import { html } from 'lit';

export const invite = {
  slotStates: { you: 'You', connected: 'Connected', lost: 'Gone', next: 'Next', free: 'Free' },
  hint: html`The player scans the code with the camera app and then holds their phone in front of the camera here. Choose with <b>Up/Down</b>,
    confirm with <b>✕</b> (phone: tap the button)`,
  done: 'Done',
  back: 'Back',
  newCode: 'New code',
  switchCamera: 'Switch camera',
  cameraHint: 'Camera: the player’s code appears here',
  seat: (seat: number, state: string) => `Seat ${seat}: ${state}`,
  allSeatsTaken: 'All four seats are taken.',
  allBack: 'All players are back.',
  connecting: 'Connecting … one moment.',
  scanReturning:
    'The player who dropped out scans this code with the camera app of their phone (not in this game). Then they hold their phone with the code in front of the camera here.',
  scanNext:
    'The next player scans this code with the camera app of their phone (not in this game). Then they hold their phone with the code in front of the camera here.',
  qrLabel: 'QR code to join',
  makingCode: 'Making the code …',
};
