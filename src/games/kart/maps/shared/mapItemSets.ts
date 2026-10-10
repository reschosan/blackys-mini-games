import type { ItemType } from '../../../../shared/config/items';

/** Every map offers every map item (a geschoss, a suction cone, a floating zone and a sticky trap), each under a name that fits the map; the effects are the same everywhere. */
export const ALL_MAP_ITEMS: readonly ItemType[] = ['yarn', 'vacuum', 'gravity', 'cowpat'];
