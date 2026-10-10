import * as THREE from 'three';
import { CatView } from '../../../shared/cat/catView';
import { smoothTowards } from '../../../shared/core/framing';
import type { EngineSeat, EngineSnapshot } from '../../../shared/game/engine';
import type { EngineView } from '../../../shared/game/engineView';
import { FollowRig } from '../../../shared/game/followRig';
import { JetEffects } from './jetEffects';
import { buildRoom } from './jetRoom';
import { buildSky, HORIZON_COLOR, type JetSky } from './jetSky';
import { loadPlaneModel } from '../../../shared/game/planeModels';
import { DEFAULT_PLANE_TYPE } from '../../../shared/config/planeTypes';
import { followedSeat } from '../../../shared/game/spectate';
import { readJetRow, type JetPicture } from '../jetRow';

const CAT_SCALE = 1.3;
const POSE_EASING = 32;
const TELEPORT_METERS = 40;
const BANK_PER_STEER = 0.9;
const MAX_BANK_RADIANS = 0.55;
const PITCH_PER_CLIMB = 0.035;
/** A plane that was just hit blinks at this pace while it cannot be hit again. */
const BLINK_MILLISECONDS = 90;

type Row = readonly number[];

interface JetsPicture {
  readonly jets: readonly JetPicture[];
  readonly bullets: readonly Row[];
  readonly pickups: readonly Row[];
  readonly size: number;
  readonly maxAltitude: number;
}

function readPicture(snapshot: EngineSnapshot): JetsPicture | null {
  const { jets, bullets, pickups, size, maxAltitude } = snapshot;
  const valid = Array.isArray(jets) && Array.isArray(bullets) && Array.isArray(pickups) && typeof size === 'number' && typeof maxAltitude === 'number';
  return valid ? { jets: (jets as Row[]).map(readJetRow), bullets: bullets as Row[], pickups: pickups as Row[], size, maxAltitude } : null;
}

function isBlinkedOut(jet: JetPicture): boolean {
  const justHit = jet.flashing && jet.hits > 0;
  return justHit && Math.floor(performance.now() / BLINK_MILLISECONDS) % 2 === 1;
}

interface PlaneParts {
  readonly group: THREE.Group;
  readonly cat: CatView;
  readonly shadow: THREE.Mesh;
  readonly shield: THREE.Mesh;
  readonly shown: { x: number; y: number; z: number; heading: number; bank: number; started: boolean };
}

/** The room from the air with the camera of the kart race: every pilot looks over their own plane's tail (the plane turns, the camera follows) and sees the others, the item boxes and the shots.
 *  With nobody watching (only AI plays on the host) one camera looks over the whole room. */
export class JetsView implements EngineView {
  readonly scene = new THREE.Scene();
  private readonly overview = new THREE.PerspectiveCamera(50, 1.6, 0.1, 800);
  private readonly rigs = new Map<number, FollowRig>();
  private readonly planes: PlaneParts[];
  private readonly effects = new JetEffects(this.scene);
  private picture: JetsPicture | null = null;
  private roomBuiltFor = 0;
  private room: THREE.Object3D[] = [];
  private sky: JetSky | null = null;

  constructor(seats: readonly EngineSeat[]) {
    this.scene.background = new THREE.Color(HORIZON_COLOR);
    this.scene.fog = new THREE.Fog(HORIZON_COLOR, 130, 430);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(30, 80, 20);
    this.scene.add(sun);
    this.planes = seats.map((seat) => this.buildPlane(seat));
  }

  mount(): void {}

  apply(snapshot: EngineSnapshot): void {
    this.picture = readPicture(snapshot) ?? this.picture;
  }

  frame(frameSeconds: number, viewers: readonly number[]): void {
    const { picture } = this;
    if (!picture) return;
    if (picture.size !== this.roomBuiltFor) {
      this.roomBuiltFor = picture.size;
      for (const part of this.room) this.scene.remove(part);
      this.sky = buildSky(picture.size);
      this.room = [...buildRoom(picture.size), ...this.sky.objects];
      this.scene.add(...this.room);
    }
    this.sky?.drift(frameSeconds);
    this.planes.forEach((plane, slot) => this.showPlane(plane, picture.jets[slot], frameSeconds));
    this.effects.show(picture.bullets, picture.pickups, frameSeconds);
    for (const seat of viewers) this.followSeat(seat, picture.jets[seat], frameSeconds);
    if (viewers.length === 0) {
      this.overview.position.set(0, picture.size * 0.75, picture.size * 0.75);
      this.overview.lookAt(0, picture.maxAltitude * 0.3, 0);
    }
  }

