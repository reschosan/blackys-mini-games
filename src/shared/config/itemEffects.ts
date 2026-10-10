import type { ItemType } from './items';

/** The colour of each item's pickup and use effects, so players can tell them apart at a glance. */
export const ITEM_EFFECT_COLORS: Readonly<Record<ItemType, number>> = {
  hairball: 0xd9b48c,
  trap: 0xf2efe0,
  nap: 0x7fd9ff,
  boost: 0x38e8ff,
  catnip: 0x8effa1,
  laser: 0xff1f2e,
  yarn: 0xff7ad9,
  vacuum: 0x9be7ff,
  gravity: 0xa27bff,
  cowpat: 0x7a5230,
};
