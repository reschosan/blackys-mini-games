import { describe, expect, it } from 'vitest';
import { createRuntimeItems } from '../../src/shared/config/items';
import { createKartState } from '../../src/games/kart/kart/kartState';
import { RING_TEST_MAP } from '../support/ringTestMap';
import { spawnGravityBubble, stepGravityBubbles } from '../../src/games/kart/items/gravityBubbles';

function bubbleFixture() {
  const items = createRuntimeItems();
  const owner = createKartState(0, 0, 0);
  const bubble = spawnGravityBubble(owner, 0, items, RING_TEST_MAP);
  return { items, owner, bubble, bubbles: [bubble] };
}

describe('gravity bubble', () => {
  it('is dropped behind the owner', () => {
    const { bubble } = bubbleFixture();
    expect(bubble.x).toBeLessThan(0);
  });

  it('floats another kart that enters it: stunned, momentum mostly kept, no spin', () => {
    const { items, bubble, bubbles } = bubbleFixture();
    const victim = createKartState(bubble.x, bubble.z, 0);
    victim.velocityX = 20;
    const yawBefore = victim.yaw;

    stepGravityBubbles(bubbles, items, RING_TEST_MAP, [createKartState(0, 0, 0), victim], 1 / 60);

    expect(victim.stunSecondsLeft).toBeCloseTo(items.gravity.stunSeconds);
    expect(victim.velocityX).toBeCloseTo(20 * items.gravity.velocityLossFactor);
    expect(victim.yaw).toBe(yawBefore);
  });

  it('catches each kart only once, even if it stays inside', () => {
    const { items, bubble, bubbles } = bubbleFixture();
    const victim = createKartState(bubble.x, bubble.z, 0);
    const karts = [createKartState(0, 0, 0), victim];
    stepGravityBubbles(bubbles, items, RING_TEST_MAP, karts, 1 / 60);
    victim.stunSecondsLeft = 0;
    victim.velocityX = 10;

    stepGravityBubbles(bubbles, items, RING_TEST_MAP, karts, 1 / 60);

    expect(victim.stunSecondsLeft).toBe(0);
    expect(victim.velocityX).toBe(10);
  });

  it('never catches its owner, karts outside, or karts on another level', () => {
    const { items, owner, bubble, bubbles } = bubbleFixture();
    const outside = createKartState(bubble.x, bubble.z + items.gravity.radiusMeters + 5, 0);
    const otherLevel = createKartState(bubble.x, bubble.z, 0, 'second');

    stepGravityBubbles(bubbles, items, RING_TEST_MAP, [owner, outside, otherLevel], 1 / 60);

    expect([owner, outside, otherLevel].map((kart) => kart.stunSecondsLeft)).toEqual([0, 0, 0]);
  });

  it('is blocked once by a shield, which is consumed', () => {
    const { items, bubble, bubbles } = bubbleFixture();
    const victim = createKartState(bubble.x, bubble.z, 0);
    victim.shieldSecondsLeft = 3;

    stepGravityBubbles(bubbles, items, RING_TEST_MAP, [createKartState(0, 0, 0), victim], 1 / 60);

    expect(victim.stunSecondsLeft).toBe(0);
    expect(victim.shieldSecondsLeft).toBe(0);
  });

  it('keeps the leader floating longer, like for every item hit', () => {
    const { items, bubble, bubbles } = bubbleFixture();
    const leader = createKartState(bubble.x, bubble.z, 0);
    leader.leading = true;

    stepGravityBubbles(bubbles, items, RING_TEST_MAP, [createKartState(0, 0, 0), leader], 1 / 60);

    expect(leader.stunSecondsLeft).toBeCloseTo(items.gravity.stunSeconds + items.leaderStunBonusSeconds);
  });

  it('vanishes after its lifetime', () => {
    const { items, bubbles } = bubbleFixture();

    stepGravityBubbles(bubbles, items, RING_TEST_MAP, [], items.gravity.lifetimeSeconds + 0.1);

    expect(bubbles).toHaveLength(0);
  });
});
