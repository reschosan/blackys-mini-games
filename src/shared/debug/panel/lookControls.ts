import { t } from '../../i18n';
import { inLanguage } from '../../i18n/language';
import type GUI from 'lil-gui';
import type { AudioConfig } from '../../config/audio';
import { catFur } from '../../config/catFur';
import { GRAPHICS_QUALITIES } from '../../config/graphics';
import { graphicsQualityLabel } from '../../i18n/labels';
import { KART_TYPES, WHEEL_TYPES, type DriveModifiers, type KartStatsTable } from '../../config/kartLoadout';
import { SURFACE_KINDS } from '../../config/surfaces';
import type { TunableConfigs } from '../configExport';

export function addGraphicsControls(gui: GUI, graphics: TunableConfigs['graphics'], onTuned: () => void): void {
  const folder = gui.addFolder('Graphics presets (Lobby Graphics button)');
  for (const quality of GRAPHICS_QUALITIES) {
    const preset = graphics.presets[quality];
    const level = folder.addFolder(inLanguage('en', () => graphicsQualityLabel(quality)));
    level.add(preset, 'pixelRatioCap', 0.5, 2, 0.05).name('Pixel density (max)').onFinishChange(onTuned);
    level.add(preset, 'particleDensity', 0.1, 1, 0.05).name('Particle density (share)').onFinishChange(onTuned);
    level.add(preset, 'groundCoverShare', 0.05, 1, 0.05).name('Nature trail ground cover (share)').onFinishChange(onTuned);
    level.add(preset, 'sceneryShare', 0.05, 1, 0.05).name('Nature trail trees and rocks (share)').onFinishChange(onTuned);
    level.add(preset, 'groundDetailMaps').name('Nature trail ground detail textures').onFinishChange(onTuned);
    level.close();
  }
  folder.close();
}

export function addCatFurControls(gui: GUI): void {
  const folder = gui.addFolder('Cat fur (long hair, mane)');
  folder.add(catFur, 'lengthFraction', 0.01, 0.2, 0.005).name('Hair length (share of body height)');
  folder.add(catFur, 'droopFraction', 0, 0.1, 0.005).name('Droop');
  folder.add(catFur, 'strandDensity', 60, 400, 5).name('Hair density');
  folder.add(catFur, 'faceShortening', 0, 1, 0.05).name('Shorten face fur');
  folder.add(catFur, 'rootDarkening', 0, 1, 0.05).name('Darken roots');
  folder.add(catFur, 'ruffLengthFraction', 0.02, 0.3, 0.005).name('Ruff: length');
  folder.add(catFur, 'ruffReach', 0.5, 2, 0.05).name('Ruff: reach');
  folder.add(catFur, 'lionLengthFraction', 0.05, 0.5, 0.005).name('Lion mane: length');
  folder.add(catFur, 'lionReach', 0.5, 2.5, 0.05).name('Lion mane: reach');
  folder.add(catFur, 'maneTone', 0.3, 1.2, 0.02).name('Mane: brightness');
  folder.close();
}

export function addKartStatsControls(gui: GUI, stats: KartStatsTable): void {
  const folder = gui.addFolder('Kart types and wheels');
  for (const id of KART_TYPES) addDriveModifierControls(folder.addFolder(inLanguage('en', () => t().lobby.kartTypes[id])), stats.kartTypes[id]);
  for (const id of WHEEL_TYPES) addDriveModifierControls(folder.addFolder(`Wheels: ${inLanguage('en', () => t().lobby.wheels[id])}`), stats.wheels[id]);
  for (const kind of SURFACE_KINDS) {
    const surface = folder.addFolder(`Surface: ${stats.surfaces[kind].label}`);
    surface.add(stats.surfaces[kind], 'speedFactor', 0.3, 1.3, 0.01).name('Speed (factor)');
    surface.add(stats.surfaces[kind], 'accelerationFactor', 0.3, 1.3, 0.01).name('Acceleration (factor)');
    surface.add(stats.surfaces[kind], 'gripFactor', 0.2, 1.5, 0.01).name('Grip (factor)');
    surface.close();
  }
  folder.close();
}

function addDriveModifierControls(folder: GUI, modifiers: DriveModifiers): void {
  folder.add(modifiers, 'topSpeedFactor', 0.5, 1.6, 0.01).name('Top speed (factor)');
  folder.add(modifiers, 'accelerationFactor', 0.5, 1.6, 0.01).name('Acceleration (factor)');
  folder.add(modifiers, 'steerRateFactor', 0.5, 1.6, 0.01).name('Steering (factor)');
  folder.add(modifiers, 'driftYawRateFactor', 0.3, 1.6, 0.01).name('Drift yaw (factor)');
  folder.add(modifiers, 'driftBoostFactor', 0.3, 1.6, 0.01).name('Drift boost (factor)');
  folder.add(modifiers, 'offroadPenaltyShare', 0, 2, 0.05).name('Offroad penalty (share)');
  folder.add(modifiers, 'massFactor', 0.3, 4, 0.05).name('Mass (factor)');
  folder.add(modifiers, 'rammingFactor', 0.3, 3, 0.05).name('Ramming force (factor)');
  folder.close();
}

export function addAudioControls(gui: GUI, audio: AudioConfig): void {
  const folder = gui.addFolder('Sound');
  folder.add(audio, 'muted').name('Muted');
  folder.add(audio, 'masterVolume', 0, 1, 0.01).name('Master volume');
  folder.add(audio, 'sfxVolume', 0, 1, 0.01).name('Effects volume');
  folder.add(audio, 'engineVolume', 0, 1, 0.01).name('Engine volume');
  folder.add(audio, 'musicVolume', 0, 1, 0.01).name('Music volume');
}
