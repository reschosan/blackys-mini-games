import * as THREE from 'three';
import type { MapConfig } from '../../maps/shared/mapConfig';
import { laserDotElevation, type LaserDot } from '../lasers';

const DOT_COLOR = 0xff1f2e;
const DOT_RADIUS = 0.55;
const GLOW_RADIUS = 1.8;
const PULSE_HZ = 6;

/** The laser pointer's red dot with a soft glow disc, pulsing; a mesh pool matching `lasers`. */
export class LaserView {
  readonly object = new THREE.Group();
  private readonly dots: THREE.Group[] = [];
  private readonly dotGeometry = new THREE.SphereGeometry(DOT_RADIUS, 12, 8);
  private readonly glowGeometry = new THREE.CircleGeometry(GLOW_RADIUS, 20);
  private readonly dotMaterial = new THREE.MeshBasicMaterial({ color: DOT_COLOR });
  private readonly glowMaterial = new THREE.MeshBasicMaterial({ color: DOT_COLOR, transparent: true, opacity: 0.5, depthWrite: false });
  private elapsedSeconds = 0;

  update(frameSeconds: number, map: MapConfig, lasers: readonly LaserDot[]): void {
    this.elapsedSeconds += frameSeconds;
    while (this.dots.length < lasers.length) this.addDot();
    const pulse = 1 + 0.25 * Math.sin(this.elapsedSeconds * PULSE_HZ * Math.PI * 2);
    this.dots.forEach((group, index) => {
      const dot = lasers[index];
      group.visible = dot !== undefined;
      group.userData.active = group.visible;
      if (!dot) return;
      group.userData.levelId = dot.levelId;
      group.position.set(dot.x, laserDotElevation(map, dot) + DOT_RADIUS * 0.6, dot.z);
      group.scale.setScalar(pulse);
    });
  }

  private addDot(): void {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(this.dotGeometry, this.dotMaterial));
    const glow = new THREE.Mesh(this.glowGeometry, this.glowMaterial);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -DOT_RADIUS * 0.5;
    group.add(glow);
    group.visible = false;
    this.dots.push(group);
    this.object.add(group);
  }
}
