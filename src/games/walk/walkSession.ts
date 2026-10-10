import { playerDisplayName } from '../../shared/i18n/labels';
import { roundForSnapshot, type EngineSession, type EngineSetup, type EngineSnapshot } from '../../shared/game/engine';
import { clockText, placesByStaying } from '../../shared/game/ranking';
import { seatToWatch } from '../../shared/game/spectate';
import { pressesMainAction, type InputFrame } from '../../shared/input/actions';
import { walkAiFrame } from './walkAi';
import { WalkFloor } from './walkFloor';
import { catRow } from './walkCatRow';
import { createFish } from './walkFish';
import { type WalkCat, type WalkIntent, NOT_OUT, worldMove, yawTowardsFacing } from './walkCat';
import { t as texts } from '../../shared/i18n';

/** The cats start on a ring this many tiles from the middle: on the flat tiles round the middle tile, never on the edge to a hill. */
const START_RING_TILES = 1;
/** How far a cat may sink into the lava before it is out. */
const LAVA_SINK = 0.4;
/** A cat steps onto ground up to this much higher by walking; a higher step is a wall (it has to jump), and so is the edge of a tile for a cat that sank below it. */
const STEP_UP = 0.3;
/** The HUD counts down to the rising lava from this many seconds. */
const FLOOD_COUNTDOWN_SECONDS = 10;
/** The camera only follows a cat that really moves. */
const CAMERA_FOLLOW_STICK = 0.3;
const PAW_LUNGE_SPEED = 11;
const BOOST_JUMP_FACTOR = 1.15;
const PAW_FLASH_SECONDS = 0.25;
/** The paw reaches a cat within 60 degrees either side of where the cat faces, and on about the same height. */
const PAW_REACH_COSINE = 0.5;
const PAW_REACH_HEIGHT = 1;

/** Boden ist Lava, on foot: cats run and jump over stepped hills on a floor that vanishes in rows and blocks while the lava rises level by level, eat fish
 *  for speed and hit each other off the steps with a paw. The last one above the lava wins. */
