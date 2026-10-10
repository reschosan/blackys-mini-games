import * as THREE from 'three';
import { texturedBoxGeometry, texturedMaterial } from '../../../../shared/effects/surfaceTextures';
import type { KartState } from '../../kart/kartState';
import type { ModeVisual } from '../rules/modeRules';

/** The sumo ring is a round rug in the living room. */
const PLATFORM_COLOR = 0xc0675a;
const PLATFORM_TEXTURE_REPEAT = 8;
const TILE_TEXTURE_METERS = 4;
const TILE_COLOR = 0x8fc293;
const TILE_WARNING_COLOR = 0xff8a2a;
const LINE_COLOR = 0xe8e8ee;
const TEAM_COLORS = [0xe0533d, 0x3d8fe0] as const;
const GOAL_HEIGHT = 3.6;
const GOAL_POST_RADIUS = 0.35;
const MAX_TEAM_RINGS = 8;
const FIELD_LINE_INSET = 1.2;
const CORNER_HEIGHT = 3.05;
const CORNER_TINT = 0xc9a98a;
const SURFACE_Y = 0.03;
const SOLID = 0;
const WARNING = 1;

type VisualKind = ModeVisual['kind'];

/** What a game puts on the arena besides the karts: the platform, the tiles, the field lines with the goals and the ball, the mark over the hunter.
 *  It only reads what the rules report and builds its parts when the kind of game changes. */
export class ModeVisualsView {
  readonly object = new THREE.Group();
  private kind: VisualKind = 'none';
  private shapeKey = '';
  private parts: { readonly update: (visual: ModeVisual, karts: readonly KartState[], frameSeconds: number) => void } | null = null;

  update(visual: ModeVisual, karts: readonly KartState[], frameSeconds: number): void {
    const key = this.keyOf(visual);
    if (visual.kind !== this.kind || key !== this.shapeKey) this.rebuild(visual, key);
    this.parts?.update(visual, karts, frameSeconds);
  }

  dispose(): void {
    this.clear();
  }

  /** Parts depend on sizes that cannot change while a game runs; a new game with other sizes builds them again. */
  private keyOf(visual: ModeVisual): string {
    if (visual.kind === 'tiles') return `${visual.tileSize}x${visual.tilesPerSide}`;
    if (visual.kind === 'field') return `${visual.width}x${visual.depth}x${visual.goalWidth}x${visual.cornerSize}`;
    return '';
  }

  private rebuild(visual: ModeVisual, key: string): void {
    this.clear();
    this.kind = visual.kind;
    this.shapeKey = key;
    this.parts = this.build(visual);
  }

