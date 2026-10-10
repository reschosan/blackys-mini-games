/** How the map items look. The effect of an item is the same on every map; a map may dress it up (a ball of yarn is a hay bale
 *  on the farm and a cannonball in the town). Only looks live here, nothing that changes how an item plays. */

export type YarnShape = 'knot' | 'bale' | 'cannonball' | 'cable';
export type VacuumStyle = 'rings' | 'swirl' | 'stripes';
type GravityStyle = 'bubble' | 'swarm' | 'runes' | 'forcefield';
type CowpatStyle = 'heap' | 'droppings' | 'oil';

/** `ownerTint`: how much of the colour of the player who threw it shows (1: only the owner's colour, as the ball of yarn always did). */
interface YarnLook {
  readonly shape: YarnShape;
  readonly color: number;
  readonly accent: number;
  readonly ownerTint: number;
}
export interface VacuumLook {
  readonly style: VacuumStyle;
  readonly color: number;
  readonly accent: number;
}
export interface GravityLook {
  readonly style: GravityStyle;
  readonly color: number;
  readonly accent: number;
}
export interface CowpatLook {
  readonly style: CowpatStyle;
  readonly color: number;
  readonly accent: number;
}

export interface ItemLooks {
  readonly yarn: YarnLook;
  readonly vacuum: VacuumLook;
  readonly gravity: GravityLook;
  readonly cowpat: CowpatLook;
}

/** What the items looked like before maps could dress them: yarn tinted by its owner, a pale sweep, a violet dome, a brown heap. */
export const DEFAULT_ITEM_LOOKS: Readonly<ItemLooks> = Object.freeze({
  yarn: Object.freeze({ shape: 'knot', color: 0xffffff, accent: 0x000000, ownerTint: 1 }),
  vacuum: Object.freeze({ style: 'rings', color: 0x9be7ff, accent: 0x9be7ff }),
  gravity: Object.freeze({ style: 'bubble', color: 0xa27bff, accent: 0xe2d6ff }),
  cowpat: Object.freeze({ style: 'heap', color: 0x6b4423, accent: 0x6b4423 }),
});

export type MapItemLooks = { readonly [Item in keyof ItemLooks]?: ItemLooks[Item] };

/** The look of one map item on a map: the map's own, or the default. The same object every time, so a view can tell when it changed. */
export function itemLookOf<Item extends keyof ItemLooks>(map: { readonly itemLooks?: MapItemLooks }, item: Item): ItemLooks[Item] {
  return (map.itemLooks?.[item] ?? DEFAULT_ITEM_LOOKS[item]) as ItemLooks[Item];
}
