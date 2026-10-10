import * as THREE from 'three';
import { CatView } from '../../../shared/cat/catView';
import { smoothAngleTowards, smoothTowards } from '../../../shared/core/framing';
import { setSurfaceUVs, texturedBoxGeometry, texturedMaterial } from '../../../shared/effects/surfaceTextures';
import { sceneryGround, scatterSurroundings } from '../../../shared/effects/surroundings';
import type { EngineSeat, EngineSnapshot } from '../../../shared/game/engine';
import type { EngineView } from '../../../shared/game/engineView';
import { FollowRig } from '../../../shared/game/followRig';
import { followedSeat } from '../../../shared/game/spectate';
import { SquareGrid } from '../../../shared/game/squareGrid';
import { readCatRow, type CatPicture } from '../walkCatRow';
import { GONE, WARNING } from '../walkFloor';
import { FishPool } from './fishPool';

const WARNING_COLOR = 0xff8a2a;
/** The floor grass, the first step wooden boards, the higher steps cobbles: the height reads at a glance. */
const LEVEL_LOOKS = [
  { pattern: 'grass', color: 0x8fc293 },
  { pattern: 'planks', color: 0xc08a62 },
  { pattern: 'cobble', color: 0xd8d2c4 },
] as const;
const TILE_BASE = 0.4;
/** The stone rim of the lava basin stands this high, above the highest the lava rises. */
const RIM_TOP = 3;
const RIM_THICKNESS = 2;
const RIM_COLOR = 0x6b6258;
const TEXTURE_METERS = 3;
const LAVA_TINT = 0xd9481c;
const LAVA_Y = -1.6;
/** The lava reaches this far beyond the floor; behind it the town stands on firm ground, like around the lava floor of the karts. */
const LAVA_MARGIN = 30;
const SCENERY = 'town';
const SCENERY_PIECES = 30;
const SCENERY_REACH_METERS = 70;
const CAT_SCALE = 3.2;
const TILE_GAP = 0.3;
/** How fast the shown cats catch up with the 60 Hz steps of the game: the picture then moves evenly at any frame rate. */
const POSE_EASING = 32;
const TELEPORT_METERS = 8;
const OVERVIEW_ASPECT_FALLBACK = 1.6;
/** The ring under a cat: bigger under the own cat, bigger still while it boosts and most while its paw strikes. */
const OWN_MARKER_SCALE = 1.25;
const BOOST_MARKER_SCALE = 1.5;
const PAW_MARKER_SCALE = 2.2;
/** A cat faster than this walks; slower it stands. */
const WALKING_SPEED = 0.5;

type Row = readonly number[];

interface WalkPicture {
  readonly cats: readonly CatPicture[];
  readonly fish: readonly Row[];
  readonly tiles: Row;
  readonly levels: Row;
  readonly side: number;
  readonly tileSize: number;
  readonly levelHeight: number;
  readonly lava: number;
}

function actionMarkerScale(cat: CatPicture): number {
  if (cat.pawFlashing) return PAW_MARKER_SCALE;
  return cat.boosting ? BOOST_MARKER_SCALE : 1;
}

interface ShownPose {
  x: number;
  y: number;
  z: number;
  facing: number;
  started: boolean;
}

function readPicture(snapshot: EngineSnapshot): WalkPicture | null {
  const { cats, fish, tiles, levels, side, tileSize, levelHeight, lava } = snapshot;
  const valid =
    Array.isArray(cats) &&
    Array.isArray(fish) &&
    Array.isArray(tiles) &&
    Array.isArray(levels) &&
    typeof side === 'number' &&
    typeof tileSize === 'number' &&
    typeof levelHeight === 'number' &&
    typeof lava === 'number';
  return valid
    ? { cats: (cats as Row[]).map(readCatRow), fish: fish as Row[], tiles: tiles as Row, levels: levels as Row, side, tileSize, levelHeight, lava }
    : null;
}

/** The floor of tiles over the lava, seen with the camera of the kart race: every player looks over their own cat's shoulder and turns the camera with the right stick or a swipe.
 *  With nobody watching (only AI plays on the host) one camera shows the whole floor. */