  private clear(): void {
    this.object.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) material.dispose();
    });
    this.object.clear();
    this.parts = null;
  }

  private build(visual: ModeVisual): NonNullable<typeof this.parts> | null {
    switch (visual.kind) {
      case 'platform':
        return this.buildPlatform();
      case 'tiles':
        return this.buildTiles(visual);
      case 'field':
        return this.buildField(visual);
      case 'tag':
        return this.buildHunterMark();
      default:
        return null;
    }
  }

  private buildPlatform(): NonNullable<typeof this.parts> {
    const material = texturedMaterial('carpet', PLATFORM_COLOR);
    material.map?.repeat.set(PLATFORM_TEXTURE_REPEAT, PLATFORM_TEXTURE_REPEAT);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.4, 64), material);
    this.object.add(disc);
    return {
      update: (visual) => {
        if (visual.kind !== 'platform') return;
        disc.scale.set(visual.radius, 1, visual.radius);
        disc.position.y = SURFACE_Y - 0.2;
      },
    };
  }

  private buildTiles(visual: Extract<ModeVisual, { kind: 'tiles' }>): NonNullable<typeof this.parts> {
    const { tileSize, tilesPerSide } = visual;
    const half = (tilesPerSide * tileSize) / 2;
    const solid = texturedMaterial('tiles', TILE_COLOR);
    const warning = texturedMaterial('tiles', TILE_WARNING_COLOR);
    warning.emissive.set(TILE_WARNING_COLOR);
    warning.emissiveIntensity = 0.6;
    const geometry = texturedBoxGeometry(tileSize - 0.4, 0.4, tileSize - 0.4, TILE_TEXTURE_METERS);
    const tiles = Array.from({ length: tilesPerSide * tilesPerSide }, (_, tile) => {
      const mesh = new THREE.Mesh(geometry, solid);
      mesh.position.set(
        (tile % tilesPerSide) * tileSize - half + tileSize / 2,
        SURFACE_Y - 0.2,
        Math.floor(tile / tilesPerSide) * tileSize - half + tileSize / 2,
      );
      this.object.add(mesh);
      return mesh;
    });
    return {
      update: (next) => {
        if (next.kind !== 'tiles') return;
        tiles.forEach((mesh, tile) => {
          const state = next.states[tile] ?? SOLID;
          mesh.visible = state === SOLID || state === WARNING;
          mesh.material = state === WARNING ? warning : solid;
        });
      },
    };
  }

  private line(width: number, depth: number, x: number, z: number, color = LINE_COLOR): void {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth), new THREE.MeshBasicMaterial({ color }));
    mesh.position.set(x, SURFACE_Y, z);
    this.object.add(mesh);
  }

  private buildField(visual: Extract<ModeVisual, { kind: 'field' }>): NonNullable<typeof this.parts> {
    const { width, depth, goalWidth } = visual;
    this.line(width, 0.4, 0, -depth / 2 + FIELD_LINE_INSET);
    this.line(width, 0.4, 0, depth / 2 - FIELD_LINE_INSET);
    this.line(0.4, depth, -width / 2 + FIELD_LINE_INSET + 0.4, 0);
    this.line(0.4, depth, width / 2 - FIELD_LINE_INSET - 0.4, 0);
    this.line(0.4, depth, 0, 0);
    const circle = new THREE.Mesh(new THREE.RingGeometry(9, 9.4, 48), new THREE.MeshBasicMaterial({ color: LINE_COLOR, side: THREE.DoubleSide }));
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = SURFACE_Y;
    this.object.add(circle);
    this.goal(-width / 2, goalWidth, TEAM_COLORS[0]);
    this.goal(width / 2, goalWidth, TEAM_COLORS[1]);
    this.cornerSlants(width, depth, visual.cornerSize);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    this.object.add(ball);
    const teamRings = this.teamRings();
    return {
      update: (next, karts) => {
        if (next.kind !== 'field') return;
        ball.scale.setScalar(next.ballRadius);
        ball.position.set(next.ballX, next.ballRadius, next.ballZ);
        teamRings.forEach((ring, slot) => {
          const kart = karts[slot];
          ring.visible = kart !== undefined;
          if (kart) ring.position.set(kart.x, SURFACE_Y + 0.02, kart.z);
        });
      },
    };
  }

  /** The goal a team defends, in its colour: the goal line and two posts with a crossbar in the opening of the end wall. */
  private goal(x: number, goalWidth: number, color: number): void {
    this.line(1.2, goalWidth, x - Math.sign(x) * 0.6, 0, color);
    const material = new THREE.MeshLambertMaterial({ color });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(GOAL_POST_RADIUS, GOAL_POST_RADIUS, GOAL_HEIGHT, 12), material);
      post.position.set(x, GOAL_HEIGHT / 2, (side * goalWidth) / 2);
      this.object.add(post);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(GOAL_POST_RADIUS * 2, GOAL_POST_RADIUS * 2, goalWidth), material);
    bar.position.set(x, GOAL_HEIGHT, 0);
    this.object.add(bar);
  }

  /** The slanted blocks in the four corners, as high as the walls (the karts bump into a square block inside each). */
  private cornerSlants(width: number, depth: number, cornerSize: number): void {
    if (cornerSize <= 0) return;
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(cornerSize, 0), new THREE.Vector2(0, cornerSize)]);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: CORNER_HEIGHT, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    const material = texturedMaterial('planks', CORNER_TINT);
    material.side = THREE.DoubleSide;
    for (const sideX of [-1, 1]) {
      for (const sideZ of [-1, 1]) {
        const slant = new THREE.Mesh(geometry, material);
        slant.scale.set(-sideX, 1, sideZ);
        slant.position.set((sideX * width) / 2, 0, (sideZ * depth) / 2);
        this.object.add(slant);
      }
    }
  }

  /** A ring in the team colour under every kart, so everyone sees who plays with whom (team red: even seats, blue: odd seats). */
  private teamRings(): readonly THREE.Mesh[] {
    return Array.from({ length: MAX_TEAM_RINGS }, (_, slot) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.3, 32), new THREE.MeshBasicMaterial({ color: TEAM_COLORS[slot % 2]!, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
      this.object.add(ring);
      return ring;
    });
  }

  private buildHunterMark(): NonNullable<typeof this.parts> {
    const mark = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 12), new THREE.MeshBasicMaterial({ color: 0xff3b3b }));
    mark.rotation.x = Math.PI;
    this.object.add(mark);
    return {
      update: (visual, karts, frameSeconds) => {
        if (visual.kind !== 'tag') return;
        const hunter = karts[visual.hunterSlot];
        mark.visible = hunter !== undefined;
        if (!hunter) return;
        mark.position.set(hunter.x, 3.4, hunter.z);
        mark.rotation.y += frameSeconds * 3;
      },
    };
  }
}
