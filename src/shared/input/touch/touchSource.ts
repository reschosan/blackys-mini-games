import { STICK_DEADZONE } from '../../config/input';
import { type TouchControlMode, type TouchSteeringConfig } from '../../config/touch';
import { NEUTRAL_INPUT, type InputFrame } from '../actions';
import { kartRelativeFrame, screenRelativeFrame } from './touchSteering';

export interface TouchStick {
  readonly x: number;
  readonly y: number;
}

/** Every on-screen key. Navigation keys move through menus and the lobby, driving keys steer the kart. */
export type TouchButton =
  'up' | 'down' | 'left' | 'right' | 'confirm' | 'settings' | 'drift' | 'useItem' | 'gas' | 'brake' | 'pause' | 'lookLeft' | 'lookRight';

export interface TouchOrientation {
  readonly simpleMode?: 'kartRelative' | 'screenRelative';
  readonly yaw: number;
  readonly forwardSpeed: number;
}

/** The bit each key has in the number a guest phone sends to the host. */
export const TOUCH_BUTTON_BITS: Readonly<Record<TouchButton, number>> = {
  up: 1,
  down: 2,
  left: 4,
  right: 8,
  confirm: 16,
  settings: 32,
  drift: 64,
  useItem: 128,
  gas: 256,
  brake: 512,
  pause: 1024,
  lookLeft: 2048,
  lookRight: 4096,
};

const NO_STICK: TouchStick = { x: 0, y: 0 };

/** The latest tap on the picture. `count` goes up with every tap, so a tap that reaches the host twice counts once. */
export interface TouchPick {
  readonly index: number;
  readonly count: number;
}

export const NO_PICK: TouchPick = { index: -1, count: 0 };
export const MAX_PICK_COUNT = 255;
export const MAX_PICK_INDEX = 63;

export interface TouchSnapshot {
  readonly stick: TouchStick;
  readonly pressedBits: number;
  readonly pick: TouchPick;
}

/**
 * What the on-screen controls currently press. A short tap is remembered until the next read, so the game sees
 * it even if the finger lifts between two simulation steps. One instance per touch player.
 */
export class TouchSource {
  private stick: TouchStick = NO_STICK;
  private readonly held = new Set<TouchButton>();
  private readonly tapped = new Set<TouchButton>();
  private lastPick: TouchPick = NO_PICK;
  /** A tap on the picture the game has not read yet. */
  private unreadPick: number | null = null;

  setStick(stick: TouchStick): void {
    this.stick = stick;
  }

  setHeld(button: TouchButton, pressed: boolean): void {
    if (pressed) {
      this.held.add(button);
      this.tapped.add(button);
    } else {
      this.held.delete(button);
    }
  }

  /** A finger tapped something on the picture (a memory card). */
  pick(index: number): void {
    this.lastPick = { index, count: (this.lastPick.count % MAX_PICK_COUNT) + 1 };
    this.unreadPick = index;
  }

  /** A screen change, a hidden page or a lost finger must not keep what was held before. */
  releaseAll(): void {
    this.stick = NO_STICK;
    this.held.clear();
    this.tapped.clear();
    this.unreadPick = null;
  }

  isDown(button: TouchButton): boolean {
    return this.held.has(button);
  }

  /** Is any key held or the stick off centre right now? */
  isHeld(): boolean {
    return this.held.size > 0 || this.stick.x !== 0 || this.stick.y !== 0;
  }

  /** What to send to the host: the keys held now plus every tap since the last call. */
  takeSnapshot(): TouchSnapshot {
    let pressedBits = 0;
    for (const [button, bit] of Object.entries(TOUCH_BUTTON_BITS) as [TouchButton, number][]) {
      if (this.held.has(button) || this.tapped.has(button)) pressedBits |= bit;
    }
    this.tapped.clear();
    return { stick: this.stick, pressedBits, pick: this.lastPick };
  }

  /** The host copies what a guest phone sent: every key is held or not, and a held key counts as a tap too. */
  applySnapshot(snapshot: TouchSnapshot): void {
    this.stick = snapshot.stick;
    for (const [button, bit] of Object.entries(TOUCH_BUTTON_BITS) as [TouchButton, number][]) {
      this.setHeld(button, (snapshot.pressedBits & bit) !== 0);
    }
    if (snapshot.pick.count !== this.lastPick.count) {
      this.lastPick = snapshot.pick;
      this.unreadPick = snapshot.pick.index;
    }
  }

  /** In menus and the lobby the keys navigate; while racing they drive. */
  readFrame(mode: TouchControlMode, steering: TouchSteeringConfig, orientation: TouchOrientation | undefined): InputFrame {
    const active = (button: TouchButton): boolean => this.held.has(button) || this.tapped.has(button);
    const frame = orientation ? this.drivingFrame(mode, steering, orientation, active) : this.navigationFrame(active);
    this.tapped.clear();
    const pick = this.unreadPick;
    this.unreadPick = null;
    return pick === null ? frame : { ...frame, pick };
  }

  private navigationFrame(active: (button: TouchButton) => boolean): InputFrame {
    return {
      ...NEUTRAL_INPUT,
      steer: Number(active('right')) - Number(active('left')),
      menuUp: active('up'),
      menuDown: active('down'),
      confirm: active('confirm'),
      settings: active('settings'),
      pause: active('pause'),
    };
  }

  private drivingFrame(
    mode: TouchControlMode,
    steering: TouchSteeringConfig,
    orientation: TouchOrientation,
    active: (button: TouchButton) => boolean,
  ): InputFrame {
    const base = {
      ...NEUTRAL_INPUT,
      drift: active('drift'),
      useItem: active('useItem'),
      pause: active('pause'),
      move: this.stick,
      look: Number(active('lookRight')) - Number(active('lookLeft')),
    };
    if (mode === 'simple') {
      const driving =
        orientation.simpleMode === 'kartRelative'
          ? kartRelativeFrame(this.stick.x, this.stick.y, steering)
          : screenRelativeFrame(this.stick.x, this.stick.y, orientation.yaw, orientation.forwardSpeed, steering);
      return { ...base, ...driving };
    }
    const steer = Math.abs(this.stick.x) > STICK_DEADZONE ? this.stick.x : 0;
    const brake = active('brake');
    if (mode === 'auto') return { ...base, steer, brake, accelerate: !brake, autoGas: true };
    return { ...base, steer, brake, accelerate: active('gas') || active('drift') };
  }
}
