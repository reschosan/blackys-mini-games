import { createRuntimeAi } from '../../../shared/config/ai';
import { createRuntimeAiDifficulty } from '../../../shared/config/aiDifficulty';
import { createRuntimeAudio } from '../../../shared/config/audio';
import { createRuntimeCamera } from '../../../shared/config/camera';
import { createRuntimeDriving } from '../../../shared/config/driving';
import { createRuntimeGraphics } from '../../../shared/config/graphics';
import { createRuntimeMenuScroll } from '../../../shared/config/input';
import { createRuntimeItems } from '../../../shared/config/items';
import { createRuntimeModes } from '../../../shared/config/modes';
import { createRuntimeKartStats } from '../../../shared/config/kartLoadout';
import { createRuntimeRace } from '../../../shared/config/race';
import { createRuntimeTouchSettings, createRuntimeTouchSteering } from '../../../shared/config/touch';
import type { MapConfig } from '../../../games/kart/maps/shared/mapConfig';
import { loadAudioSettings } from '../../../shared/ui/menus/audioPersistence';
import { loadGraphicsSettings } from '../../../shared/ui/menus/graphicsPersistence';
import { loadTouchSettings } from '../../../shared/ui/menus/touchPersistence';

/** The runtime copies of all tunable values: the debug panel changes them live, saved settings are loaded over the defaults. */
export function createGameConfigs(firstMap: MapConfig) {
  return {
    driving: createRuntimeDriving(),
    ai: createRuntimeAi(),
    aiDifficulty: createRuntimeAiDifficulty(),
    items: createRuntimeItems(firstMap.itemOverrides),
    kartStats: createRuntimeKartStats(),
    modes: createRuntimeModes(),
    race: createRuntimeRace(),
    audio: loadAudioSettings(createRuntimeAudio()),
    graphics: loadGraphicsSettings(createRuntimeGraphics()),
    camera: createRuntimeCamera(),
    touchSteering: createRuntimeTouchSteering(),
    touchSettings: loadTouchSettings(createRuntimeTouchSettings()),
    menuScroll: createRuntimeMenuScroll(),
  };
}
