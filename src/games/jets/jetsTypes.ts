export const NOT_OUT = -1;

export const ITEM_NONE = 0;
export const ITEM_BOOST = 1;
export const ITEM_SHIELD = 2;
export const ITEM_MISSILE = 3;
export const ITEM_TYPES = 3;

export interface Jet {
  x: number;
  y: number;
  z: number;
  heading: number;
  /** The climb (up positive) the jet has right now in m/s: it follows the stick with some delay. */
  vertical: number;
  hits: number;
  /** Hits this pilot has landed: it breaks a tie in the fewest hits. */
  dealt: number;
  outAt: number;
  invulnerableLeft: number;
  cooldownLeft: number;
  boostLeft: number;
  shieldLeft: number;
  item: number;
  fireHeld: boolean;
  /** The pilot a player who is out is watching (a seat, -1 when nobody is left). */
  watching: number;
  itemHeld: boolean;
}

export interface Shot {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  owner: number;
  lifeLeft: number;
  homing: boolean;
}

export interface Pickup {
  x: number;
  y: number;
  z: number;
  /** The time the box is there again; it is in the air while this lies in the past. */
  backAt: number;
}

export interface JetIntent {
  readonly steer: number;
  readonly climb: number;
  readonly fire: boolean;
  readonly useItem: boolean;
}
