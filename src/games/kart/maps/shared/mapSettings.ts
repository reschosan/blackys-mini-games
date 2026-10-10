import type { ItemOverrides, ItemType } from '../../../../shared/config/items';
import type { MapItemLooks } from '../../../../shared/config/itemLooks';
import type { SurfaceKind } from '../../../../shared/config/surfaces';
import { DEFAULT_RACE } from '../../../../shared/config/race';
import type { ItemBoxLook, MapLighting, OffroadSettings, ShoulderSettings, MapConfig } from './mapConfig';
import { DEFAULT_ITEM_BOX_LOOK } from './mapDefaults';

export type PlacementItem = ItemType | 'random';

interface PlacementPosition {
  readonly level: number;
  readonly meter: number;
  readonly lateralMeters?: number;
}

interface JumpSettings {
  readonly width?: number;
  readonly rampLength?: number;
  readonly rampHeight?: number;
  readonly minimumSpeed?: number;
  readonly durationSeconds?: number;
  readonly peakHeight?: number;
  readonly referenceSpeed?: number;
}

export type MapPlacement = PlacementPosition &
  (
    | { readonly type: 'boostField'; readonly id: string; readonly width?: number; readonly length?: number; readonly durationSeconds?: number }
    | { readonly type: 'surfaceZone'; readonly kind: SurfaceKind; readonly length: number; readonly width?: number }
    | { readonly type: 'itemBoxes'; readonly items: readonly PlacementItem[]; readonly spacingMeters?: number }
    | { readonly type: 'jump'; readonly id: string; readonly jump?: JumpSettings }
    | { readonly type: 'itemJump'; readonly id: string; readonly item: PlacementItem; readonly jump?: JumpSettings }
  );

export const DEFAULT_PLACEMENT_JUMP = {
  width: 3,
  rampLength: 4,
  rampHeight: 0.65,
  minimumSpeed: 12,
  durationSeconds: 0.8,
  peakHeight: 3,
  referenceSpeed: 18,
  airControlPerSecond: 2,
  penaltySeconds: 1.5,
  landingWidth: 16,
  landingMargin: 4,
  boostSeconds: 3,
  boxSpacingMeters: 3,
} as const;

export const DEFAULT_PLACEMENT_BOOST = { width: 3, length: 2, durationSeconds: 4 } as const;

export interface MapSettings {
  readonly name: string;
  readonly lapCount?: number;
  readonly placements: readonly MapPlacement[];
  readonly items?: ItemOverrides;
  readonly mapItems?: readonly ItemType[];
  readonly itemNames?: Readonly<Partial<Record<ItemType, string>>>;
  readonly itemLooks?: MapItemLooks;
  readonly itemBox?: Partial<ItemBoxLook>;
  readonly offroad?: OffroadSettings;
  readonly shoulder?: ShoulderSettings;
  readonly aiPaceFactors?: Readonly<Record<'easy' | 'medium' | 'hard', number>>;
  readonly aiOffCourseMeters?: number;
  readonly skyColor?: number;
  readonly lighting?: MapLighting;
}

export type ConfigFieldsFromSettings = Pick<MapConfig, 'name' | 'lapCount' | 'itemBoxLook'> &
  Partial<
    Pick<
      MapConfig,
      'itemOverrides' | 'mapItems' | 'itemNames' | 'itemLooks' | 'offroad' | 'shoulder' | 'aiPaceFactors' | 'aiOffCourseMeters' | 'skyColor' | 'lighting'
    >
  >;

const CARRIED_FIELDS = ['mapItems', 'itemNames', 'itemLooks', 'offroad', 'shoulder', 'aiPaceFactors', 'aiOffCourseMeters', 'skyColor', 'lighting'] as const;

/** Central defaults filled in, only the values a map actually sets are carried over. */
export function configFieldsFromSettings(map: MapSettings): ConfigFieldsFromSettings {
  const carried = Object.fromEntries(CARRIED_FIELDS.filter((field) => map[field] !== undefined).map((field) => [field, map[field]]));
  return {
    name: map.name,
    lapCount: map.lapCount ?? DEFAULT_RACE.lapCount,
    itemBoxLook: { ...DEFAULT_ITEM_BOX_LOOK, ...map.itemBox },
    ...(map.items ? { itemOverrides: map.items } : {}),
    ...carried,
  };
}
