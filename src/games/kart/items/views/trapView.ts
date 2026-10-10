import * as THREE from 'three';
import { itemLookOf, type CowpatLook } from '../../../../shared/config/itemLooks';
import type { MapConfig } from '../../maps/shared/mapConfig';
import type { Trap } from '../traps';
import { routeElevationAt } from '../../maps/shared/surface';

const TRAP_COLOR = 0xe0dccb;
const TRAP_RADIUS = 1.2;
const TRAP_HEIGHT = 1.4;
const WARNING_RING_COLOR = 0xff5a3c;
const WARNING_RING_INNER = TRAP_RADIUS * 1.15;
const WARNING_RING_OUTER = TRAP_RADIUS * 1.9;
const COWPAT_FLATTENING = 0.4;
const RING_HEIGHT_ABOVE_GROUND = 0.06;
/** Where the small heaps of the "droppings" look lie, in metres from the middle. */
const DROPPING_SPOTS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.9, 0.35],
  [-0.8, 0.45],
  [0.2, -0.9],
  [-0.4, -0.75],
];

interface TrapEntry {
  readonly group: THREE.Group;
  readonly cup: THREE.Mesh;
  readonly pat: THREE.Group;
  look: CowpatLook | null;
}

function lit(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}

function heap(look: CowpatLook): THREE.Object3D[] {
  const mound = new THREE.Mesh(new THREE.SphereGeometry(TRAP_RADIUS, 16, 10), lit(look.color));
  mound.scale.y = COWPAT_FLATTENING;
  mound.position.y = TRAP_RADIUS * COWPAT_FLATTENING;
  return [mound];
}

function droppings(look: CowpatLook): THREE.Object3D[] {
  return DROPPING_SPOTS.map(([x, z], index) => {
    const apple = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), lit(index % 2 === 0 ? look.color : look.accent));
    apple.scale.y = 0.8;
    apple.position.set(x, 0.38, z);
    return apple;
  });
}

/** A black puddle with a coloured sheen at its edge. */
function oil(look: CowpatLook): THREE.Object3D[] {
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(TRAP_RADIUS * 1.25, 24), new THREE.MeshBasicMaterial({ color: look.color }));
  const sheen = new THREE.Mesh(
    new THREE.RingGeometry(TRAP_RADIUS * 0.85, TRAP_RADIUS * 1.25, 24),
    new THREE.MeshBasicMaterial({ color: look.accent, transparent: true, opacity: 0.7 }),
  );
  for (const part of [puddle, sheen]) part.rotation.x = -Math.PI / 2;
  puddle.position.y = 0.04;
  sheen.position.y = 0.05;
  return [puddle, sheen];
}

const PAT_BUILDERS: Readonly<Record<CowpatLook['style'], (look: CowpatLook) => THREE.Object3D[]>> = { heap, droppings, oil };

/** Graybox placeholder for dropped traps ("Tasse vom Tisch") and cow pats: a small pool of groups, positioned/hidden each frame
 *  to match `traps`. A cup is a cylinder; a cow pat is dressed as the map wants (a flat heap, horse droppings, an oil puddle). */
export class TrapView {
  readonly object = new THREE.Group();
  private readonly entries: TrapEntry[] = [];
  private readonly cupGeometry = new THREE.CylinderGeometry(TRAP_RADIUS, TRAP_RADIUS * 0.8, TRAP_HEIGHT, 16);
  private readonly cupMaterial = lit(TRAP_COLOR);
  private readonly ringGeometry = new THREE.RingGeometry(WARNING_RING_INNER, WARNING_RING_OUTER, 32);
  private readonly ringMaterial = new THREE.MeshBasicMaterial({
    color: WARNING_RING_COLOR,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  update(map: MapConfig, traps: readonly Trap[]): void {
    while (this.entries.length < traps.length) this.addEntry();
    const look = itemLookOf(map, 'cowpat');
    this.entries.forEach((entry, index) => {
      const trap = traps[index];
      entry.group.visible = trap !== undefined;
      entry.group.userData.active = entry.group.visible;
      if (!trap) return;
      if (entry.look !== look) this.dress(entry, look);
      const cowpat = trap.kind === 'cowpat';
      entry.cup.visible = !cowpat;
      entry.pat.visible = cowpat;
      entry.group.userData.levelId = trap.levelId;
      entry.group.position.set(trap.x, trap.elevation ?? routeElevationAt(map, trap.x, trap.z, trap.levelId), trap.z);
    });
  }

  private addEntry(): void {
    const group = new THREE.Group();
    const cup = new THREE.Mesh(this.cupGeometry, this.cupMaterial);
    cup.position.y = TRAP_HEIGHT / 2;
    const ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = RING_HEIGHT_ABOVE_GROUND;
    const pat = new THREE.Group();
    group.add(cup, pat, ring);
    this.entries.push({ group, cup, pat, look: null });
    this.object.add(group);
  }

  private dress(entry: TrapEntry, look: CowpatLook): void {
    for (const part of [...entry.pat.children]) {
      entry.pat.remove(part);
      if (part instanceof THREE.Mesh) {
        part.geometry.dispose();
        part.material.dispose();
      }
    }
    entry.pat.add(...PAT_BUILDERS[look.style](look));
    entry.look = look;
  }
}
