import * as THREE from 'three';
import type { ItemConfig } from '../../../../shared/config/items';
import { itemLookOf, type GravityLook } from '../../../../shared/config/itemLooks';
import type { MapConfig } from '../../maps/shared/mapConfig';
import type { GravityBubble } from '../gravityBubbles';

const BASE_OPACITY = 0.42;
const PULSE_HZ = 0.8;
const FADE_OUT_SECONDS = 1.5;
const SWARM_SIZE = 6;
const CHICKEN_SCALE = 1.7;
const SWARM_ORBIT = 0.72;
const RUNE_COUNT = 6;
const SCAN_SECONDS = 1.4;

interface BubbleView {
  readonly group: THREE.Group;
  readonly dome: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  readonly rim: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  /** Parts that move with the time: chickens flying circles, runes turning, a scan line rising. */
  readonly animated: readonly THREE.Object3D[];
}

function basic(color: number, opacity = 1, wireframe = false): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false, side: THREE.DoubleSide, wireframe });
}

function chicken(index: number): THREE.Group {
  const bird = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.14), basic(0xfafafa));
  const comb = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.05), basic(0xd62828));
  comb.position.set(0, 0.07, 0.04);
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.05), basic(0xf2b21a));
  beak.position.set(0, 0.02, 0.095);
  bird.add(body, comb, beak);
  bird.scale.setScalar(CHICKEN_SCALE);
  bird.userData.phase = (index / SWARM_SIZE) * Math.PI * 2;
  return bird;
}

function rune(index: number, color: number): THREE.Mesh {
  const piece = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), basic(color, 0.95));
  piece.userData.phase = (index / RUNE_COUNT) * Math.PI * 2;
  return piece;
}

/** The gravity bubble: a translucent dome with a bright rim on the floor, breathing slowly and fading out in its last seconds. The map
 *  dresses it: a violet bubble, a swarm of chickens flying circles, a dome of runes, or a wireframe force field with a scan line. */
export class GravityBubbleView {
  readonly object = new THREE.Group();
  private readonly bubbles: BubbleView[] = [];
  private look: GravityLook | null = null;
  private elapsedSeconds = 0;

  update(frameSeconds: number, bubbles: readonly GravityBubble[], items: ItemConfig, map: MapConfig): void {
    this.adoptLook(itemLookOf(map, 'gravity'));
    this.elapsedSeconds += frameSeconds;
    while (this.bubbles.length < bubbles.length) this.addBubble();
    const breathing = 1 + 0.04 * Math.sin(this.elapsedSeconds * PULSE_HZ * Math.PI * 2);
    this.bubbles.forEach((view, index) => {
      const bubble = bubbles[index];
      view.group.visible = bubble !== undefined;
      view.group.userData.active = view.group.visible;
      if (!bubble) return;
      const fade = Math.min(bubble.secondsLeft / FADE_OUT_SECONDS, 1);
      view.group.userData.levelId = bubble.levelId;
      view.group.position.set(bubble.x, bubble.elevation, bubble.z);
      view.group.scale.setScalar(items.gravity.radiusMeters * breathing);
      view.dome.material.opacity = (this.look?.style === 'forcefield' ? 0.5 : BASE_OPACITY) * fade;
      view.rim.material.opacity = 0.9 * fade;
      this.animate(view);
    });
  }

  private adoptLook(look: GravityLook): void {
    if (look === this.look) return;
    this.look = look;
    for (const view of this.bubbles) this.discard(view);
    this.bubbles.length = 0;
  }

  private discard(view: BubbleView): void {
    this.object.remove(view.group);
    view.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      node.material.dispose();
    });
  }

  private addBubble(): void {
    const look = this.look!;
    const group = new THREE.Group();
    const wire = look.style === 'forcefield';
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), basic(look.color, BASE_OPACITY, wire));
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40), basic(look.accent, 0.9));
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.05;
    const animated = this.addExtras(group, look);
    group.add(dome, rim);
    group.visible = false;
    this.bubbles.push({ group, dome, rim, animated });
    this.object.add(group);
  }

  private addExtras(group: THREE.Group, look: GravityLook): THREE.Object3D[] {
    if (look.style === 'swarm') return Array.from({ length: SWARM_SIZE }, (_, index) => group.add(chicken(index)).children.at(-1)!);
    if (look.style === 'runes') return Array.from({ length: RUNE_COUNT }, (_, index) => group.add(rune(index, look.accent)).children.at(-1)!);
    if (look.style === 'forcefield') {
      const scan = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 6, 40).rotateX(Math.PI / 2), basic(look.accent));
      return [group.add(scan).children.at(-1)!];
    }
    return [];
  }

  private animate(view: BubbleView): void {
    const style = this.look?.style;
    const t = this.elapsedSeconds;
    view.animated.forEach((part) => {
      const phase = (part.userData.phase as number | undefined) ?? 0;
      if (style === 'swarm') this.flyChicken(part, phase + t * 1.9);
      else if (style === 'runes') this.turnRune(part, phase + t * 0.9);
      else this.raiseScanLine(part, t);
    });
  }

  private flyChicken(bird: THREE.Object3D, angle: number): void {
    bird.position.set(Math.cos(angle) * SWARM_ORBIT, 0.12 + 0.05 * Math.sin(angle * 3), Math.sin(angle) * SWARM_ORBIT);
    bird.rotation.y = -angle + Math.PI;
  }

  private turnRune(piece: THREE.Object3D, angle: number): void {
    piece.position.set(Math.cos(angle) * 0.6, 0.35 + 0.1 * Math.sin(angle * 2), Math.sin(angle) * 0.6);
    piece.rotation.y = angle * 2;
  }

  /** The scan line climbs the dome and starts over; it shrinks towards the top so it hugs the surface. */
  private raiseScanLine(line: THREE.Object3D, seconds: number): void {
    const height = (seconds % SCAN_SECONDS) / SCAN_SECONDS;
    line.position.y = height;
    line.scale.setScalar(Math.max(Math.sqrt(1 - height * height), 0.05));
  }
}
