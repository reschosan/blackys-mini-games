import * as THREE from 'three';
import type { ItemConfig } from '../../../../shared/config/items';
import { itemLookOf, type VacuumLook, type VacuumStyle } from '../../../../shared/config/itemLooks';
import { routeElevationAt } from '../../maps/shared/surface';
import type { MapConfig } from '../../maps/shared/mapConfig';
import type { VacuumPulse } from '../vacuum';

const START_RANGE_SHARE = 0.25;
const RINGS_BY_STYLE: Readonly<Record<VacuumStyle, number>> = { rings: 3, swirl: 3, stripes: 5 };
const SWIRL_WOBBLE_RADIANS = 0.28;
const SWIRL_HERTZ = 1.6;

type SectorMesh = THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;

/** The vacuum's suction cone: a flat sector that sweeps inward from the cone's tip toward the
 *  user while fading, repeated as a few rings; a mesh pool matching `pulses`. The map picks the colours and the style (plain rings,
 *  a swirl that wobbles, stripes in two colours). */
export class VacuumView {
  readonly object = new THREE.Group();
  private readonly pulses: THREE.Group[] = [];
  private look: VacuumLook | null = null;

  update(map: MapConfig, pulses: readonly VacuumPulse[], items: ItemConfig): void {
    this.adoptLook(itemLookOf(map, 'vacuum'));
    while (this.pulses.length < pulses.length) this.addPulse();
    this.pulses.forEach((group, index) => {
      const pulse = pulses[index];
      group.visible = pulse !== undefined;
      group.userData.active = group.visible;
      if (pulse) this.place(group, map, pulse, items);
    });
  }

  /** A different map brings a different look: the pool starts over. */
  private adoptLook(look: VacuumLook): void {
    if (look === this.look) return;
    this.look = look;
    for (const group of this.pulses) {
      this.object.remove(group);
      group.children.forEach((child) => {
        (child as SectorMesh).geometry.dispose();
        (child as SectorMesh).material.dispose();
      });
    }
    this.pulses.length = 0;
  }

  private addPulse(): void {
    const look = this.look!;
    const group = new THREE.Group();
    for (let ring = 0; ring < RINGS_BY_STYLE[look.style]; ring += 1) {
      const color = look.style === 'stripes' && ring % 2 === 1 ? look.accent : look.color;
      const sector = new THREE.Mesh(
        new THREE.CircleGeometry(1, 20, 0, 1),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
      );
      sector.rotation.x = -Math.PI / 2;
      group.add(sector);
    }
    group.visible = false;
    this.pulses.push(group);
    this.object.add(group);
  }

  private place(group: THREE.Group, map: MapConfig, pulse: VacuumPulse, items: ItemConfig): void {
    const { coneHalfAngleRadians, rangeMeters, pulseVisibleSeconds } = items.vacuum;
    const progress = Math.min(pulse.ageSeconds / pulseVisibleSeconds, 1);
    const rings = group.children.length;
    group.userData.levelId = pulse.levelId;
    group.position.set(pulse.x, routeElevationAt(map, pulse.x, pulse.z, pulse.levelId) + 0.12, pulse.z);
    group.rotation.y = -pulse.yaw;
    group.children.forEach((child, ring) => {
      const sector = child as SectorMesh;
      if (sector.userData.halfAngle !== coneHalfAngleRadians) this.rebuildSector(sector, coneHalfAngleRadians);
      const ringProgress = (progress + ring / rings) % 1;
      sector.scale.setScalar(rangeMeters * (1 - ringProgress * (1 - START_RANGE_SHARE)));
      sector.material.opacity = 0.85 * ringProgress * (1 - progress);
      sector.rotation.z = this.look?.style === 'swirl' ? Math.sin(pulse.ageSeconds * SWIRL_HERTZ * Math.PI * 2 + ring * 2) * SWIRL_WOBBLE_RADIANS : 0;
    });
  }

  private rebuildSector(sector: SectorMesh, halfAngle: number): void {
    sector.geometry.dispose();
    sector.geometry = new THREE.CircleGeometry(1, 24, -halfAngle, halfAngle * 2);
    sector.userData.halfAngle = halfAngle;
  }
}
