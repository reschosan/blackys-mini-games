import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { assetUrl } from '../config/assets';

export type SceneryThemeId = 'nature' | 'town' | 'farm';

interface SceneryTheme {
  readonly folder: string;
  readonly files: readonly string[];
  /** The longest side of one piece is drawn this long (metres), a random size in between. */
  readonly size: readonly [number, number];
  /** The ground around the play area. */
  readonly ground: number;
}

/** The models are the packs of the maps (`public/models`, Quaternius, CC0, see `docs/CREDITS.md`). */
const THEMES: Readonly<Record<SceneryThemeId, SceneryTheme>> = {
  nature: {
    folder: 'nature-pack',
    files: ['Pine Trees', 'Birch Trees', 'Maple Trees', 'Bushes', 'Flower Bushes', 'Flowers'],
    size: [12, 22],
    ground: 0x4f7a45,
  },
  town: {
    folder: 'town-pack',
    files: [
      'House-RSwoYSLblu',
      'House-k6tP5nFUd2',
      'House-vZ1CLbWmSx',
      'Houses-gEjAC1UvVU',
      'Houses-vCoDG5hFyI',
      'Tower House',
      'Stone Tower',
      'Village Market',
    ],
    size: [14, 26],
    ground: 0x7a7468,
  },
  farm: {
    folder: 'farm-pack',
    files: ['Barn', 'Big Barn', 'Small Barn', 'Silo', 'Silo House', 'Tower Windmill', 'ChickenCoop', 'Open Barn'],
    size: [12, 22],
    ground: 0x6c8a4a,
  },
};

const loader = new GLTFLoader();
const loaded = new Map<string, Promise<THREE.Object3D>>();

function modelOf(theme: SceneryTheme, file: string): Promise<THREE.Object3D> {
  const url = assetUrl(`models/${theme.folder}/${file}.glb`);
  let model = loaded.get(url);
  if (!model) {
    model = loader.loadAsync(url).then((gltf) => gltf.scene);
    loaded.set(url, model);
  }
  return model;
}

export function sceneryGround(theme: SceneryThemeId): number {
  return THEMES[theme].ground;
}

/** The point at `angle` on the rectangle that lies `rim` metres outside the play area. */
function onRectangleAround(area: SceneryArea, angle: number, rim: number): readonly [number, number] {
  const reachX = area.halfWidth + rim;
  const reachZ = area.halfDepth + rim;
  const scale = 1 / Math.max(Math.abs(Math.cos(angle)) / reachX, Math.abs(Math.sin(angle)) / reachZ);
  return [area.centreX + Math.cos(angle) * scale, area.centreZ + Math.sin(angle) * scale];
}

const GAP_METERS = 6;

/** Where a piece of `longest` metres stands: `spread` metres beyond the gap around the play area, far enough that it never reaches in, however it is turned. */
export function sceneryPieceCentre(area: SceneryArea, angle: number, longest: number, spread: number): readonly [number, number] {
  return onRectangleAround(area, angle, longest * Math.SQRT1_2 + GAP_METERS + spread);
}

export interface SceneryArea {
  /** Half the width and depth of the play area; nothing stands inside it. */
  readonly halfWidth: number;
  readonly halfDepth: number;
  readonly centreX: number;
  readonly centreZ: number;
  /** How far beyond the play area the pieces stand (metres). */
  readonly reach: number;
  readonly count: number;
}

/** Pieces of a theme scattered over a ring around the play area, at random places and turns each time a game starts (only looks: `Math.random` is fine here).
 *  Every piece turns about its own middle and keeps half its size clear of the play area, so nothing reaches into it.
 *  The group fills in as the models arrive; a model that does not load is just left out. */
export function scatterSurroundings(themeId: SceneryThemeId, area: SceneryArea): THREE.Group {
  const theme = THEMES[themeId];
  const group = new THREE.Group();
  for (let piece = 0; piece < area.count; piece += 1) {
    const file = theme.files[Math.floor(Math.random() * theme.files.length)]!;
    const longest = theme.size[0] + Math.random() * (theme.size[1] - theme.size[0]);
    const angle = Math.random() * Math.PI * 2;
    const [x, z] = sceneryPieceCentre(area, angle, longest, Math.random() * area.reach);
    void modelOf(theme, file)
      .then((source) => {
        const model = source.clone(true);
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const scale = longest / Math.max(size.x, size.z, 0.001);
        model.scale.setScalar(scale);
        model.position.set(-(box.min.x + size.x / 2) * scale, -box.min.y * scale, -(box.min.z + size.z / 2) * scale);
        const piece = new THREE.Group();
        piece.position.set(x, 0, z);
        piece.rotation.y = Math.random() * Math.PI * 2;
        piece.add(model);
        group.add(piece);
      })
      .catch(() => undefined);
  }
  return group;
}
