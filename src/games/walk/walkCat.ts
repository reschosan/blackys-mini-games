export const NOT_OUT = -1;

export interface WalkCat {
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  facing: number;
  grounded: boolean;
  outAt: number;
  /** The direction this cat's camera looks in (0 looks towards -z); the stick moves relative to it. */
  yaw: number;
  boostLeft: number;
  pawCooldownLeft: number;
  stunLeft: number;
  pawFlashLeft: number;
  jumpHeld: boolean;
  pawHeld: boolean;
  /** The cat a player who is out is watching (a seat, -1 when nobody is left). */
  watching: number;
}

export interface WalkIntent {
  readonly move: { readonly x: number; readonly y: number };
  readonly jump: boolean;
  readonly paw: boolean;
}

/** The stick (right and down are positive) turned into a move over the floor, as seen from a camera looking along `yaw`. */
export function worldMove(stick: { readonly x: number; readonly y: number }, yaw: number): { x: number; y: number } {
  return { x: Math.cos(yaw) * stick.x - Math.sin(yaw) * stick.y, y: Math.sin(yaw) * stick.x + Math.cos(yaw) * stick.y };
}

/** The camera's direction (see `yaw`) that looks the way a cat faces, and a step of `share` (0 to 1) of the way from `yaw` towards it. */
export function yawTowardsFacing(yaw: number, facing: number, share: number): number {
  const delta = Math.atan2(Math.sin(facing + Math.PI / 2 - yaw), Math.cos(facing + Math.PI / 2 - yaw));
  return yaw + delta * Math.min(share, 1);
}
