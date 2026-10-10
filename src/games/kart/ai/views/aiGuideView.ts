import * as THREE from 'three';
import type { MapConfig } from '../../maps/shared/mapConfig';
import { PLAYER_APPEARANCES } from '../../../../shared/config/players';
import { kartElevationAt } from '../../maps/shared/surface';
import { aiGuideLine } from '../aiGuideLine';

export class AiGuideView {
  readonly object = new THREE.Group();

  get visibleSegmentCount(): number {
    return this.object.visible ? this.object.children.filter((segment) => segment.visible).length : 0;
  }

  constructor(map: MapConfig) {
    PLAYER_APPEARANCES.forEach((appearance, slot) => {
      const points = aiGuideLine(map, slot).points;
      for (let index = 0; index < points.length - (map.raceFormat === 'pointToPoint' ? 1 : 0); index += 1) {
        const from = points[index]!;
        const to = points[(index + 1) % points.length]!;
        const vertices = new Float32Array([
          from.x,
          kartElevationAt(map, { ...from, stairTransitionId: null }) + 0.6,
          from.z,
          to.x,
          kartElevationAt(map, { ...to, stairTransitionId: null }) + 0.6,
          to.z,
        ]);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: appearance.bodyColor, depthTest: false }));
        line.userData.levelId = from.levelId;
        line.userData.slot = slot;
        line.renderOrder = 20;
        this.object.add(line);
      }
    });
    this.object.visible = false;
  }

  show(visible: boolean, slots: readonly number[], levelId: string): void {
    this.object.visible = visible;
    if (!visible) return;
    for (const segment of this.object.children) {
      segment.visible = slots.includes(segment.userData.slot as number) && segment.userData.levelId === levelId;
    }
  }

  dispose(): void {
    for (const segment of this.object.children) {
      (segment as THREE.Line).geometry.dispose();
      ((segment as THREE.Line).material as THREE.Material).dispose();
    }
  }
}
