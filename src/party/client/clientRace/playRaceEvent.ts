import type { SoundEngine } from '../../../shared/audio/soundEngine';
import type { ItemConfig, ItemType } from '../../../shared/config/items';
import type { RacePresentation } from '../../../games/kart/race/views/racePresentation';
import type { RaceEvent } from '../../../games/kart/replication/raceSetup';
import type { RemoteRacer } from '../../../games/kart/replication/snapshotApply';

interface EventTargets {
  readonly sound: SoundEngine;
  readonly presentation: RacePresentation | null;
  readonly racers: readonly RemoteRacer[];
  readonly items: ItemConfig;
  readonly seat: number | undefined;
}

/** Sound and sparks for an event the host reports (the result page is not an effect and is handled by the caller). */
export function playRaceEvent(event: Exclude<RaceEvent, { type: 'results' }>, targets: EventTargets): void {
  const { sound, presentation, racers, items } = targets;
  switch (event.type) {
    case 'itemUsed': {
      sound.playItemUse(event.item as ItemType);
      const racer = racers[event.slot];
      if (racer && presentation) presentation.showItemBurst(racer.state, event.item as ItemType, items.itemFeedback.useBurstCount);
      break;
    }
    case 'itemPickedUp': {
      sound.playItemPickup();
      const racer = racers[event.slot];
      if (racer?.heldItem && presentation) presentation.showItemBurst(racer.state, racer.heldItem, items.itemFeedback.pickupBurstCount);
      break;
    }
    case 'collision':
      if (event.slot === targets.seat) sound.playCollision();
      break;
    case 'tankShot':
      sound.playTankShot();
      break;
    case 'explosion':
      sound.playExplosion();
      break;
    case 'countdownBeep':
      sound.playCountdownBeep();
      break;
    case 'go':
      sound.playGo();
      break;
  }
}
