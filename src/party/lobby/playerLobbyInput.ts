import type { InputFrame } from '../../shared/input/actions';

export interface LobbyCommand {
  readonly valueDelta: -1 | 0 | 1;
  readonly rowDelta: -1 | 0 | 1;
  readonly confirm: boolean;
}

/**
 * Per-player edge-detected controls for the lobby customization list: steer changes the
 * selected row's value, menuUp/menuDown (gamepad stick/D-Pad, on-screen arrows) step to the
 * previous/next row, drift/useItem do the same as a secondary way, confirm (gamepad
 * accelerate button, on-screen OK) toggles ready independently of the selected row.
 * Each joined player gets their own instance so multiple players can customize at once.
 */
export class PlayerLobbyInput {
  // Start "held" so the very first read (right after joining, often on the same physical
  // button press as the join itself) can't fire an edge by accident.
  private steerHeld = true;
  private menuUpHeld = true;
  private menuDownHeld = true;
  private driftHeld = true;
  private itemHeld = true;
  private confirmHeld = true;

  /** Treats every control as held, so a press that is still down (e.g. the confirm that just left the
   *  map vote) cannot fire an edge until it was released once. */
  holdUntilRelease(): void {
    this.steerHeld = true;
    this.menuUpHeld = true;
    this.menuDownHeld = true;
    this.driftHeld = true;
    this.itemHeld = true;
    this.confirmHeld = true;
  }

  allowInitialSteer(): void {
    this.steerHeld = false;
  }

  read(frame: InputFrame): LobbyCommand {
    const valueDelta: -1 | 0 | 1 = isEdge(frame.steer !== 0, this.steerHeld) ? (Math.sign(frame.steer) as -1 | 1) : 0;
    const rowDelta = this.rowDeltaOf(frame);
    const confirm = isEdge(frame.confirm, this.confirmHeld);

    this.steerHeld = frame.steer !== 0;
    this.menuUpHeld = frame.menuUp;
    this.menuDownHeld = frame.menuDown;
    this.driftHeld = frame.drift;
    this.itemHeld = frame.useItem;
    this.confirmHeld = frame.confirm;

    return { valueDelta, rowDelta, confirm };
  }

  private rowDeltaOf(frame: InputFrame): -1 | 0 | 1 {
    if (isEdge(frame.menuDown, this.menuDownHeld) || isEdge(frame.drift, this.driftHeld)) return 1;
    if (isEdge(frame.menuUp, this.menuUpHeld) || isEdge(frame.useItem, this.itemHeld)) return -1;
    return 0;
  }
}

function isEdge(pressed: boolean, held: boolean): boolean {
  return pressed && !held;
}
