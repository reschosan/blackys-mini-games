import { catNameId, isCatNameId } from '../config/catNames';
import type { GraphicsQuality } from '../config/graphics';
import type { StatBar } from '../config/kartLoadout';
import { DEFAULT_MEMORY_LEVEL, MEMORY_LEVELS } from '../config/memoryLevels';
import type { PlaneTypeId } from '../config/planeTypes';
import type { TouchControlMode, TouchLayout } from '../config/touch';
import { t } from './index';

/** The words for values of the config, in the language being shown: the config itself stays plain data. */

export function graphicsQualityLabel(quality: GraphicsQuality): string {
  return t().menus.graphicsLevels[quality];
}

export function touchControlModeLabel(mode: TouchControlMode): string {
  return t().menus.touchModes[mode];
}

export function touchLayoutLabel(layout: TouchLayout): string {
  return t().menus.touchLayouts[layout];
}

export function memoryLevelLabel(level: number): string {
  return t().lobby.memoryPairs(MEMORY_LEVELS[level] ?? MEMORY_LEVELS[DEFAULT_MEMORY_LEVEL]!);
}

/** Short names for the lobby rows and the small screens. */
export function planeLabel(plane: PlaneTypeId): string {
  return t().lobby.planes[plane];
}

/** A cat's name as the screen shows it ('' stays empty). */
export function catNameLabel(name: string): string {
  const id = catNameId(name.trim());
  return isCatNameId(id) ? t().cats.names[id] : id;
}

/** What a player is called on screen: the name they chose, or "Cat N" of their seat while unnamed. */
export function playerDisplayName(name: string, slotIndex: number): string {
  return catNameLabel(name) || t().lobby.cat(slotIndex + 1);
}

/** The driving values of a loadout with their names, for the lobby bars. */
export function labelledStatBars(bars: readonly StatBar[]): readonly { readonly label: string; readonly ratio: number }[] {
  return bars.map((bar) => ({ label: t().lobby.stats[bar.id], ratio: bar.ratio }));
}
