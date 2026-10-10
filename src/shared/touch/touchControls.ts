import { isHorizontalStickMode, TOUCH_STICK_GRAB_TOLERANCE_PX, TOUCH_STICK_RADIUS_PX, type TouchControlMode, type TouchLayout } from '../config/touch';
import type { TouchGame } from '../game/gameCard';
import type { TouchButton, TouchSource } from '../input/touch/touchSource';
import type { CTouchButton } from '../ui/components/cTouchButton';
import { clampToUnitCircle } from './joystick';
import { t } from '../i18n';

function required<T extends Element>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`touch controls markup incomplete: ${selector}`);
  return found;
}

export interface TouchControlsState {
  /** Someone plays with the on-screen controls. */
  readonly active: boolean;
  /** Racing shows stick and driving buttons; every other screen the cross. */
  readonly racing: boolean;
  readonly mode: TouchControlMode;
  readonly layout: TouchLayout;
  /** Colour of the touch player's cat, used for the stick knob. */
  readonly playerColor: string;
  /** A page that fills the screen and has buttons of its own (the invitation page, the result page) hides the cross and docks nothing. */
  readonly crossHidden?: boolean;
  /** A game outside the kart engine: the stick is free in every direction and its buttons are named like this. */
  readonly touchGame?: TouchGame;
  /** A kart game where the item button does something else (the shove of Sumo). */
  readonly itemLabel?: string;
  /** Where the controls sit regardless of the screen size (the guest page always has its own half). */
  readonly dock?: 'overlay' | 'split';
}

/** How far a finger must slide sideways on the picture before the camera turns. */
const LOOK_SWIPE_PX = 14;

const KEY_SELECTORS: readonly (readonly [selector: string, button: TouchButton])[] = [
  ['#pad-up', 'up'],
  ['#pad-down', 'down'],
  ['#pad-left', 'left'],
  ['#pad-right', 'right'],
  ['#pad-ok', 'confirm'],
  ['#btn-menu', 'settings'],
  ['#btn-pause', 'pause'],
  ['#btn-gas', 'gas'],
  ['#btn-brake', 'brake'],
  ['#btn-drift', 'drift'],
  ['#btn-item', 'useItem'],
];

/** The on-screen controls: a cross for the lobby and menus, a stick with driving buttons for the race. They only
 *  press keys of the `TouchSource`; the game reads them like any other device. The keys and the stick are drawn by
 *  components after this constructor ran, so every touch is routed from the root instead of bound to each key. */
/** A swipe on the picture of the game turns the view; one on the on-screen controls does not. */
function isOnGamePicture(target: Element | null): boolean {
  return target?.closest('#game-area') != null && target.closest('#touch-controls') === null;
}

