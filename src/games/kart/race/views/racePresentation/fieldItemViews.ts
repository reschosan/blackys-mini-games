import * as THREE from 'three';
import type { ItemConfig } from '../../../../../shared/config/items';
import { HairballView } from '../../../items/views/hairballView';
import { ItemBoxView } from '../../../items/views/itemBoxView';
import { TankFireView } from '../../../items/views/tankFireView';
import { TrapView } from '../../../items/views/trapView';
import { GravityBubbleView } from '../../../items/views/gravityBubbleView';
import { LaserView } from '../../../items/views/laserView';
import { VacuumView } from '../../../items/views/vacuumView';
import { showHouseLevel } from '../../../maps/familyHouse/view';
import type { MapConfig } from '../../../maps/shared/mapConfig';
import { disposeMapView } from '../../../maps/shared/view/mapView';
import type { RaceWorld } from '../../raceWorld';

/** Everything lying or flying on the track: item boxes and what the racers have thrown, laid or fired. */
export class FieldItemViews {
  readonly object = new THREE.Group();
  private itemBoxView: ItemBoxView;
  private readonly hairballView = new HairballView();
  private readonly trapView = new TrapView();
  private readonly laserView = new LaserView();
  private readonly gravityBubbleView = new GravityBubbleView();
  private readonly vacuumView = new VacuumView();
  private readonly tankFireView = new TankFireView();

  constructor(map: MapConfig) {
    this.itemBoxView = new ItemBoxView(map);
    this.object.add(
      this.itemBoxView.object,
      this.hairballView.object,
      this.trapView.object,
      this.laserView.object,
      this.gravityBubbleView.object,
      this.vacuumView.object,
      this.tankFireView.object,
    );
  }

  setMap(map: MapConfig): void {
    this.object.remove(this.itemBoxView.object);
    disposeMapView(this.itemBoxView.object);
    this.itemBoxView = new ItemBoxView(map);
    this.object.add(this.itemBoxView.object);
  }

  update(frameSeconds: number, map: MapConfig, world: RaceWorld, items: ItemConfig, hairballColors: readonly number[]): void {
    const { fieldItems } = world;
    this.itemBoxView.update(frameSeconds, world.itemBoxes);
    this.hairballView.update(map, world.hairballs, hairballColors);
    this.trapView.update(map, world.traps);
    this.laserView.update(frameSeconds, map, fieldItems.lasers);
    this.gravityBubbleView.update(frameSeconds, fieldItems.gravityBubbles, items, map);
    this.vacuumView.update(map, fieldItems.vacuumPulses, items);
    this.tankFireView.update(world.tankFire, items);
  }

  showLevel(levelId: string): void {
    for (const view of this.object.children) showHouseLevel(view, levelId);
  }
}
