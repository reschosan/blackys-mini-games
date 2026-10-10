import * as THREE from 'three';
import { AiGuideView } from '../../../ai/views/aiGuideView';
import { clearAiGuideLines } from '../../../ai/aiGuideLine';
import type { SoundEngine } from '../../../../../shared/audio/soundEngine';
import { RaceCamera } from '../../../camera/raceCamera';
import { houseViewLevelId, showHouseLevel, showRouteGuidance } from '../../../maps/familyHouse/view';
import { CatView } from '../../../../../shared/cat/catView';
import type { CameraConfig } from '../../../../../shared/config/camera';
import { FUR_COLOR_HEX, type CatAppearance } from '../../../../../shared/config/catAppearance';
import { activePreset, pixelRatioFor, type GraphicsConfig } from '../../../../../shared/config/graphics';
import { sameKartLoadout, type KartLoadout } from '../../../../../shared/config/kartLoadout';
import type { MapConfig } from '../../../maps/shared/mapConfig';
import { tintForKart } from '../../../../../shared/debug/driftFeedback';
import { KartEffects } from '../../../../../shared/effects/kartEffects';
import { flightRollOf, lateralSpeedOf, speedOf, type KartState } from '../../../kart/kartState';
import type { Pose } from '../poseInterpolation';
import { KartView } from '../../../kart/views/kartView';
import { clearRouteBankLayout, routeBankTilt } from '../../../maps/shared/routeBanks';
import { createMapView, disposeMapView } from '../../../maps/shared/view/mapView';
import { applyMapLighting, createLightRig, type LightRig } from '../../../maps/shared/view/lightRig';
import type { MapPreview } from '../../../maps/shared/view/mapPreview';
import type { ItemConfig, ItemType } from '../../../../../shared/config/items';
import { drawScene } from './sceneViews';
import { keepCameraInsideHouse, type ViewSubject } from './houseCameraAvoidance';
import { ModeVisualsView } from '../../../modes/views/modeVisualsView';
import type { ModeVisual } from '../../../modes/rules/modeRules';
import { RacerFeedback, createFeedback } from './racerFeedback';
import { FieldItemViews } from './fieldItemViews';
import { BlendedPoses } from './blendedPoses';
import type { PresentedRacer, RacerView } from './racerTypes';

export type { PresentedRacer } from './racerTypes';
import type { RaceWorld } from '../../raceWorld';

const MAP_KINDS_WITH_MODELS: ReadonlySet<string> = new Set(['house', 'nature', 'space', 'farm', 'town', 'city']);
const CAT_WALK_SPEED_THRESHOLD = 0.4;

