import type { AiConfig } from '../config/ai';
import type { AiDifficultyTunings } from '../config/aiDifficulty';
import type { AudioConfig } from '../config/audio';
import type { CameraConfig } from '../config/camera';
import type { DrivingConfig } from '../config/driving';
import type { GraphicsConfig } from '../config/graphics';
import type { MenuScrollConfig } from '../config/input';
import type { ItemConfig } from '../config/items';
import type { KartStatsTable } from '../config/kartLoadout';
import type { ModeTuning } from '../config/modes';
import type { RaceConfig } from '../config/race';
import type { TouchSteeringConfig } from '../config/touch';

export interface TunableConfigs {
  readonly driving: DrivingConfig;
  readonly camera: CameraConfig;
  readonly race: RaceConfig;
  readonly touchSteering: TouchSteeringConfig;
  readonly menuScroll: MenuScrollConfig;
  readonly ai: AiConfig;
  readonly aiDifficulty: AiDifficultyTunings;
  readonly items: ItemConfig;
  readonly kartStats: KartStatsTable;
  readonly modes: ModeTuning;
  readonly audio: AudioConfig;
  readonly graphics: GraphicsConfig;
}

export function toJson(configs: TunableConfigs): string {
  return JSON.stringify(
    {
      driving: configs.driving,
      camera: configs.camera,
      race: configs.race,
      touchSteering: configs.touchSteering,
      menuScroll: configs.menuScroll,
      ai: configs.ai,
      aiDifficulty: configs.aiDifficulty,
      items: configs.items,
      kartStats: configs.kartStats,
      modes: configs.modes,
      audio: configs.audio,
      graphics: configs.graphics.presets,
    },
    null,
    2,
  );
}

export function downloadJson(fileName: string, json: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
