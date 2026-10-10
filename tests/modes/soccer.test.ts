import { describe, expect, it } from 'vitest';
import { createSoccer } from '../../src/games/kart/modes/rules/soccer';
import { karts, run, setup } from './support';

const ball = (rules: ReturnType<typeof createSoccer>): { x: number; z: number } => {
  const visual = rules.visual;
  return visual.kind === 'field' ? { x: visual.ballX, z: visual.ballZ } : { x: NaN, z: NaN };
};

describe('soccer', () => {
  it('holds the ball still during the kickoff pause', () => {
    const rules = createSoccer(setup(2));
    const placed = karts([-3.5, 0], [30, 30]);
    placed[0]!.velocityX = 10;
    run(rules, placed, 1);
    expect(ball(rules)).toEqual({ x: 0, z: 0 });
  });

  it('kicks the ball away from the kart that hits it', () => {
    const rules = createSoccer(setup(2));
    const placed = karts([-3.2, 0], [60, 30]);
    placed[0]!.velocityX = 12;
    run(rules, placed, 2.2);
    placed[0]!.x = ball(rules).x - 2;
    run(rules, placed, 0.5);
    expect(ball(rules).x).toBeGreaterThan(1);
  });

  it('counts a goal for the team that attacks that side, and asks for a kickoff', () => {
    const rules = createSoccer(setup(2));
    const placed = karts([0, 40], [0, -40]);
    rules.fromExtras([90, 0, 64, 0, 20, 0, 0, 0, 0]);
    run(rules, placed, 0.5);
    expect(rules.statusLines()[1]).toBe('Rot 1 : 0 Blau');
    expect(rules.takeKickoff()).toBe(true);
    expect(rules.takeKickoff()).toBe(false);
    expect(ball(rules)).toEqual({ x: 0, z: 0 });
  });

  it('bounces the ball off the side walls and off the end wall next to the goal', () => {
    const rules = createSoccer(setup(2));
    const placed = karts([0, 40], [0, -40]);
    rules.fromExtras([90, 0, 0, 30, 0, 20, 0, 0, 0]);
    run(rules, placed, 1);
    expect(ball(rules).z).toBeLessThan(40);
    rules.fromExtras([90, 0, 60, 30, 30, 0, 0, 0, 0]);
    run(rules, placed, 1);
    expect(ball(rules).x).toBeLessThanOrEqual(65);
    expect(rules.statusLines()[1]).toBe('Rot 0 : 0 Blau');
  });

  it('sends a ball rolled into a corner back into the field along the slanted corner', () => {
    const rules = createSoccer(setup(2));
    const placed = karts([0, 40], [0, -40]);
    rules.fromExtras([90, 0, 58, 31, 12, 12, 0, 0, 0]);
    run(rules, placed, 1);
    const { x, z } = ball(rules);
    expect(Math.abs(x) + Math.abs(z)).toBeLessThanOrEqual(65 + 38 - 10);
    expect(rules.statusLines()[1]).toBe('Rot 0 : 0 Blau');
  });

  it('tells every player the team on the card', () => {
    const rules = createSoccer(setup(4));
    expect([0, 1, 2, 3].map((slot) => rules.cardText(slot))).toEqual(['Team Rot', 'Team Blau', 'Team Rot', 'Team Blau']);
  });

  it('ends at the goal limit or when the time is up; the team with more goals wins both its seats, a draw is a draw', () => {
    const rules = createSoccer(setup(4));
    rules.fromExtras([30, 0, 0, 0, 0, 0, 3, 1, 0]);
    run(rules, karts([0, 40], [0, -40], [10, 40], [10, -40]), 0.1);
    expect(rules.over).toBe(true);
    expect(rules.places()).toEqual([1, 2, 1, 2]);
    const draw = createSoccer(setup(2));
    draw.fromExtras([0.01, 0, 0, 0, 0, 0, 2, 2, 0]);
    run(draw, karts([0, 40], [0, -40]), 0.1);
    expect(draw.places()).toEqual([1, 1]);
  });

  it('sends a kart that is not behind the ball to a point behind it, and a kart that is straight at the ball', () => {
    const rules = createSoccer(setup(2));
    const ahead = karts([10, 0], [0, 0]);
    expect(rules.aim(0, ahead)!.x).toBeLessThan(0);
    const behind = karts([-12, 0], [0, 0]);
    expect(rules.aim(0, behind)).toEqual({ x: 0, z: 0 });
    expect(rules.aim(1, karts([-12, 0], [12, 0]))).toEqual({ x: 0, z: 0 });
    expect(rules.aim(1, karts([-12, 0], [-12, 5]))!.x).toBeGreaterThan(0);
  });
});