export function createWalkSession({ seats, rng, tuning }: EngineSetup): EngineSession {
  const t = tuning.walk;
  const floor = new WalkFloor(t, rng);
  const fish = createFish(floor, rng, t);
  const cats: WalkCat[] = seats.map((_, index) => {
    const angle = (index / seats.length) * Math.PI * 2;
    return {
      x: Math.cos(angle) * t.tileSize * START_RING_TILES,
      z: Math.sin(angle) * t.tileSize * START_RING_TILES,
      y: 0,
      vx: 0,
      vz: 0,
      vy: 0,
      facing: angle + Math.PI,
      grounded: true,
      outAt: NOT_OUT,
      yaw: angle - Math.PI / 2,
      boostLeft: 0,
      pawCooldownLeft: 0,
      stunLeft: 0,
      pawFlashLeft: 0,
      jumpHeld: false,
      pawHeld: false,
      watching: -1,
    };
  });
  let time = 0;
  let over = false;

  const alive = (): WalkCat[] => cats.filter((cat) => cat.outAt === NOT_OUT);

  const intent = (slot: number, cat: WalkCat, frame: InputFrame | undefined, dt: number): WalkIntent => {
    if (seats[slot]?.isAi) return walkAiFrame(cat, floor, alive(), fish.positions());
    cat.yaw += (frame?.look ?? 0) * t.lookTurnRate * dt;
    return {
      move: worldMove(frame?.move ?? { x: frame?.steer ?? 0, y: 0 }, cat.yaw),
      jump: pressesMainAction(frame),
      paw: (frame?.useItem ?? false) || (frame?.confirm ?? false),
    };
  };

  /** A cat that is out watches another one and switches to the next with the jump or the paw key. */
  const watchOthers = (cat: WalkCat, slot: number, frame: InputFrame | undefined): void => {
    const pressed = pressesMainAction(frame) || (frame?.useItem ?? false) || (frame?.confirm ?? false);
    const stillIn = cats.map((other) => other.outAt === NOT_OUT);
    cat.watching = seatToWatch(cat.watching, slot, stillIn, pressed && !cat.pawHeld);
    cat.pawHeld = pressed;
  };

  const steer = (cat: WalkCat, move: { x: number; y: number }, dt: number): void => {
    const length = Math.hypot(move.x, move.y);
    const scale = (length > 1 ? 1 / length : 1) * t.speed * (cat.boostLeft > 0 ? t.boostFactor : 1);
    const grip = t.acceleration * dt;
    cat.vx += Math.max(-grip, Math.min(grip, move.x * scale - cat.vx));
    cat.vz += Math.max(-grip, Math.min(grip, move.y * scale - cat.vz));
    if (length > 0.2) cat.facing = Math.atan2(move.y, move.x);
  };

  const jump = (cat: WalkCat, wanted: boolean): void => {
    if (wanted && !cat.jumpHeld && cat.grounded) {
      cat.vy = t.jumpSpeed * (cat.boostLeft > 0 ? BOOST_JUMP_FACTOR : 1);
      cat.grounded = false;
    }
    cat.jumpHeld = wanted;
  };

  /** The paw: a short lunge forward that sends every cat in front of it flying and stuns it for a moment. */
  const paw = (cat: WalkCat, wanted: boolean): void => {
    const pressed = wanted && !cat.pawHeld;
    cat.pawHeld = wanted;
    if (!pressed || cat.pawCooldownLeft > 0) return;
    cat.pawCooldownLeft = t.pawCooldownSeconds;
    cat.pawFlashLeft = PAW_FLASH_SECONDS;
    cat.vx += Math.cos(cat.facing) * PAW_LUNGE_SPEED;
    cat.vz += Math.sin(cat.facing) * PAW_LUNGE_SPEED;
    alive()
      .filter((other) => other !== cat && isInFront(cat, other))
      .forEach((other) => {
        other.vx = Math.cos(cat.facing) * t.pawKnockSpeed;
        other.vz = Math.sin(cat.facing) * t.pawKnockSpeed;
        other.stunLeft = t.pawStunSeconds;
      });
  };

  const isInFront = (cat: WalkCat, other: WalkCat): boolean => {
    const dx = other.x - cat.x;
    const dz = other.z - cat.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= 0 || distance >= t.pawRange || Math.abs(cat.y - other.y) >= PAW_REACH_HEIGHT) return false;
    const facingCosine = (dx * Math.cos(cat.facing) + dz * Math.sin(cat.facing)) / distance;
    return facingCosine > PAW_REACH_COSINE;
  };

  const countDown = (cat: WalkCat, dt: number): void => {
    cat.boostLeft = Math.max(cat.boostLeft - dt, 0);
    cat.pawCooldownLeft = Math.max(cat.pawCooldownLeft - dt, 0);
    cat.stunLeft = Math.max(cat.stunLeft - dt, 0);
    cat.pawFlashLeft = Math.max(cat.pawFlashLeft - dt, 0);
  };

  const run = (cat: WalkCat, slot: number, frame: InputFrame | undefined, dt: number): void => {
    countDown(cat, dt);
    const wanted = intent(slot, cat, frame, dt);
    if (cat.stunLeft > 0) return;
    steer(cat, wanted.move, dt);
    if (Math.hypot(wanted.move.x, wanted.move.y) > CAMERA_FOLLOW_STICK) cat.yaw = yawTowardsFacing(cat.yaw, cat.facing, t.cameraFollowRate * dt);
    jump(cat, wanted.jump);
    paw(cat, wanted.paw);
  };

  /** A higher step in the way stops a cat that is not high enough to get onto it; walking off a step down is fine (the cat falls). */
  const walk = (cat: WalkCat, dt: number): void => {
    const blocked = (x: number, z: number): boolean => floor.heightAt(x, z) > cat.y + STEP_UP;
    if (blocked(cat.x + cat.vx * dt, cat.z)) cat.vx = 0;
    else cat.x += cat.vx * dt;
    if (blocked(cat.x, cat.z + cat.vz * dt)) cat.vz = 0;
    else cat.z += cat.vz * dt;
  };

  /** The ground carries a cat that comes down on it; a cat that has sunk below the top of a tile (into a hole) keeps falling. */
  const fall = (cat: WalkCat, dt: number): void => {
    const ground = floor.heightAt(cat.x, cat.z);
    const wasAbove = cat.y >= ground - STEP_UP;
    cat.vy -= t.gravity * dt;
    cat.y += cat.vy * dt;
    cat.grounded = wasAbove && cat.y <= ground && cat.vy <= 0;
    if (cat.grounded) {
      cat.y = ground;
      cat.vy = 0;
    }
    if (cat.y < floor.lavaHeight() - LAVA_SINK) cat.outAt = time;
  };

  const floodLine = (): string => {
    const seconds = floor.secondsToFlood();
    const { status } = texts().games;
    return seconds !== null && seconds <= FLOOD_COUNTDOWN_SECONDS ? status.lavaRises(Math.ceil(seconds)) : status.tiles(floor.tilesLeft());
  };

  const shove = (first: WalkCat, second: WalkCat): void => {
    const dx = second.x - first.x;
    const dz = second.z - first.z;
    const distance = Math.hypot(dx, dz);
    if (distance >= t.catRadius * 2 || Math.abs(first.y - second.y) > 1) return;
    const nx = distance > 0 ? dx / distance : 1;
    const nz = distance > 0 ? dz / distance : 0;
    const overlap = (t.catRadius * 2 - distance) / 2;
    first.x -= nx * overlap;
    first.z -= nz * overlap;
    second.x += nx * overlap;
    second.z += nz * overlap;
    first.vx -= nx * t.shoveSpeed;
    first.vz -= nz * t.shoveSpeed;
    second.vx += nx * t.shoveSpeed;
    second.vz += nz * t.shoveSpeed;
  };

  const shoveAll = (): void => {
    const standing = alive();
    standing.forEach((first, index) => standing.slice(index + 1).forEach((second) => shove(first, second)));
  };

  return {
    step(frames, dt) {
      if (over) return;
      time += dt;
      floor.advance(time, dt);
      cats.forEach((cat, slot) => {
        if (cat.outAt !== NOT_OUT) {
          if (!seats[slot]?.isAi) watchOthers(cat, slot, frames[slot]);
          return;
        }
        run(cat, slot, frames[slot], dt);
        walk(cat, dt);
        fall(cat, dt);
      });
      shoveAll();
      fish.update(time, alive(), (cat) => {
        cat.boostLeft = t.boostSeconds;
      });
      over = alive().length <= (cats.length > 1 ? 1 : 0);
    },
    get over() {
      return over;
    },
    places: () => placesByStaying(cats.map((cat) => (cat.outAt === NOT_OUT ? null : cat.outAt))),
    detail: (slot) => {
      const { status } = texts().games;
      return cats[slot]!.outAt === NOT_OUT ? status.lastCat : status.fellAfter(clockText(cats[slot]!.outAt));
    },
    cardText: (slot) => {
      const { status } = texts().games;
      const cat = cats[slot]!;
      if (cat.outAt === NOT_OUT) return status.in;
      return cat.watching < 0 ? status.out : status.watching(playerDisplayName(seats[cat.watching]?.name ?? '', cat.watching));
    },
    statusLines: () => [texts().games.status.stillIn(alive().length), floodLine()],
    snapshot: (): EngineSnapshot => ({
      cats: cats.map(catRow),
      fish: fish.positions().map((spot) => [roundForSnapshot(spot.x), roundForSnapshot(spot.z), roundForSnapshot(floor.topOf(spot.tile))]),
      tiles: [...floor.states],
      levels: [...floor.levels],
      side: floor.side,
      tileSize: floor.tileSize,
      levelHeight: floor.levelHeight,
      lava: roundForSnapshot(floor.lavaHeight()),
    }),
  };
}
