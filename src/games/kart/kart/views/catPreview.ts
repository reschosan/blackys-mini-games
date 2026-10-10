import * as THREE from 'three';
import { CatView } from '../../../../shared/cat/catView';
import type { CatAppearance } from '../../../../shared/config/catAppearance';
import { sameKartLoadout, type KartLoadout } from '../../../../shared/config/kartLoadout';
import type { PlaneTypeId } from '../../../../shared/config/planeTypes';
import { loadPlaneModel } from '../../../../shared/game/planeModels';
import { KartView } from './kartView';

const PREVIEW_WIDTH_PX = 260;
const PREVIEW_HEIGHT_PX = 200;
const ROTATION_SPEED = 0.6;

export type CatPreviewAngle = 'race' | 'front';

const PREVIEW_BELT_SPEED = 3;
/** A plane is about 7 m long, a kart about 1.5 m: the plane is drawn smaller so that it fills the picture like the kart does. */
/** Every plane is shown at most this long and this high in the preview, so a long liner turning nose first and a bulky UFO both fit the frame. */
const PLANE_PREVIEW_LENGTH = 3;
const PLANE_PREVIEW_HEIGHT = 1.9;

const CAMERA_PRESETS: Record<CatPreviewAngle, { position: THREE.Vector3; target: THREE.Vector3 }> = {
  // Matches the follow camera's steep downward pitch (config/camera.ts), from behind-above.
  race: { position: new THREE.Vector3(-1.9, 2.3, 1.9), target: new THREE.Vector3(0, 0.5, 0) },
  front: { position: new THREE.Vector3(1.8, 1.75, 3.0), target: new THREE.Vector3(0, 0.6, 0) },
};

/** What a preview shows. */
export type PreviewSubject = { readonly kind: 'cat' } | { readonly kind: 'kart' } | { readonly kind: 'plane'; readonly plane: PlaneTypeId };

/** A lit stage behind the cat: a black cat must stand out as well as a white one. */
const PREVIEW_BACKDROP = 'radial-gradient(circle at 50% 62%, #545b78 0%, #2b2f40 58%, #1a1c26 100%)';

export class CatPreview {
  readonly canvasElement: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(50, PREVIEW_WIDTH_PX / PREVIEW_HEIGHT_PX, 0.1, 12);
  private readonly catView: CatView;
  private kartView: KartView;
  private loadout: KartLoadout;
  private readonly planeHolder = new THREE.Group();
  private readonly catHolder = new THREE.Group();
  private subject: PreviewSubject = { kind: 'kart' };
  private showing = 'kart';

  /** A bare canvas sized to fill its parent, left for the caller to place and re-parent
   *  (embedded once per player in the lobby). */
  constructor(
    appearance: CatAppearance,
    loadout: KartLoadout,
    private readonly accentColor: number,
  ) {
    this.canvasElement = document.createElement('canvas');
    this.canvasElement.width = PREVIEW_WIDTH_PX;
    this.canvasElement.height = PREVIEW_HEIGHT_PX;
    Object.assign(this.canvasElement.style, {
      display: 'block',
      width: '100%',
      height: '100%',
      background: PREVIEW_BACKDROP,
    });

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvasElement, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(PREVIEW_WIDTH_PX, PREVIEW_HEIGHT_PX, false);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(2, 3, 2);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xaac4ff, 0.35);
    fill.position.set(-2, 1, -1.5);
    this.scene.add(fill);

    this.setAngle('race');

    this.catView = new CatView(appearance);
    this.loadout = loadout;
    this.kartView = this.createKartView(loadout);
    this.planeHolder.visible = false;
    this.scene.add(this.planeHolder, this.catHolder);
  }

  /** What the card is about: the cat alone (before a game is chosen, and in games without a vehicle), the cat in its kart, or the plane alone. */
  show(subject: PreviewSubject): void {
    const key = subject.kind === 'plane' ? `plane:${subject.plane}` : subject.kind;
    if (key === this.showing) return;
    this.showing = key;
    this.subject = subject;
    this.arrange();
  }

  private arrange(): void {
    const { subject } = this;
    this.kartView.object.visible = subject.kind === 'kart';
    this.planeHolder.visible = subject.kind === 'plane';
    this.planeHolder.clear();
    if (subject.kind === 'kart') {
      this.kartView.mountCat(this.catView);
      return;
    }
    this.catView.object.removeFromParent();
    if (subject.kind === 'cat') {
      this.catView.setPose('stand');
      this.catView.object.position.set(0, 0, 0);
      this.catHolder.add(this.catView.object);
      return;
    }
    void loadPlaneModel(subject.plane).then((model) => {
      if (this.subject !== subject) return;
      model.updateMatrixWorld(true);
      const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      this.planeHolder.scale.setScalar(Math.min(PLANE_PREVIEW_LENGTH / Math.max(size.x, size.z), PLANE_PREVIEW_HEIGHT / size.y));
      this.planeHolder.add(model);
    });
  }

  private createKartView(loadout: KartLoadout): KartView {
    const kartView = new KartView(loadout, this.accentColor);
    kartView.mountCat(this.catView);
    this.scene.add(kartView.object);
    return kartView;
  }

  setLoadout(loadout: KartLoadout): void {
    if (sameKartLoadout(this.loadout, loadout)) return;
    const yaw = this.kartView.object.rotation.y;
    this.scene.remove(this.kartView.object);
    this.kartView.dispose();
    this.loadout = loadout;
    this.kartView = this.createKartView(loadout);
    this.kartView.object.rotation.y = yaw;
    if (this.subject.kind !== 'kart') this.arrange();
  }

  setAngle(angle: CatPreviewAngle): void {
    const preset = CAMERA_PRESETS[angle];
    this.camera.position.copy(preset.position);
    this.camera.lookAt(preset.target);
  }

  setAppearance(appearance: CatAppearance): void {
    this.catView.setAppearance(appearance);
  }

  render(frameSeconds: number): void {
    this.catView.update(frameSeconds, { isMoving: true, lateralSpeed: 0, boosting: false });
    this.kartView.update(frameSeconds, PREVIEW_BELT_SPEED, 0, 0);
    this.kartView.object.rotation.y += ROTATION_SPEED * frameSeconds;
    this.planeHolder.rotation.y = this.kartView.object.rotation.y;
    this.catHolder.rotation.y = this.kartView.object.rotation.y;
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.kartView.dispose();
    this.catView.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvasElement.remove();
  }
}
