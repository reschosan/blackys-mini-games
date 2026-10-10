import { PHONE_MAX_SHORT_SIDE_PX } from '../../shared/config/touch';

/** Size classes of the screen the game runs on, from phone (S) to large desktop (XL). The UI itself scales
 *  with the window through the root font size in `ui/style.css`; the class is for layout decisions
 *  (e.g. which parts to show) via the `data-screen-size` attribute. */
export type ScreenSizeClass = 'S' | 'M' | 'L' | 'XL';

/** Classified by the shorter side, so a tablet counts the same held upright or sideways. */
export function screenSizeClassFor(width: number, height: number): ScreenSizeClass {
  const shorterSide = Math.min(width, height);
  if (shorterSide < 600) return 'S';
  if (shorterSide < 800) return 'M';
  if (shorterSide < 1000) return 'L';
  return 'XL';
}

/** Keeps `data-screen-size` on the page root up to date while the window changes. */
export function watchScreenSize(win: Window, root: HTMLElement): void {
  const apply = (): void => {
    root.dataset.screenSize = screenSizeClassFor(win.innerWidth, win.innerHeight);
  };
  apply();
  win.addEventListener('resize', apply);
}

/** A phone: a touch screen whose shorter side is under 10 inch (768 CSS px). Bigger screens play with gamepads. */
export function isPhoneScreen(width: number, height: number, coarsePointer: boolean): boolean {
  return coarsePointer && Math.min(width, height) < PHONE_MAX_SHORT_SIDE_PX;
}
