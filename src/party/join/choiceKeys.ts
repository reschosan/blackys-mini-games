import { TOUCH_BUTTON_BITS } from '../../shared/input/touch/touchSource';

/** The cross of a guest phone choosing between the entries of a panel: up and down move through them (around the ends), OK confirms the one it is on.
 *  Only a key that was just pressed counts, and only while the panel is shown. */
export class ChoiceKeys {
  private index = 0;
  private previousKeys = 0;

  constructor(
    private readonly count: number,
    private readonly handlers: { moved(): void; confirmed(index: number): void },
  ) {}

  get selected(): number {
    return this.index;
  }

  follow(keys: number, shown: boolean): void {
    const pressedNow = keys & ~this.previousKeys;
    this.previousKeys = keys;
    if (!shown || pressedNow === 0) return;
    if (pressedNow & (TOUCH_BUTTON_BITS.up | TOUCH_BUTTON_BITS.down)) {
      const step = pressedNow & TOUCH_BUTTON_BITS.up ? -1 : 1;
      this.index = (this.index + step + this.count) % this.count;
      this.handlers.moved();
    } else if (pressedNow & TOUCH_BUTTON_BITS.confirm) {
      this.handlers.confirmed(this.index);
    }
  }

  reset(): void {
    this.index = 0;
  }
}
