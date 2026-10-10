import type { MapConfig } from '../../../games/kart/maps/shared/mapConfig';

/** A copy of the tunable parts of a route map, so the debug panel changes this race's values and not the shared map data. */
export function editableMap(map: MapConfig): MapConfig {
  if (!map.routeAi) return map;
  return {
    ...map,
    routeAi: { ...map.routeAi },
    ...(map.aiGuideSpacing ? { aiGuideSpacing: { ...map.aiGuideSpacing } } : {}),
    ...(map.routeMarkings ? { routeMarkings: { ...map.routeMarkings } } : {}),
    ...(map.routeBanks ? { routeBanks: { ...map.routeBanks } } : {}),
    ...(map.followCamera ? { followCamera: { ...map.followCamera } } : {}),
    windowJumps: (map.windowJumps ?? []).map((jump) => ({ ...jump })),
  };
}
