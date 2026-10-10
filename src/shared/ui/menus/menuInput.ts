import type { InputFrame } from '../../input/actions';

export interface MenuCommand {
  readonly move: number;
  readonly confirm: boolean;
  readonly toggle: boolean;
  /** -1 up, 1 down, 0 none; true on every step while held, only on scrollable pages. */
  readonly scroll: number;
}

/** -1 up, 1 down: gamepad stick and D-pad, on-screen arrows, and the drift/item buttons. */
/** On a scrollable page up and down scroll the page; elsewhere they move the selection. */
function selectingDirection(vertical: number, scrollablePage: boolean): number {
  return scrollablePage ? 0 : vertical;
}

function verticalDirection(frames: readonly InputFrame[]): number {
  const down = frames.some((frame) => frame.menuDown || frame.drift);
  const up = frames.some((frame) => frame.menuUp || frame.useItem);
  return Number(down) - Number(up);
}

export class MenuInput {
  private moveHeld = false;
  private confirmHeld = false;
  private toggleHeld = false;

  /** Only the confirm action confirms (gamepad cross, on-screen OK). Up and down move the selection, or scroll on a scrollable page. */
  read(frames: readonly InputFrame[], scrollablePage = false): MenuCommand {
    const steer = frames.reduce((strongest, frame) => (frame.steer !== 0 ? frame.steer : strongest), 0);
    const confirm = frames.some((frame) => frame.confirm);
    const toggle = frames.some((frame) => frame.pause);
    const vertical = verticalDirection(frames);
    const direction = steer !== 0 ? Math.sign(steer) : selectingDirection(vertical, scrollablePage);

    const command: MenuCommand = {
      move: direction !== 0 && !this.moveHeld ? direction : 0,
      confirm: confirm && !this.confirmHeld,
      toggle: toggle && !this.toggleHeld,
      scroll: scrollablePage ? vertical : 0,
    };

    this.moveHeld = direction !== 0;
    this.confirmHeld = confirm;
    this.toggleHeld = toggle;
    return command;
  }

  suppressUntilRelease(): void {
    this.moveHeld = true;
    this.confirmHeld = true;
    this.toggleHeld = true;
  }
}