export class RacePresentation {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private mapView: THREE.Group;
  private aiGuideView: AiGuideView;
  private aiGuidesVisible = false;
  private readonly fieldItems: FieldItemViews;
  private readonly lightRig: LightRig;
  private readonly effects = new KartEffects();
  private readonly modeVisuals = new ModeVisualsView();
  private readonly feedback: RacerFeedback;
  private camera: RaceCamera;
  private readonly splitCameras: RaceCamera[] = [];
  private readonly racers = new Map<PresentedRacer, RacerView>();
  private readonly poses = new BlendedPoses();
  private splitScreenAllowed = true;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private map: MapConfig,
    private readonly cameraConfig: CameraConfig,
    private readonly sound: SoundEngine,
    private readonly graphics: GraphicsConfig,
  ) {
    this.feedback = new RacerFeedback({
      sound,
      effects: this.effects,
      currentMap: () => this.map,
      shakeCameras: (strength) => [this.camera, ...this.splitCameras].forEach((camera) => camera.shake(strength)),
    });
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.localClippingEnabled = true;
    this.applyRendererQuality();
    this.camera = new RaceCamera(cameraConfig, map);
    this.mapView = createMapView(map, true, activePreset(graphics));
    this.lightRig = createLightRig(map);
    this.aiGuideView = new AiGuideView(map);
    this.fieldItems = new FieldItemViews(map);
    this.scene.background = new THREE.Color(map.skyColor ?? 0x101014);
    this.scene.add(
      this.lightRig.hemisphere,
      this.lightRig.sun,
      this.mapView,
      this.aiGuideView.object,
      this.fieldItems.object,
      this.effects.object,
      this.modeVisuals.object,
    );
  }

  addRacer(player: PresentedRacer, color: number, appearance: CatAppearance, loadout: KartLoadout): void {
    const view = new KartView(loadout, color);
    const cat = new CatView(appearance);
    view.mountCat(cat);
    this.scene.add(view.object);
    this.racers.set(player, { view, cat, accentColor: color, loadout, feedback: createFeedback() });
  }

  /** Rebuilds the kart body when the lobby choice changed; the cat and feedback state carry over. */
  setLoadout(player: PresentedRacer, loadout: KartLoadout): void {
    const visual = this.visualFor(player);
    if (sameKartLoadout(visual.loadout, loadout)) return;
    this.scene.remove(visual.view.object);
    visual.view.dispose();
    const view = new KartView(loadout, visual.accentColor);
    view.mountCat(visual.cat);
    this.scene.add(view.object);
    this.racers.set(player, { ...visual, view, loadout });
  }

  removeRacer(player: PresentedRacer): void {
    this.poses.forget(player);
    const visual = this.visualFor(player);
    this.scene.remove(visual.view.object);
    visual.cat.dispose();
    visual.view.dispose();
    this.racers.delete(player);
  }

  /** Remembers where every racer was before the next simulation tick moves it, so frames in between
   *  can be drawn blended between the two ticks (see `setFrameAlpha`). Reads the state only. */
  snapshotPoses(players: readonly PresentedRacer[]): void {
    this.poses.rememberBeforeTick(players);
  }

  setFrameAlpha(alpha: number): void {
    this.poses.setFrameAlpha(alpha);
  }

  /** A phone-sized screen never splits: several players on it share one picture that frames them all. */
  setSplitScreenAllowed(allowed: boolean): void {
    this.splitScreenAllowed = allowed;
  }

  /** What the game being played puts on the ground (platform, tiles, goals and ball, the mark over the hunter). */
  setModeVisual(visual: ModeVisual, players: readonly PresentedRacer[], frameSeconds: number): void {
    this.modeVisuals.update(
      visual,
      players.map((player) => player.state as KartState),
      frameSeconds,
    );
  }

  appearanceFor(player: PresentedRacer): CatAppearance {
    return this.visualFor(player).cat.getAppearance();
  }
  setAppearance(player: PresentedRacer, appearance: CatAppearance): void {
    this.visualFor(player).cat.setAppearance(appearance);
  }
  resetFeedback(): void {
    for (const visual of this.racers.values()) visual.feedback = createFeedback();
  }

  private visualFor(player: PresentedRacer): RacerView {
    const visual = this.racers.get(player);
    if (!visual) throw new Error('Racer presentation is not registered');
    return visual;
  }

  private applyRendererQuality(): void {
    const preset = activePreset(this.graphics);
    this.renderer.setPixelRatio(pixelRatioFor(preset));
    this.effects.setParticleDensity(preset.particleDensity);
  }

  /** The graphics level or one of its values changed: pixel ratio and particles at once, the map view is built again with its detail. */
  applyGraphicsQuality(): void {
    this.applyRendererQuality();
    this.refreshMap();
  }

  setMap(map: MapConfig): void {
    this.map = map;
    this.scene.background = new THREE.Color(map.skyColor ?? 0x101014);
    applyMapLighting(map, this.lightRig);
    this.refreshMap();
    this.fieldItems.setMap(map);
    this.camera = new RaceCamera(this.cameraConfig, map);
    this.splitCameras.length = 0;
  }

  refreshMap(): void {
    clearRouteBankLayout(this.map);
    clearAiGuideLines(this.map);
    this.scene.remove(this.mapView);
    disposeMapView(this.mapView);
    this.mapView = createMapView(this.map, true, activePreset(this.graphics));
    this.scene.add(this.mapView);
    this.scene.remove(this.aiGuideView.object);
    this.aiGuideView.dispose();
    this.aiGuideView = new AiGuideView(this.map);
    this.scene.add(this.aiGuideView.object);
  }

  setAiGuidesVisible(visible: boolean): void {
    this.aiGuidesVisible = visible;
  }

  /** False while the map's models are still loading; maps without models are always ready, and a
   *  failed load counts as ready so the race never waits forever for a missing file. */
  hasMapAssetsFailed(): boolean {
    return this.mapView.userData.assetsFailed === true;
  }

  isMapReady(): boolean {
    const { houseModelLoaded, assetsFailed } = this.mapView.userData;
    const hasModels = this.map.kind !== undefined && MAP_KINDS_WITH_MODELS.has(this.map.kind);
    return !hasModels || houseModelLoaded === true || assetsFailed === true;
  }

  warmPreview(preview: MapPreview): void {
    preview.warmRaceRenderer(this.renderer, this.scene);
  }

  diagnostics() {
    return {
      camera: { position: this.camera.camera.position.toArray(), occluder: this.camera.camera.userData.occluder ?? null },
      rendering: {
        calls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        geometries: this.renderer.info.memory.geometries,
        textures: this.renderer.info.memory.textures,
      },
      houseModelLoaded: this.mapView.userData.houseModelLoaded === true,
      aiGuideSegments: this.aiGuideView.visibleSegmentCount,
    };
  }

  update(frameSeconds: number, players: readonly PresentedRacer[], world: RaceWorld, items: ItemConfig, racing: boolean): void {
    this.resize();
    this.mapView.userData.animate?.(frameSeconds);
    const hairballColors = players.map((player) => FUR_COLOR_HEX[this.appearanceFor(player).furColor]);
    this.fieldItems.update(frameSeconds, this.map, world, items, hairballColors);
    this.effects.update(frameSeconds);
    if (!racing) this.sound.stopAllEngines();
    players.forEach((player, index) => {
      const visual = this.visualFor(player);
      const speed = speedOf(player.state);
      this.updateRacer(player, visual, speed, frameSeconds);
      if (racing) this.feedback.update(player.state, player.progress, visual.feedback, index, speed, frameSeconds, items);
    });
  }

  private updateRacer(player: PresentedRacer, visual: RacerView, speed: number, seconds: number): void {
    const state = player.state;
    const pose = this.poses.poseOf(player);
    const tilt = this.tiltOf(state, pose);
    visual.view.setTransform(pose.x, pose.z, pose.yaw, this.poses.elevationOf(this.map, player, pose), tilt.pitch, tilt.roll);
    visual.view.setTintColor(tintForKart(state.driftStage, state.boostSeconds > 0));
    visual.view.update(seconds, speed, state.stunSecondsLeft, state.shieldSecondsLeft);
    visual.cat.update(seconds, { isMoving: speed > CAT_WALK_SPEED_THRESHOLD, lateralSpeed: lateralSpeedOf(state), boosting: state.boostSeconds > 0 });
  }

  /** Banked on the route, level in a window jump, rolling over in the flight after a shove. */
  private tiltOf(state: Readonly<KartState>, pose: Pose): { readonly pitch: number; readonly roll: number } {
    if (state.airborneSecondsLeft > 0) return { pitch: 0, roll: flightRollOf(state) };
    return state.windowJumpId === null ? routeBankTilt(this.map, state.levelId, pose.x, pose.z, pose.yaw) : { pitch: 0, roll: 0 };
  }

  showItemBurst(state: Readonly<KartState>, item: ItemType, count: number): void {
    this.feedback.showItemBurst(state, item, count);
  }

  private resize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const ratio = this.renderer.getPixelRatio();
    if (this.canvas.width === Math.floor(width * ratio) && this.canvas.height === Math.floor(height * ratio)) return;
    this.renderer.setSize(width, height, false);
    this.camera.setAspect(width / height);
  }

  /** Draws a scene of a game that is not on the kart engine, one camera per viewer; no scene clears the canvas. */
  renderScene(scene: THREE.Scene | null, cameras: readonly THREE.PerspectiveCamera[]): void {
    this.resize();
    drawScene(this.renderer, this.canvas, scene, cameras);
  }

  render(frameSeconds: number, players: readonly PresentedRacer[]): void {
    const subjects = this.cameraSubjects(players);
    if (subjects.length <= 1 || !this.splitScreenAllowed) {
      this.camera.setAspect(this.canvas.clientWidth / this.canvas.clientHeight);
      this.camera.update(subjects, frameSeconds);
      this.showHouseLevel(subjects[0], players);
      keepCameraInsideHouse(this.map, this.cameraConfig, this.camera.camera, subjects[0]);
      this.renderer.setViewport(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
      this.renderer.render(this.scene, this.camera.camera);
      return;
    }
    this.renderSplit(subjects, frameSeconds, players);
  }

  /** Every human on this screen gets a camera; with none here the camera follows the first kart, before the race the start. */
  private cameraSubjects(players: readonly PresentedRacer[]): readonly ViewSubject[] {
    const humans = players.filter((player) => !player.isAi && player.viewedElsewhere !== true);
    const followed = humans.length > 0 ? humans : players.slice(0, 1);
    if (followed.length === 0) return this.map.startPositions.slice(0, 1);
    return followed.map((player) => this.poses.cameraSubject(this.map, player));
  }

  private renderSplit(subjects: readonly ViewSubject[], seconds: number, players: readonly PresentedRacer[]): void {
    while (this.splitCameras.length < subjects.length) this.splitCameras.push(new RaceCamera(this.cameraConfig, this.map));
    const rows = subjects.length === 2 ? 1 : 2;
    const width = Math.floor(this.canvas.clientWidth / 2);
    const height = Math.floor(this.canvas.clientHeight / rows);
    this.renderer.setScissorTest(true);
    this.renderer.clear();
    subjects.forEach((subject, index) => {
      const x = (index % 2) * width;
      const y = (rows - 1 - Math.floor(index / 2)) * height;
      const camera = this.splitCameras[index]!;
      camera.setAspect(width / height);
      camera.update([subject], seconds);
      this.showHouseLevel(subject, players);
      keepCameraInsideHouse(this.map, this.cameraConfig, camera.camera, subject);
      this.renderer.setViewport(x, y, width, height);
      this.renderer.setScissor(x, y, width, height);
      this.renderer.render(this.scene, camera.camera);
    });
    this.renderer.setScissorTest(false);
  }

  private showHouseLevel(subject: ViewSubject | undefined, players: readonly PresentedRacer[]): void {
    const levelId = subject ? houseViewLevelId(this.map, subject) : 'ground';
    showHouseLevel(this.mapView, levelId);
    const playerLevel = subject?.levelId ?? 'ground';
    this.aiGuideView.show(
      this.aiGuidesVisible,
      players.flatMap((player, index) => (player.isAi ? [index] : [])),
      playerLevel,
    );
    if (this.map.levels) showRouteGuidance(this.mapView, this.map, playerLevel, subject?.nextCheckpoint ?? 1, subject);
    this.fieldItems.showLevel(playerLevel);
    for (const player of players)
      this.visualFor(player).view.object.visible = player.hidden !== true && (!this.map.levels || player.state.levelId === playerLevel);
  }
}