export class TouchControls {
  private readonly ui;
  private lastRacing: boolean | null = null;
  private horizontalStick = true;
  private readonly keyFingers = new Map<number, TouchButton>();
  private stickFinger: number | null = null;
  /** A finger swiping on the picture turns the camera (games where the player looks around). */
  private lookFinger: { id: number; startX: number } | null = null;
  private lookEnabled = false;
  private pickEnabled = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly source: TouchSource,
  ) {
    this.ui = {
      navigation: required<HTMLElement>(root, '#touch-navigation'),
      driving: required<HTMLElement>(root, '#touch-driving'),
      gas: required<CTouchButton>(root, '#btn-gas'),
      brake: required<CTouchButton>(root, '#btn-brake'),
      drift: required<CTouchButton>(root, '#btn-drift'),
      item: required<CTouchButton>(root, '#btn-item'),
      menu: root.querySelector<CTouchButton>('#btn-menu'),
    };
    root.addEventListener('pointerdown', this.onPointerDown);
    root.addEventListener('pointermove', this.onPointerMove);
    root.addEventListener('click', this.onClick);
    window.addEventListener('pointerdown', this.onLookDown);
    window.addEventListener('pointerdown', this.onPickDown);
    window.addEventListener('pointermove', this.onLookMove);
    for (const type of ['pointerup', 'pointercancel'] as const) window.addEventListener(type, this.onPointerEnd);
    this.bindFocusSafety();
  }

  update(state: TouchControlsState): void {
    const { ui } = this;
    this.root.hidden = !state.active;
    document.documentElement.dataset.touch = state.active ? 'on' : 'off';
    const app = this.root.parentElement;
    if (app) app.dataset.touchDock = this.dockFor(state);
    document.body.style.setProperty('--player-color', state.playerColor);
    if (this.lastRacing !== state.racing) this.releaseAll();
    this.lastRacing = state.racing;
    ui.navigation.hidden = state.racing || state.crossHidden === true;
    ui.driving.hidden = !state.racing;
    this.applyMode(state.mode, state.itemLabel ?? t().controls.actions.useItem.cap);
    this.lookEnabled = state.racing && state.touchGame?.looksAround === true;
    this.pickEnabled = state.active && state.racing;
    if (!this.lookEnabled) this.releaseLook();
    if (state.touchGame) this.applyGameAction(state.touchGame);
  }

  private applyGameAction(game: TouchGame): void {
    const { ui } = this;
    this.horizontalStick = false;
    ui.gas.hidden = true;
    ui.brake.hidden = true;
    ui.item.hidden = game.secondActionLabel === undefined;
    ui.item.label = game.secondActionLabel ?? t().controls.actions.useItem.cap;
    ui.drift.label = game.actionLabel;
    ui.drift.size = 'l';
  }

  /** A phone keeps lobby and menus above their own cross (it would cover the rows otherwise). On a bigger screen the rows are big enough to tap,
   *  so only the menu button floats over the picture; in the race the setting decides. */
  private dockFor(state: TouchControlsState): 'overlay' | 'split' {
    if (state.dock) return state.dock;
    if (state.crossHidden) return 'overlay';
    if (state.racing) return state.layout === 'overlay' ? 'overlay' : 'split';
    return document.documentElement.dataset.screenSize === 'S' ? 'split' : 'overlay';
  }

  /** Gas only exists in the classic mode, the brake in classic and auto-gas. */
  private applyMode(mode: TouchControlMode, itemLabel: string): void {
    const { ui } = this;
    ui.gas.hidden = mode !== 'classic';
    ui.brake.hidden = mode === 'simple';
    ui.brake.size = mode === 'auto' ? 'l' : 'm';
    ui.item.hidden = false;
    ui.item.label = itemLabel;
    ui.gas.label = t().controls.actions.accelerate.cap;
    ui.menu?.setAttribute('aria', t().controls.menuButton);
    ui.brake.label = t().controls.actions.brake.cap;
    ui.drift.label = t().controls.actions.drift.cap;
    ui.drift.size = mode === 'classic' ? 'm' : 'l';
    this.horizontalStick = isHorizontalStickMode(mode);
  }

  private keyOf(target: EventTarget | null): TouchButton | null {
    if (!(target instanceof Element)) return null;
    const match = KEY_SELECTORS.find(([selector]) => target.closest(selector) !== null);
    return match?.[1] ?? null;
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    const target = event.target as Element | null;
    if (target?.closest('#stick-zone')) {
      this.grabStick(event);
      return;
    }
    const button = this.keyOf(target);
    if (!button || target?.closest('button')?.disabled) return;
    event.preventDefault();
    this.keyFingers.set(event.pointerId, button);
    this.source.setHeld(button, true);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId === this.stickFinger) this.moveStick(event.clientX, event.clientY);
  };

  /** Lifting a finger lets go of what it held, wherever it lifts: the key may be hidden or replaced by then. */
  private readonly onPointerEnd = (event: PointerEvent): void => {
    const button = this.keyFingers.get(event.pointerId);
    if (button) {
      this.keyFingers.delete(event.pointerId);
      this.source.setHeld(button, false);
    }
    if (event.pointerId === this.stickFinger) this.releaseStick();
    if (event.pointerId === this.lookFinger?.id) this.releaseLook();
  };

  private readonly onLookDown = (event: PointerEvent): void => {
    if (!this.lookEnabled || this.lookFinger || !isOnGamePicture(event.target as Element | null)) return;
    this.lookFinger = { id: event.pointerId, startX: event.clientX };
  };

  /** A finger on something of the game marked as tappable (a memory card) picks it directly. */
  private readonly onPickDown = (event: PointerEvent): void => {
    const target = event.target as Element | null;
    const pickable = this.pickEnabled ? target?.closest<HTMLElement>('[data-pick-index]') : null;
    if (pickable) this.source.pick(Number(pickable.dataset.pickIndex));
  };

  private readonly onLookMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.lookFinger?.id) return;
    const swipe = event.clientX - this.lookFinger.startX;
    this.source.setHeld('lookLeft', swipe < -LOOK_SWIPE_PX);
    this.source.setHeld('lookRight', swipe > LOOK_SWIPE_PX);
  };

  private releaseLook(): void {
    if (!this.lookFinger) return;
    this.lookFinger = null;
    this.source.setHeld('lookLeft', false);
    this.source.setHeld('lookRight', false);
  }

  /** A keyboard activating a focused key (Enter, Space) arrives as a click without a pointer. */
  private readonly onClick = (event: MouseEvent): void => {
    const button = event.detail === 0 ? this.keyOf(event.target) : null;
    if (!button) return;
    this.source.setHeld(button, true);
    this.source.setHeld(button, false);
  };

  private stickElements(): { zone: HTMLElement; base: HTMLElement; knob: HTMLElement; line: HTMLElement } | null {
    const zone = this.root.querySelector<HTMLElement>('#stick-zone');
    const base = this.root.querySelector<HTMLElement>('#stick-base');
    const knob = this.root.querySelector<HTMLElement>('#stick-knob');
    const line = this.root.querySelector<HTMLElement>('#stick-line');
    return zone && base && knob && line ? { zone, base, knob, line } : null;
  }

  private showKnob(knobX: number, knobY: number): void {
    const stick = this.stickElements();
    if (!stick) return;
    stick.knob.style.transform = `translate(${knobX}px, ${knobY}px)`;
    stick.line.style.width = `${Math.hypot(knobX, knobY)}px`;
    stick.line.style.transform = `rotate(${Math.atan2(knobY, knobX)}rad)`;
  }

  /** The touch stick grabs a finger that lands on it and follows it until that finger lifts or the browser takes it away. */
  private grabStick(event: PointerEvent): void {
    const stick = this.stickElements();
    if (!stick || this.stickFinger !== null) return;
    const rect = stick.base.getBoundingClientRect();
    const distance = Math.hypot(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2));
    if (distance > TOUCH_STICK_RADIUS_PX + TOUCH_STICK_GRAB_TOLERANCE_PX) return;
    stick.zone.setPointerCapture(event.pointerId);
    stick.zone.addEventListener('lostpointercapture', this.onStickCaptureLost, { once: true });
    this.stickFinger = event.pointerId;
    this.moveStick(event.clientX, event.clientY);
  }

  /** The browser took the stick finger away: the stick lets go. */
  private readonly onStickCaptureLost = (event: PointerEvent): void => {
    if (event.pointerId === this.stickFinger) this.releaseStick();
  };

  private moveStick(clientX: number, clientY: number): void {
    const base = this.stickElements()?.base;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const clamped = clampToUnitCircle(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2), TOUCH_STICK_RADIUS_PX);
    const stick = this.horizontalStick ? { x: clamped.x, y: 0 } : clamped;
    this.source.setStick(stick);
    this.showKnob(stick.x * TOUCH_STICK_RADIUS_PX, stick.y * TOUCH_STICK_RADIUS_PX);
  }

  private releaseStick(): void {
    this.stickFinger = null;
    this.source.setStick({ x: 0, y: 0 });
    this.showKnob(0, 0);
  }

  private releaseAll(): void {
    this.keyFingers.clear();
    this.stickFinger = null;
    this.lookFinger = null;
    this.source.releaseAll();
    this.showKnob(0, 0);
  }

  /** Leaving the page (home button, app switch, locking the phone) lets go of everything: the fingers' "up" events are lost on the way. */
  private bindFocusSafety(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.releaseAll();
    });
    window.addEventListener('pagehide', () => this.releaseAll());
    window.addEventListener('blur', () => this.releaseAll());
    // A finger the browser took away (an edge swipe, a notification, a palm) can end without a "pointerup" for the key or the stick:
    // once no finger is on the screen any more, nothing may stay held.
    for (const type of ['touchend', 'touchcancel'] as const) {
      window.addEventListener(type, (event) => {
        if (event.touches.length === 0 && this.source.isHeld()) this.releaseAll();
      });
    }
  }
}
