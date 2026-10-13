import { NATURE } from './nature';
import { FAMILY_HOUSE } from './familyHouse';
import { SPACE } from './space';
import { FARM } from './farm';
import { TOWN } from './town';
import { CITY } from './city';
import type { MapConfig } from './shared/mapConfig';

export const AVAILABLE_MAPS: readonly MapConfig[] = [NATURE, FAMILY_HOUSE, SPACE, FARM, TOWN, CITY];
