import type { DrivingConfig } from '../../../shared/config/driving';
import type { ItemConfig, ItemType } from '../../../shared/config/items';
import type { KartLoadout } from '../../../shared/config/kartLoadout';
import type { MapConfig } from '../maps/shared/mapConfig';
import type { Rng } from '../../../shared/core/rng';
import type { InputFrame } from '../../../shared/input/actions';
import { activateBoost } from '../kart/boost';
import { activateCatnip, stepCatnip, withCatnipWobble } from '../items/catnip';
import type { FieldItems } from '../items/fieldItems';
import { spawnGravityBubble, stepGravityBubbles } from '../items/gravityBubbles';
import { spawnLaserDot, stepLaserDots, withLaserLure } from '../items/lasers';
import { fireVacuum, stepVacuumPulses } from '../items/vacuum';
import { stepAllKarts } from '../kart/kartSimulation';
import { shove, type ShoveConfig } from '../kart/kartShove';
import type { KartDriveFactors, KartState } from '../kart/kartState';
import { stepBoostFields } from '../maps/shared/boostFields';
import { spawnHairball, stepHairballs, type Hairball } from '../items/hairballs';
import { stepItemBoxes, type ItemBoxState } from '../items/itemBoxes';
import { stepTankFire, type TankExplosion, type TankFire } from '../items/tankFire';
import { spawnTrap, stepTraps, type Trap } from '../items/traps';
import { placeByKart, rankKarts, updateProgress, type KartProgress } from './raceState';

export interface RaceParticipant {
  readonly state: KartState;
  readonly progress: KartProgress;
  heldItem: ItemType | null;
  previousUseItem: boolean;
  loadout?: KartLoadout;
}

export interface RaceStep {
  readonly map: MapConfig;
  readonly driving: DrivingConfig;
  readonly items: ItemConfig;
  readonly participants: readonly RaceParticipant[];
  readonly frames: readonly InputFrame[];
  readonly driveFactors?: readonly KartDriveFactors[];
  readonly hairballs: Hairball[];
  readonly traps: Trap[];
  readonly fieldItems: FieldItems;
  readonly tankFire?: TankFire;
  readonly itemBoxes: readonly ItemBoxState[];
  /** False in a mode without items: boxes stay as they are and the tank does not shoot. */
  readonly itemsEnabled?: boolean;
  /** Set in a game where the item button shoves the kart ahead instead. */
  readonly shove?: ShoveConfig;
  /** False in a game with its own rules (an arena has no laps): progress and ranking are left to the rules. */
  readonly ranking?: boolean;
  readonly places: readonly number[];
  readonly rng: Rng;
  readonly lapCount: number;
  readonly raceTimeSeconds: number;
  readonly stepSeconds: number;
}

export interface RaceFeedback {
  readonly afterPhysics?: () => void;
  readonly itemUsed?: (item: ItemType, participantIndex: number) => void;
  readonly itemsChanged?: (previousItems: readonly (ItemType | null)[]) => void;
  readonly tankFired?: (participantIndex: number) => void;
  readonly tankShellDetonated?: (explosion: TankExplosion) => void;
  readonly shoved?: (shoverIndex: number, targetIndex: number) => void;
}

const GROUND_ITEMS: readonly ItemType[] = ['trap', 'gravity', 'cowpat'];

function pressItemButton(step: RaceStep, participant: RaceParticipant, index: number, feedback: RaceFeedback): void {
  const pressed = step.frames[index]?.useItem ?? false;
  const justPressed = pressed && !participant.previousUseItem;
  participant.previousUseItem = pressed;
  if (!justPressed) return;
  if (step.shove) shoveAhead(step, step.shove, index, feedback);
  else useHeldItem(step, participant, index, feedback);
}

function shoveAhead(step: RaceStep, config: ShoveConfig, index: number, feedback: RaceFeedback): void {
  const stillIn = step.participants.filter((participant) => !participant.progress.finished).map((participant) => participant.state);
  const shover = step.participants[index]!.state;
  if (!stillIn.includes(shover)) return;
  const target = shove(shover, stillIn, config);
  if (target)
    feedback.shoved?.(
      index,
      step.participants.findIndex((participant) => participant.state === target),
    );
}

