import * as THREE from 'three';
import type { MapConfig } from '../mapConfig';
import { createMapView, disposeMapView } from './mapView';
import { createLightRig } from './lightRig';
import { HOUSE_WALL_CUTAWAY_HEIGHT, showHouseLevel } from '../../familyHouse/view';

const PREVIEW_SIZE_PX = 260;

let sharedRenderer: THREE.WebGLRenderer | null = null;

/** All previews render through one WebGL context and keep only the finished image, so opening
 *  the map vote never allocates new contexts. */
function previewRenderer(): THREE.WebGLRenderer {
  if (!sharedRenderer) {
    sharedRenderer = new THREE.WebGLRenderer({ antialias: true });
    sharedRenderer.localClippingEnabled = true;
    sharedRenderer.setSize(PREVIEW_SIZE_PX, PREVIEW_SIZE_PX, false);
  }
  return sharedRenderer;
}

/** A small, static top-down render of a map, for the "Choose map" screen. Shows a stored
 *  image (2D canvas, appended by the caller) with a fixed overhead camera instead of an orbiting
 *  one like `debug/catPreview.ts`'s `CatPreview` (a map doesn't need to spin). */
export class MapPreview {
  readonly canvasElement: HTMLCanvasElement;
  private readonly snapshotContext: CanvasRenderingContext2D;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  private readonly mapView: THREE.Group;
  private rendered = false;
  private renderedModel = false;
  private warmed = false;
  private readonly cutawayPlanes: readonly THREE.Plane[];

  constructor(map: MapConfig) {
    this.canvasElement = document.createElement('canvas');
    this.canvasElement.width = PREVIEW_SIZE_PX;
    this.canvasElement.height = PREVIEW_SIZE_PX;
    Object.assign(this.canvasElement.style, {
      display: 'block',
      width: '100%',
      height: '100%',
      background: '#1a1a20',
    });

    this.snapshotContext = this.canvasElement.getContext('2d')!;
    this.cutawayPlanes = map.kind === 'house' ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), HOUSE_WALL_CUTAWAY_HEIGHT)] : [];

    const lightRig = createLightRig(map, true);
    this.scene.add(lightRig.hemisphere, lightRig.sun);
    this.mapView = createMapView(map, false);
    this.scene.background = new THREE.Color(map.skyColor ?? 0x1a1a20);
    this.scene.add(this.mapView);

    const halfExtent = Math.max(map.room.width, map.room.depth) / 2;
    this.camera.far = Math.max(200, halfExtent * 5);
    this.camera.updateProjectionMatrix();
    this.camera.position.set(map.room.x, halfExtent * 1.8, map.room.z + halfExtent * 0.2);
    this.camera.lookAt(map.room.x, 0, map.room.z);
  }

  render(): void {
    const loaded = this.mapView.userData.houseModelLoaded === true || this.mapView.userData.groundTexturesLoaded === true;
    if (this.rendered && loaded === this.renderedModel) return;
    showHouseLevel(this.mapView, 'ground');
    const renderer = previewRenderer();
    renderer.clippingPlanes = [...this.cutawayPlanes];
    renderer.render(this.scene, this.camera);
    renderer.clippingPlanes = [];
    this.snapshotContext.drawImage(renderer.domElement, 0, 0);
    this.rendered = true;
    this.renderedModel = loaded;
  }

  warmRaceRenderer(renderer: THREE.WebGLRenderer, targetScene: THREE.Scene): void {
    if (this.warmed || this.mapView.userData.houseModelLoaded !== true) return;
    this.warmed = true;
    const modelLevels = this.mapView.children.filter((node) => node.userData.houseModelLevel === true);
    void Promise.all(modelLevels.map((node) => renderer.compileAsync(node, this.camera, targetScene))).catch((error: unknown) =>
      console.error('House shader warmup failed', error),
    );
  }

  dispose(): void {
    disposeMapView(this.mapView);
    this.canvasElement.remove();
  }
}
