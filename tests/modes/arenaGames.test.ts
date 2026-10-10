import { describe, expect, it } from 'vitest';
import { createAiDriverState } from '../../src/games/kart/ai/aiDriver';
import { raceDriveFactors, raceInputFrames } from '../../src/games/kart/ai/raceAiInput';
import { DEFAULT_AI } from '../../src/shared/config/ai';
import { DEFAULT_AI_DIFFICULTY } from '../../src/shared/config/aiDifficulty';
import { createRuntimeDriving } from '../../src/shared/config/driving';
import { createRuntimeItems } from '../../src/shared/config/items';
import { createKartLoadout } from '../../src/shared/config/kartLoadout';
import { createRuntimeModes } from '../../src/shared/config/modes';
import { createKartState } from '../../src/games/kart/kart/kartState';
import { AVAILABLE_MAPS } from '../../src/games/kart/maps/registry';
import { createArenaMap } from '../../src/games/kart/modes/arena/arenaMaps';
import { KART_MODES, type KartMode } from '../../src/games/kart/modes/kartModes';
import { createRng } from '../../src/shared/core/rng';
import type { RacePlayer } from '../../src/games/kart/race/racePlayer';
import { createProgress } from '../../src/games/kart/race/raceState';
import { stepRaceSimulation } from '../../src/games/kart/race/raceSimulation';
import { createRaceWorld } from '../../src/games/kart/race/raceWorld';
import { RulesRunner } from '../../src/party/app/game/rulesRunner';
import { sumoShove } from '../../src/games/kart/modes/rules/sumo';

const STEP = 1 / 60;
const MAX_SECONDS = 400;
const KARTS = 4;

function aiPlayers(map: ReturnType<typeof createArenaMap>): RacePlayer[] {
  return map.startPositions.slice(0, KARTS).map((start, slot) => ({
    state: createKartState(start.x, start.z, start.yaw),
    progress: createProgress(start.x, start.z),
    heldItem: null,
    previousUseItem: false,
    isAi: true,
    loadout: createKartLoadout(slot),
    aiDriver: createAiDriverState(slot),
    difficulty: 'medium' as const,
    raceStartEarlyPress: false,
    raceStartBoostEarned: false,
  }));
}

/** Four AI karts play one game of `mode` as the session would: arena frames, physics, then the rules. Returns the runner and the seconds it took. */
function playWithAi(
  mode: KartMode,
  seed: number,
): { readonly runner: RulesRunner; readonly seconds: number; readonly itemsHeld: number; readonly shoves: number } {
  const tuning = createRuntimeModes();
  const map = mode.arena ? createArenaMap(mode.arena, tuning) : AVAILABLE_MAPS[0]!;
  const players = aiPlayers(map);
  const world = createRaceWorld(map, mode.itemsEnabled);
  const driving = createRuntimeDriving();
  const items = createRuntimeItems(map.itemOverrides);
  const runner = new RulesRunner({
    sessionSeed: seed,
    players,
    world,
    currentMap: () => map,
    currentMode: () => mode,
    tuning,
    aiDifficulty: DEFAULT_AI_DIFFICULTY,
    ai: DEFAULT_AI,
  });
  runner.create(1);
  const rules = runner.rules!;
  let seconds = 0;
  let itemsHeld = 0;
  let shoves = 0;
  while (!rules.over && seconds < MAX_SECONDS) {
    seconds += STEP;
    world.raceTimeSeconds = seconds;
    const frames = mode.arena ? runner.arenaFrames([]) : raceInputFrames(players, [], map, DEFAULT_AI, DEFAULT_AI_DIFFICULTY, driving, STEP);
    const before = players.map((player) => Math.hypot(player.state.velocityX, player.state.velocityZ));
    world.places = stepRaceSimulation(
      {
        map,
        driving,
        items,
        participants: players,
        frames,
        driveFactors: raceDriveFactors(players, DEFAULT_AI_DIFFICULTY),
        hairballs: world.hairballs,
        traps: world.traps,
        fieldItems: world.fieldItems,
        itemBoxes: world.itemBoxes,
        itemsEnabled: mode.itemsEnabled,
        ...(mode.shove ? { shove: sumoShove(tuning.sumo) } : {}),
        ranking: !mode.arena,
        places: world.places,
        rng: createRng(1),
        lapCount: 99,
        raceTimeSeconds: seconds,
        stepSeconds: STEP,
      },
      { shoved: () => (shoves += 1) },
    );
    runner.afterStep(before, STEP);
    itemsHeld += players.filter((player) => player.heldItem !== null).length;
  }
  return { runner, seconds, itemsHeld, shoves };
}

describe('four AI karts play every game on the kart engine to its end', () => {
  it.each(KART_MODES.filter((mode) => mode.createRules !== null).map((mode) => [mode.title, mode] as const))('%s', (_title, mode) => {
    const { runner, seconds } = playWithAi(mode, 3);
    expect(runner.rules!.over).toBe(true);
    expect(seconds).toBeLessThan(MAX_SECONDS);
    const places = runner.rules!.places();
    expect(places).toHaveLength(KARTS);
    expect(places.every((place) => place >= 1 && place <= KARTS)).toBe(true);
    expect(places).toContain(1);
  });

  it('tag: the karts collect items from the boxes on the ground', () => {
    const mode = KART_MODES.find((candidate) => candidate.id === 'tag')!;
    expect(mode.itemsEnabled).toBe(true);
    expect(playWithAi(mode, 3).itemsHeld).toBeGreaterThan(0);
  });

  it('sumo: no items, the AI karts shove each other with the item button instead', () => {
    const sumo = KART_MODES.find((candidate) => candidate.id === 'sumo')!;
    const { itemsHeld, shoves } = playWithAi(sumo, 3);
    expect(itemsHeld).toBe(0);
    expect(shoves).toBeGreaterThan(0);
  });

  it('is the same game for the same seed', () => {
    const sumo = KART_MODES.find((mode) => mode.id === 'sumo')!;
    expect(playWithAi(sumo, 5).runner.rules!.toExtras()).toEqual(playWithAi(sumo, 5).runner.rules!.toExtras());
  });

  it('takes a kart that is out out of the game: hidden, stopped, finished', () => {
    const sumo = KART_MODES.find((mode) => mode.id === 'sumo')!;
    const { runner } = playWithAi(sumo, 3);
    const rules = runner.rules!;
    const out = [0, 1, 2, 3].filter((slot) => rules.isOut(slot));
    expect(out.length).toBeGreaterThanOrEqual(3);
  });
});
