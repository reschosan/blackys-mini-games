import { isPhoneScreen } from './screenSize';

/** A split screen (one picture per player on this one screen) needs room: landscape and not a phone (a touch screen under 10 inch). */
export function canSplitScreen(width: number, height: number, coarsePointer: boolean): boolean {
  return width > height && !isPhoneScreen(width, height, coarsePointer);
}

/** The same question for the screen the game runs on right now. */
export function thisScreenCanSplit(): boolean {
  return canSplitScreen(window.innerWidth, window.innerHeight, window.matchMedia('(pointer: coarse)').matches);
}
