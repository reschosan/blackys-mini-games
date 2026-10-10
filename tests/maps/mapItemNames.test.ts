import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, MAP_ITEM_TYPES } from '../../src/shared/config/items';
import { AVAILABLE_MAPS } from '../../src/games/kart/maps/registry';
import { FARM } from '../../src/games/kart/maps/farm/map';
import { TOWN } from '../../src/games/kart/maps/town/map';
import { CITY } from '../../src/games/kart/maps/city/map';
import { itemLabelFor } from '../../src/shared/ui/hud';
import { t } from '../../src/shared/i18n';

describe('map items and their names', () => {
  it.each(AVAILABLE_MAPS)('$name offers every map item, each under a name of one word', (map) => {
    expect([...(map.mapItems ?? [])].sort()).toEqual([...MAP_ITEM_TYPES].sort());
    for (const item of ITEM_TYPES) expect(itemLabelFor(item, map), `${map.name}: ${item}`).toMatch(/^[\p{L}]+$/u);
  });

  it.each([FARM, TOWN, CITY])('$name gives every map item a name that is not the default one (except the cow pat on the farm)', (map) => {
    for (const item of MAP_ITEM_TYPES) {
      if (item !== 'cowpat') expect(itemLabelFor(item, map)).not.toBe(t().race.items[item]);
    }
  });

  it('names the cow pat the same on the farm as by default, and differently on the other maps', () => {
    expect(itemLabelFor('cowpat', FARM)).toBe('Kuhfladen');
    expect(itemLabelFor('cowpat', TOWN)).not.toBe('Kuhfladen');
    expect(itemLabelFor('cowpat', CITY)).not.toBe('Kuhfladen');
  });

  it('gives no two items of one map the same name', () => {
    for (const map of AVAILABLE_MAPS) {
      const names = ITEM_TYPES.map((item) => itemLabelFor(item, map));
      expect(new Set(names).size, map.name).toBe(names.length);
    }
  });
});
