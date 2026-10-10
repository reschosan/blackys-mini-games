import type { ModeTuning } from '../../../shared/config/modes';
import { AVAILABLE_MAPS } from '../maps/registry';
import type { MapConfig } from '../maps/shared/mapConfig';
import { createArenaMap } from './arena/arenaMaps';
import type { KartMode } from './kartModes';

/** The ground a game is played on: its own arena, or the race map at `mapIndex` of the vote. */
export function mapOfGame(mode: KartMode, mapIndex: number, tuning: ModeTuning): MapConfig | undefined {
  return mode.arena ? createArenaMap(mode.arena, tuning) : AVAILABLE_MAPS[mapIndex];
}
