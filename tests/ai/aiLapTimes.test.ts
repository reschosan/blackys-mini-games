import { AI_DIFFICULTIES, type AiDifficulty } from '../../src/shared/config/aiDifficulty';
import { NATURE } from '../../src/games/kart/maps/nature/map';
import { SPACE } from '../../src/games/kart/maps/space/map';
import { FARM } from '../../src/games/kart/maps/farm/map';
import { TOWN } from '../../src/games/kart/maps/town/map';
import { CITY } from '../../src/games/kart/maps/city/map';
import type { MapConfig } from '../../src/games/kart/maps/shared/mapConfig';
import { describe, expect, it } from 'vitest';
import { MAX_RACE_SECONDS, medianOf, nextTask, RACE_COUNT, runAiRace } from './support/aiRaceHarness';

describe('AI lap times', () => {
  it.each(AI_DIFFICULTIES)(
    'Naturpfad %s AI karts manage a median lap within the target time across 20 seeded four-AI races',
    async (difficulty) => {
      const medianLapLimits = { hard: 75, medium: 80, easy: 85 } as const;
      const laps: number[] = [];
      for (let seed = 1; seed <= RACE_COUNT; seed += 1) {
        const result = runAiRace(NATURE, seed, 0, difficulty, MAX_RACE_SECONDS, true);
        expect(result.valid, `${difficulty} seed ${seed}: ${JSON.stringify(result.racers)}`).toBe(true);
        for (const [slot, racer] of result.racers.entries()) {
          expect(racer.lapTimesSeconds?.length, `${difficulty} seed ${seed} slot ${slot}: at least one lap`).toBeGreaterThanOrEqual(1);
          laps.push(...(racer.lapTimesSeconds ?? []));
        }
        await nextTask();
      }
      expect(medianOf(laps)).toBeLessThanOrEqual(medianLapLimits[difficulty]);
    },
    30000,
  );
  it.each(AI_DIFFICULTIES)(
    'Mondbasis completes valid laps for every %s AI kart in about the Naturpfad lap time',
    async (difficulty) => {
      const medianLapSeconds = (map: MapConfig): number => {
        const laps: number[] = [];
        for (let seed = 1; seed <= 8; seed += 1) {
          const result = runAiRace(map, seed, 0, difficulty, MAX_RACE_SECONDS, true);
          expect(result.valid, `${map.name} ${difficulty} seed ${seed}`).toBe(true);
          for (const racer of result.racers) {
            expect(racer.lapTimesSeconds?.length, `${map.name} ${difficulty} seed ${seed}: at least one lap`).toBeGreaterThanOrEqual(1);
            laps.push(...(racer.lapTimesSeconds ?? []));
          }
        }
        return medianOf(laps);
      };
      const spaceLap = medianLapSeconds(SPACE);
      const natureLap = medianLapSeconds(NATURE);
      expect(Math.abs(spaceLap / natureLap - 1), `Mondbasis ${spaceLap.toFixed(1)} s vs Naturpfad ${natureLap.toFixed(1)} s`).toBeLessThan(0.06);
    },
    60000,
  );

  it.each([FARM, TOWN, CITY])(
    '$name: AI laps take at least 45 seconds, and a harder AI is faster than an easier one',
    async (map) => {
      const medianLapByDifficulty = (difficulty: AiDifficulty): number => {
        const laps: number[] = [];
        for (let seed = 1; seed <= 6; seed += 1) {
          const result = runAiRace(map, seed, 0, difficulty, MAX_RACE_SECONDS, true);
          expect(result.valid, `${map.name} ${difficulty} seed ${seed}`).toBe(true);
          for (const racer of result.racers) laps.push(...(racer.lapTimesSeconds ?? []));
        }
        expect(Math.min(...laps), `${map.name} ${difficulty}: fastest lap`).toBeGreaterThanOrEqual(45);
        return medianOf(laps);
      };
      const [hard, medium, easy] = [medianLapByDifficulty('hard'), medianLapByDifficulty('medium'), medianLapByDifficulty('easy')];
      expect(hard).toBeLessThan(medium);
      expect(medium).toBeLessThan(easy);
    },
    120000,
  );
});
