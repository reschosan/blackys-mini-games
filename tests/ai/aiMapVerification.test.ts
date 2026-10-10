import { AI_DIFFICULTIES } from '../../src/shared/config/aiDifficulty';
import { createKartLoadout } from '../../src/shared/config/kartLoadout';
import { AVAILABLE_MAPS } from '../../src/games/kart/maps/registry';
import { FARM } from '../../src/games/kart/maps/farm/map';
import { TOWN } from '../../src/games/kart/maps/town/map';
import { CITY } from '../../src/games/kart/maps/city/map';
import { describe, expect, it } from 'vitest';
import { MAX_RACE_SECONDS, nextTask, RACE_COUNT, runAiRace } from './support/aiRaceHarness';

describe('AI map verification', () => {
  it.each(AVAILABLE_MAPS)(
    '$name preserves the seeded race baseline',
    (map) => {
      expect(runAiRace(map, 1)).toMatchSnapshot();
    },
    15000,
  );

  it.each(AVAILABLE_MAPS)(
    '$name runs 20 all-AI races without a stuck kart',
    async (map) => {
      for (let race = 1; race <= RACE_COUNT; race += 1) {
        const result = runAiRace(map, race);
        expect(result.valid, `Seed ${race}: ${JSON.stringify(result.racers)}`).toBe(true);
        if (map.levels)
          for (const racer of result.racers) expect(racer.finishTimeSeconds, `Seed ${race}: minimum house race duration`).toBeGreaterThanOrEqual(45);
        await nextTask();
      }
    },
    30000,
  );

  it.each(AVAILABLE_MAPS)(
    '$name runs 20 races with three independently guided AI karts',
    async (map) => {
      for (let race = 1; race <= RACE_COUNT; race += 1) {
        const result = runAiRace(map, race, 1);
        expect(result.valid, `Seed ${race}: ${JSON.stringify(result.racers)}`).toBe(true);
        await nextTask();
      }
    },
    30000,
  );

  it.each(AVAILABLE_MAPS.filter((map) => map.levels))(
    '$name finishes every AI kart within 105 seconds on each difficulty',
    (map) => {
      const late: string[] = [];
      const early: string[] = [];
      for (const difficulty of AI_DIFFICULTIES) {
        for (let seed = 1; seed <= RACE_COUNT; seed += 1) {
          const result = runAiRace(map, seed, 0, difficulty, 180);
          result.racers.forEach((racer, slot) => {
            if (racer.finishTimeSeconds === null || racer.finishTimeSeconds > 105)
              late.push(`${difficulty} seed ${seed} slot ${slot}: ${racer.finishTimeSeconds ?? 'DNF'}`);
            if (map.levels && racer.finishTimeSeconds !== null && racer.finishTimeSeconds < 70)
              early.push(`${difficulty} seed ${seed} slot ${slot}: ${racer.finishTimeSeconds}`);
          });
        }
      }
      expect(late.slice(0, 20), `${late.length} late finishes`).toEqual([]);
      expect(early.slice(0, 20), `${early.length} early finishes`).toEqual([]);
    },
    30000,
  );

  it.each(AVAILABLE_MAPS)(
    '$name lets mixed kart types and wheels finish without a stuck kart',
    async (map) => {
      const loadouts = [
        createKartLoadout(0, 'tank'),
        createKartLoadout(1, 'motorcycle', 'slick'),
        createKartLoadout(2, 'skateboard'),
        createKartLoadout(3, 'sportsCar', 'driftTires'),
      ];
      for (let seed = 1; seed <= 6; seed += 1) {
        const rotated = loadouts.map((_, index) => loadouts[(index + seed) % loadouts.length]!);
        const result = runAiRace(map, seed, 0, 'hard', MAX_RACE_SECONDS, false, rotated);
        expect(result.valid, `Seed ${seed}: ${JSON.stringify(result.racers)}`).toBe(true);
        await nextTask();
      }
    },
    30000,
  );

  it.each([FARM, TOWN, CITY])(
    '$name: all-AI races finish without a stuck kart on every difficulty',
    async (map) => {
      for (const difficulty of AI_DIFFICULTIES) {
        for (let seed = 1; seed <= 12; seed += 1) {
          const result = runAiRace(map, seed, 0, difficulty);
          expect(result.valid, `${map.name} ${difficulty} seed ${seed}: ${JSON.stringify(result.racers)}`).toBe(true);
          await nextTask();
        }
      }
    },
    120000,
  );
});
