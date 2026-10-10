import GUI from 'lil-gui';
import { resetRuntimeAi } from '../../config/ai';
import { resetRuntimeAiDifficulty } from '../../config/aiDifficulty';
import { resetRuntimeAudio } from '../../config/audio';
import { resetRuntimeCamera } from '../../config/camera';
import { resetCatFur } from '../../config/catFur';
import { resetRuntimeDriving } from '../../config/driving';
import { resetRuntimeMenuScroll } from '../../config/input';
import { resetRuntimeItems } from '../../config/items';
import { resetRuntimeKartStats } from '../../config/kartLoadout';
import { resetRuntimeModes } from '../../config/modes';
import { resetRuntimeRace } from '../../config/race';
import { resetRuntimeTouchSteering } from '../../config/touch';
import type { MapConfig } from '../../../games/kart/maps/shared/mapConfig';
import { downloadJson, toJson, type TunableConfigs } from '../configExport';
import { addAiControls, addAiDifficultyControls, addAiTuningControls, type DebugAiControls } from './aiControls';
import { addCameraControls, addDrivingControls, addMenuScrollControls, addRaceControls, addTouchSteeringControls } from './drivingControls';
import { addItemControls } from './itemControls';
import { addModeControls } from './modeControls';
import { addAudioControls, addCatFurControls, addGraphicsControls, addKartStatsControls } from './lookControls';
import { addMapRouteControls } from './routeControls';

const TOGGLE_KEY = 'F1';

export class DebugPanel {
  private readonly gui = new GUI({ title: 'Cat Kart — Debug' });
  private readonly fpsReadout = { fps: 0 };
  private visible = true;
  private frameCount = 0;
  private elapsedSeconds = 0;
  private mapControls: GUI | null = null;
  private boostControls: GUI | null = null;

  constructor(
    private readonly configs: TunableConfigs,
    ai: DebugAiControls,
  ) {
    this.gui.add(this.fpsReadout, 'fps').name('FPS').disable().listen();
    this.addConfigActions();
    addRaceControls(this.gui, configs.race);
    addDrivingControls(this.gui, configs.driving);
    addCameraControls(this.gui, configs.camera);
    addTouchSteeringControls(this.gui, configs.touchSteering);
    addMenuScrollControls(this.gui, configs.menuScroll);
    addAiTuningControls(this.gui, configs.ai);
    addAiDifficultyControls(this.gui, configs.aiDifficulty);
    addAiControls(this.gui, ai);
    addItemControls(this.gui, configs.items);
    addModeControls(this.gui, configs.modes);
    addKartStatsControls(this.gui, configs.kartStats);
    addAudioControls(this.gui, configs.audio);
    addGraphicsControls(this.gui, configs.graphics, ai.onGraphicsTuned);
    addCatFurControls(this.gui);
    window.addEventListener('keydown', this.onKeyDown);
  }

  trackFrame(frameSeconds: number): void {
    this.frameCount += 1;
    this.elapsedSeconds += frameSeconds;
    if (this.elapsedSeconds < 0.5) return;
    this.fpsReadout.fps = Math.round(this.frameCount / this.elapsedSeconds);
    this.frameCount = 0;
    this.elapsedSeconds = 0;
  }

  setMap(map: MapConfig, refreshView: () => void = () => {}): void {
    this.addBoostFieldControls(map);
    this.mapControls?.destroy();
    this.mapControls = null;
    if (!map.routeAi) return;
    const folder = this.gui.addFolder('House course');
    this.mapControls = folder;
    addMapRouteControls(folder, map, refreshView);
    folder.close();
  }

  private addBoostFieldControls(map: MapConfig): void {
    this.boostControls?.destroy();
    this.boostControls = null;
    if (!map.boostFields?.length) return;
    this.boostControls = this.gui.addFolder('Boost fields');
    for (const field of map.boostFields) {
      this.boostControls.add(field, 'durationSeconds', 0.5, 10, 0.5).name(field.id);
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.gui.destroy();
  }

  private addConfigActions(): void {
    const actions = {
      exportJson: () => downloadJson('cat-kart-tuning.json', toJson(this.configs)),
      loadDefaults: () => {
        resetRuntimeDriving(this.configs.driving);
        resetRuntimeCamera(this.configs.camera);
        resetRuntimeRace(this.configs.race);
        resetRuntimeTouchSteering(this.configs.touchSteering);
        resetRuntimeMenuScroll(this.configs.menuScroll);
        resetRuntimeAi(this.configs.ai);
        resetRuntimeAiDifficulty(this.configs.aiDifficulty);
        resetRuntimeItems(this.configs.items);
        resetRuntimeKartStats(this.configs.kartStats);
        resetRuntimeModes(this.configs.modes);
        resetRuntimeAudio(this.configs.audio);
        resetCatFur();
        this.mapControls?.reset();
        this.boostControls?.reset();
        this.refreshControllers();
      },
    };
    this.gui.add(actions, 'exportJson').name('Export values as JSON');
    this.gui.add(actions, 'loadDefaults').name('Load defaults');
  }

  refreshControllers(): void {
    this.gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== TOGGLE_KEY) return;
    event.preventDefault();
    this.visible = !this.visible;
    this.gui.show(this.visible);
  };
}