  camerasFor(viewers: readonly number[]): readonly THREE.PerspectiveCamera[] {
    return viewers.length > 0 ? viewers.map((seat) => this.rigFor(seat).camera) : [this.overview];
  }

  dispose(): void {
    for (const plane of this.planes) plane.cat.dispose();
    this.effects.dispose();
    this.scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (this.planes.some((plane) => plane.cat.object.getObjectById(node.id))) return;
      node.geometry.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) material.dispose();
    });
  }

  private rigFor(seat: number): FollowRig {
    let rig = this.rigs.get(seat);
    if (!rig) {
      rig = new FollowRig();
      this.rigs.set(seat, rig);
    }
    return rig;
  }

  private followSeat(seat: number, jet: JetPicture | undefined, frameSeconds: number): void {
    if (!jet) return;
    const shown = this.planes[followedSeat(seat, jet.out, jet.watching)]?.shown;
    if (!shown) return;
    this.rigFor(seat).place(shown.x, shown.y, shown.z, shown.heading + Math.PI / 2, frameSeconds);
  }

  private buildPlane(seat: EngineSeat): PlaneParts {
    const group = new THREE.Group();
    const body = new THREE.Group();
    group.add(body);
    const paint = new THREE.MeshLambertMaterial({ color: seat.color });
    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 1.4), paint);
    const wings = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 7), paint);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.25), paint);
    tail.position.set(-2.2, 0.9, 0);
    body.add(fuselage, wings, tail);
    void loadPlaneModel(seat.plane ?? DEFAULT_PLANE_TYPE)
      .then((model) => {
        body.clear();
        body.add(model);
      })
      .catch(() => undefined);
    const cat = new CatView(seat.appearance);
    cat.setPose('stand');
    cat.object.scale.setScalar(CAT_SCALE);
    cat.object.position.set(0.3, 0.5, 0);
    group.add(cat.object);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.9, 24), new THREE.MeshBasicMaterial({ color: seat.color, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.4;
    group.add(ring);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(4.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0x6fc3ff, transparent: true, opacity: 0.28 }));
    shield.visible = false;
    group.add(shield);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(2.6, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 }));
    shadow.rotation.x = -Math.PI / 2;
    this.scene.add(group, shadow);
    return { group, cat, shadow, shield, shown: { x: 0, y: 0, z: 0, heading: 0, bank: 0, started: false } };
  }

  private showPlane(plane: PlaneParts, jet: JetPicture | undefined, frameSeconds: number): void {
    const flying = jet !== undefined && !jet.out;
    plane.group.visible = flying;
    plane.shadow.visible = flying;
    if (!flying) return;
    const { shown } = plane;
    const { x, z, heading, y } = jet;
    if (!shown.started || Math.hypot(x - shown.x, z - shown.z) > TELEPORT_METERS) Object.assign(shown, { x, y, z, heading, started: true });
    const turn = Math.atan2(Math.sin(heading - shown.heading), Math.cos(heading - shown.heading));
    shown.x = smoothTowards(shown.x, x, POSE_EASING, frameSeconds);
    shown.y = smoothTowards(shown.y, y, POSE_EASING, frameSeconds);
    shown.z = smoothTowards(shown.z, z, POSE_EASING, frameSeconds);
    shown.heading += turn * (1 - Math.exp(-POSE_EASING * frameSeconds));
    shown.bank = smoothTowards(shown.bank, Math.max(-MAX_BANK_RADIANS, Math.min(MAX_BANK_RADIANS, turn * 40 * BANK_PER_STEER)), 8, frameSeconds);
    plane.group.position.set(shown.x, shown.y, shown.z);
    plane.group.rotation.set(shown.bank, -shown.heading, jet.vertical * PITCH_PER_CLIMB, 'YXZ');
    plane.group.visible = !isBlinkedOut(jet);
    plane.shield.visible = jet.shielded;
    plane.shadow.position.set(shown.x, 0.05, shown.z);
    plane.shadow.scale.setScalar(Math.max(1 - shown.y / 70, 0.3));
    plane.cat.update(frameSeconds, { isMoving: false, lateralSpeed: 0, boosting: jet.boosting });
  }
}