function useHeldItem(step: RaceStep, participant: RaceParticipant, index: number, feedback: RaceFeedback): void {
  if (participant.heldItem === null || participant.state.penaltySecondsLeft > 0) return;
  const item = participant.heldItem;
  if (GROUND_ITEMS.includes(item) && (participant.state.windowJumpId !== null || participant.state.stairTransitionId !== null)) return;
  applyItem(step, participant, index, item);
  feedback.itemUsed?.(item, index);
  participant.heldItem = null;
}

function applyItem(step: RaceStep, participant: RaceParticipant, index: number, item: ItemType): void {
  switch (item) {
    case 'boost':
      activateBoost(participant.state, step.items.boost.durationSeconds);
      break;
    case 'hairball':
      step.hairballs.push(spawnHairball(participant.state, index, step.items, step.map));
      break;
    case 'nap':
      participant.state.shieldSecondsLeft = step.items.nap.shieldSeconds;
      break;
    case 'trap':
      step.traps.push(spawnTrap(participant.state, index, step.items, step.map));
      break;
    case 'cowpat':
      step.traps.push(spawnTrap(participant.state, index, step.items, step.map, 'cowpat'));
      break;
    case 'catnip':
      activateCatnip(participant.state, step.items);
      break;
    case 'laser':
      step.fieldItems.lasers.push(spawnLaserDot(participant.state, index, step.items));
      break;
    case 'yarn':
      step.hairballs.push(spawnHairball(participant.state, index, step.items, step.map, 'yarn'));
      break;
    case 'vacuum':
      step.fieldItems.vacuumPulses.push(
        fireVacuum(
          participant.state,
          index,
          step.participants.map((other) => other.state),
          step.items,
        ),
      );
      break;
    case 'gravity':
      step.fieldItems.gravityBubbles.push(spawnGravityBubble(participant.state, index, step.items, step.map));
      break;
  }
}

function itemSteeredFrames(step: RaceStep): readonly InputFrame[] {
  return step.frames.map((frame, index) => {
    const state = step.participants[index]?.state;
    if (!state) return frame;
    return withLaserLure(withCatnipWobble(frame, state, step.items), state, index, step.fieldItems.lasers, step.items);
  });
}

/** Laps, checkpoints and the order of the karts along the course. */
function rankRace(step: RaceStep): readonly number[] {
  for (const participant of step.participants) {
    updateProgress(step.map, step.lapCount, participant.progress, participant.state.x, participant.state.z, step.raceTimeSeconds, participant.state.levelId);
  }
  return placeByKart(
    rankKarts(
      step.map,
      step.participants.map((participant) => ({
        progress: participant.progress,
        x: participant.state.x,
        z: participant.state.z,
      })),
    ),
  );
}

export function stepRaceSimulation(step: RaceStep, feedback: RaceFeedback = {}): readonly number[] {
  const states = step.participants.map((participant) => participant.state);
  step.participants.forEach((participant, index) => {
    participant.state.leading = step.places[index] === 1;
  });
  stepAllKarts(
    step.driving,
    step.map,
    states,
    itemSteeredFrames(step),
    step.stepSeconds,
    step.driveFactors,
    step.participants.map((participant) => !participant.progress.finished),
  );
  feedback.afterPhysics?.();
  const previousItems = step.participants.map((participant) => participant.heldItem);
  step.participants.forEach((participant, index) => pressItemButton(step, participant, index, feedback));
  for (const state of states) stepBoostFields(step.map, state);
  stepHairballs(step.hairballs, step.items, step.map, states, step.stepSeconds);
  stepTraps(step.traps, step.items, states, step.map);
  states.forEach((state) => stepCatnip(state, step.stepSeconds));
  stepLaserDots(step.fieldItems.lasers, step.map, step.stepSeconds);
  stepGravityBubbles(step.fieldItems.gravityBubbles, step.items, step.map, states, step.stepSeconds);
  stepVacuumPulses(step.fieldItems.vacuumPulses, step.items, step.stepSeconds);
  const itemsEnabled = step.itemsEnabled ?? true;
  if (step.tankFire && itemsEnabled) {
    stepTankFire(step.tankFire, step.items, step.map, step.participants, step.places, step.rng, step.stepSeconds, {
      ...(feedback.tankFired ? { fired: feedback.tankFired } : {}),
      ...(feedback.tankShellDetonated ? { detonated: feedback.tankShellDetonated } : {}),
    });
  }
  if (itemsEnabled) stepItemBoxes(step.map, step.itemBoxes, step.items, step.participants, step.places, step.rng, step.stepSeconds);
  feedback.itemsChanged?.(previousItems);
  return step.ranking === false ? step.places : rankRace(step);
}
