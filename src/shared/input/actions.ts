export interface InputFrame {
  readonly steer: number;
  readonly accelerate: boolean;
  readonly brake: boolean;
  readonly drift: boolean;
  readonly useItem: boolean;
  readonly pause: boolean;
  /** Lobby-only row navigation (gamepad stick/D-Pad, on-screen arrows); drift/useItem still work too. */
  readonly menuUp: boolean;
  readonly menuDown: boolean;
  /** Lobby-only confirm (gamepad accelerate button, on-screen OK). */
  readonly confirm: boolean;
  readonly settings?: boolean;
  /** The kart gives gas by itself (touch auto-gas): accelerate is on from the first second, so it is no press of the player. */
  readonly autoGas?: boolean;
  /** The raw stick (x to the right, y down, both -1 to 1) for games where the cat moves freely instead of driving. */
  readonly move?: { readonly x: number; readonly y: number };
  /** Turning the camera (right stick, a swipe on the picture), -1 left to 1 right, for games where the player looks around. */
  readonly look?: number;
  /** Something the player tapped right on the picture of a touch screen (memory: the index of the card), once per tap. */
  readonly pick?: number;
}

export const NEUTRAL_INPUT: InputFrame = {
  steer: 0,
  accelerate: false,
  brake: false,
  drift: false,
  useItem: false,
  pause: false,
  menuUp: false,
  menuDown: false,
  confirm: false,
  settings: false,
};

/** The main action button of a game outside the kart engine (jump, fire): drift/R or the cross. Gas that a touch screen holds by itself (auto-gas) is no press. */
export function pressesMainAction(frame: InputFrame | undefined): boolean {
  return (frame?.drift ?? false) || ((frame?.accelerate ?? false) && frame?.autoGas !== true);
}