export class WalkView implements EngineView {
  readonly scene = new THREE.Scene();
  private readonly overview = new THREE.PerspectiveCamera(48, OVERVIEW_ASPECT_FALLBACK, 0.1, 400);
  private readonly rigs = new Map<number, FollowRig>();
  private readonly cats: CatView[];
  private readonly markers: THREE.Mesh[];
  private readonly shown: ShownPose[];
  private readonly fish = new FishPool(this.scene);
  private tileMeshes: THREE.Mesh[] = [];
  private surroundings: THREE.Object3D[] = [];
  private builtFor = '';
  private picture: WalkPicture | null = null;
  private readonly levelMaterials = LEVEL_LOOKS.map((look) => texturedMaterial(look.pattern, look.color));
  private readonly warning = new THREE.MeshLambertMaterial({ color: WARNING_COLOR, emissive: WARNING_COLOR, emissiveIntensity: 0.6 });
  private readonly lavaMaterial = texturedMaterial('lava', LAVA_TINT);
  private readonly rimMaterial = texturedMaterial('brick', RIM_COLOR);
  private lava: THREE.Mesh | null = null;

  constructor(seats: readonly EngineSeat[]) {
    this.scene.background = new THREE.Color(0x14161c);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(20, 60, 30);
    this.scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: sceneryGround(SCENERY) }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = LAVA_Y - 0.05;
    this.scene.add(ground);
    this.cats = seats.map((seat) => {
      const cat = new CatView(seat.appearance);
      cat.setPose('walk');
      cat.object.scale.setScalar(CAT_SCALE);
      this.scene.add(cat.object);
      return cat;
    });
    this.shown = seats.map(() => ({ x: 0, y: 0, z: 0, facing: 0, started: false }));
    this.markers = seats.map((seat) => {
      const marker = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 24), new THREE.MeshBasicMaterial({ color: seat.color, side: THREE.DoubleSide }));
      marker.rotation.x = -Math.PI / 2;
      this.scene.add(marker);
      return marker;
    });
  }

  mount(): void {}

  apply(snapshot: EngineSnapshot): void {
    this.picture = readPicture(snapshot) ?? this.picture;
  }

  frame(frameSeconds: number, viewers: readonly number[]): void {
    const { picture } = this;
    if (!picture) return;
    this.buildFloor(picture);
    picture.tiles.forEach((state, tile) => this.showTile(tile, state));
    this.cats.forEach((_, slot) => this.showCat(slot, picture.cats[slot], frameSeconds, viewers.includes(slot)));
    this.fish.show(picture.fish);
    if (this.lava) this.lava.position.y = picture.lava;
    for (const seat of viewers) this.followSeat(seat, picture.cats[seat], frameSeconds);
    if (viewers.length === 0) this.placeOverview(picture);
  }

  camerasFor(viewers: readonly number[]): readonly THREE.PerspectiveCamera[] {
    return viewers.length > 0 ? viewers.map((seat) => this.rigFor(seat).camera) : [this.overview];
  }

  dispose(): void {
    for (const cat of this.cats) cat.dispose();
    this.scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || this.cats.some((cat) => cat.object.getObjectById(node.id))) return;
      node.geometry.dispose();
    });
    for (const material of [...this.levelMaterials, this.lavaMaterial, this.rimMaterial]) {
      material.map?.dispose();
      material.dispose();
    }
    this.warning.dispose();
    this.fish.dispose();
    this.markers.forEach((marker) => (marker.material as THREE.Material).dispose());
  }

  private rigFor(seat: number): FollowRig {
    let rig = this.rigs.get(seat);
    if (!rig) {
      rig = new FollowRig();
      this.rigs.set(seat, rig);
    }
    return rig;
  }

  private followSeat(seat: number, cat: CatPicture | undefined, frameSeconds: number): void {
    if (!cat) return;
    const watched = followedSeat(seat, cat.out, cat.watching);
    const pose = this.shown[watched];
    const watchedCat = this.picture?.cats[watched];
    if (!pose || !watchedCat) return;
    this.rigFor(seat).place(pose.x, pose.y + 1, pose.z, watchedCat.yaw, frameSeconds);
  }

  private placeOverview(picture: WalkPicture): void {
    const extent = picture.side * picture.tileSize;
    this.overview.position.set(0, extent * 0.9, extent * 0.62);
    this.overview.lookAt(0, 0, extent * 0.03);
  }

  private buildFloor(picture: WalkPicture): void {
    const key = `${picture.side}x${picture.tileSize}x${picture.levelHeight}x${picture.levels.join('')}`;
    if (key === this.builtFor) return;
    this.builtFor = key;
    for (const mesh of this.tileMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    const half = (picture.side * picture.tileSize) / 2;
    const grid = new SquareGrid(picture.side, picture.tileSize);
    this.buildSurroundings(half);
    this.tileMeshes = picture.tiles.map((_, tile) => {
      const top = (picture.levels[tile] ?? 0) * picture.levelHeight;
      const mesh = new THREE.Mesh(
        texturedBoxGeometry(picture.tileSize - TILE_GAP, top + TILE_BASE, picture.tileSize - TILE_GAP, TEXTURE_METERS),
        this.levelMaterial(picture.levels[tile] ?? 0),
      );
      const centre = grid.centreOf(tile);
      mesh.position.set(centre.x, (top - TILE_BASE) / 2, centre.z);
      this.scene.add(mesh);
      return mesh;
    });
  }

  /** The lava around the floor and the town behind it; both grow with the floor of the chosen size. */
  private buildSurroundings(halfFloor: number): void {
    for (const object of this.surroundings) this.scene.remove(object);
    const lavaHalf = halfFloor + LAVA_MARGIN;
    const lavaGeometry = new THREE.PlaneGeometry(lavaHalf * 2, lavaHalf * 2);
    setSurfaceUVs(lavaGeometry, TEXTURE_METERS * 3, true);
    const lava = new THREE.Mesh(lavaGeometry, this.lavaMaterial);
    lava.rotation.x = -Math.PI / 2;
    lava.position.y = LAVA_Y;
    this.lava = lava;
    const outside = lavaHalf + RIM_THICKNESS;
    const town = scatterSurroundings(SCENERY, {
      halfWidth: outside,
      halfDepth: outside,
      centreX: 0,
      centreZ: 0,
      reach: SCENERY_REACH_METERS,
      count: SCENERY_PIECES,
    });
    town.position.y = LAVA_Y - 0.05;
    this.surroundings = [lava, town, ...this.basinRim(lavaHalf)];
    this.scene.add(...this.surroundings);
  }

  /** A stone wall round the lava, so that the rising lava fills a basin instead of floating over the town. */
  private basinRim(lavaHalf: number): THREE.Mesh[] {
    const height = RIM_TOP - LAVA_Y;
    const length = (lavaHalf + RIM_THICKNESS) * 2;
    return [0, 1, 2, 3].map((side) => {
      const alongX = side < 2;
      const wall = new THREE.Mesh(
        texturedBoxGeometry(alongX ? length : RIM_THICKNESS, height, alongX ? RIM_THICKNESS : length, TEXTURE_METERS),
        this.rimMaterial,
      );
      const offset = (side % 2 === 0 ? -1 : 1) * (lavaHalf + RIM_THICKNESS / 2);
      wall.position.set(alongX ? 0 : offset, LAVA_Y + height / 2, alongX ? offset : 0);
      return wall;
    });
  }

  private levelMaterial(level: number): THREE.Material {
    return this.levelMaterials[Math.min(level, this.levelMaterials.length - 1)]!;
  }

  private showTile(tile: number, state: number): void {
    const mesh = this.tileMeshes[tile];
    if (!mesh) return;
    mesh.visible = state !== GONE;
    mesh.material = state === WARNING ? this.warning : this.levelMaterial(this.picture?.levels[tile] ?? 0);
  }

  /** Eases the shown cat towards where the game says it is, so that the 60 Hz steps do not show as stutter. */
  private easePose(slot: number, cat: CatPicture, frameSeconds: number): ShownPose {
    const pose = this.shown[slot]!;
    const { x, y, z, facing } = cat;
    if (!pose.started || Math.hypot(x - pose.x, z - pose.z) > TELEPORT_METERS) Object.assign(pose, { x, y, z, facing, started: true });
    pose.x = smoothTowards(pose.x, x, POSE_EASING, frameSeconds);
    pose.y = smoothTowards(pose.y, y, POSE_EASING, frameSeconds);
    pose.z = smoothTowards(pose.z, z, POSE_EASING, frameSeconds);
    pose.facing = smoothAngleTowards(pose.facing, facing, 18, frameSeconds);
    return pose;
  }

  private showCat(slot: number, picture: CatPicture | undefined, frameSeconds: number, own: boolean): void {
    const cat = this.cats[slot]!;
    const marker = this.markers[slot]!;
    const inGame = picture !== undefined && !picture.out;
    cat.object.visible = inGame;
    marker.visible = inGame;
    if (!inGame) return;
    const pose = this.easePose(slot, picture, frameSeconds);
    cat.object.position.set(pose.x, pose.y, pose.z);
    cat.object.rotation.y = -pose.facing;
    marker.position.set(pose.x, Math.max(pose.y, 0) + 0.06, pose.z);
    marker.scale.setScalar((own ? OWN_MARKER_SCALE : 1) * actionMarkerScale(picture));
    cat.update(frameSeconds, { isMoving: picture.speed > WALKING_SPEED, lateralSpeed: 0, boosting: picture.boosting });
  }
}
