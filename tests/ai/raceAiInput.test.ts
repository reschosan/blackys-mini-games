import { describe, expect, it } from 'vitest';
import { createAiDriverState } from '../../src/games/kart/ai/aiDriver';
import { raceDriveFactors, raceInputFrames } from '../../src/games/kart/ai/raceAiInput';
import { DEFAULT_AI } from '../../src/shared/config/ai';
import { DEFAULT_AI_DIFFICULTY } from '../../src/shared/config/aiDifficulty';
import { DEFAULT_DRIVING } from '../../src/shared/config/driving';
import { RING_TEST_MAP } from '../support/ringTestMap';
import { NEUTRAL_INPUT } from '../../src/shared/input/actions';
import { createKartState } from '../../src/games/kart/kart/kartState';
import { createProgress } from '../../src/games/kart/race/raceState';

describe('race AI inputs', () => {
  it('stops controlling a finished kart instead of circling the last target', () => {
    const start = RING_TEST_MAP.startPositions[0]!;
    const progress = createProgress(start.x, start.z);
    progress.finished = true;
    const participant = {
      state: createKartState(start.x, start.z, start.yaw),
      progress,
      aiDriver: createAiDriverState(),
      difficulty: 'hard' as const,
      heldItem: null,
      isAi: true,
    };

    expect(raceInputFrames([participant], [], RING_TEST_MAP, DEFAULT_AI, DEFAULT_AI_DIFFICULTY, DEFAULT_DRIVING, 1 / 60)).toEqual([NEUTRAL_INPUT]);
    expect(raceDriveFactors([participant], DEFAULT_AI_DIFFICULTY)).toEqual([DEFAULT_AI_DIFFICULTY.hard]);
  });
});
