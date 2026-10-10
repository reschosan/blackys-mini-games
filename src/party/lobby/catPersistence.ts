import { isValidCatAppearance, type CatAppearance } from '../../shared/config/catAppearance';
import { isValidKartLoadout, type KartLoadout } from '../../shared/config/kartLoadout';
import { isPlaneType, type PlaneTypeId } from '../../shared/config/planeTypes';

const STORAGE_PREFIX = 'catkart:cat:';
const KART_STORAGE_PREFIX = 'catkart:kart:';
const PLANE_STORAGE_PREFIX = 'catkart:plane:';

export function loadCatAppearance(sourceKey: string): CatAppearance | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + sourceKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const appearance = { hairLength: 'short', mane: 'none', ...parsed } as CatAppearance;
    return isValidCatAppearance(appearance) ? appearance : null;
  } catch {
    return null;
  }
}

export function saveCatAppearance(sourceKey: string, appearance: CatAppearance): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + sourceKey, JSON.stringify(appearance));
  } catch {
    // localStorage unavailable (private mode, quota exceeded) - customization just won't persist.
  }
}

export function loadKartLoadout(sourceKey: string): KartLoadout | null {
  try {
    const raw = window.localStorage.getItem(KART_STORAGE_PREFIX + sourceKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return isValidKartLoadout(parsed as KartLoadout) ? (parsed as KartLoadout) : null;
  } catch {
    return null;
  }
}

export function saveKartLoadout(sourceKey: string, loadout: KartLoadout): void {
  try {
    window.localStorage.setItem(KART_STORAGE_PREFIX + sourceKey, JSON.stringify(loadout));
  } catch {
    // localStorage unavailable (private mode, quota exceeded) - the kart choice just won't persist.
  }
}

export function loadPlaneType(sourceKey: string): PlaneTypeId | null {
  try {
    const raw = window.localStorage.getItem(PLANE_STORAGE_PREFIX + sourceKey);
    return isPlaneType(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function savePlaneType(sourceKey: string, plane: PlaneTypeId): void {
  try {
    window.localStorage.setItem(PLANE_STORAGE_PREFIX + sourceKey, plane);
  } catch {
    // localStorage unavailable (private mode, quota exceeded) - the plane choice just won't persist.
  }
}
