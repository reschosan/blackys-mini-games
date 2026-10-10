import { describe, expect, it } from 'vitest';
import { RING_TEST_MAP } from '../support/ringTestMap';
import { TrapView } from '../../src/games/kart/items/views/trapView';

describe('persistent trap rendering', () => {
  it('shows every cup beyond the old eight-cup limit and hides them after race cleanup', () => {
    const view = new TrapView();
    const traps = Array.from({ length: 12 }, (_, index) => ({ x: index * 3, z: 0, ownerIndex: 0, levelId: 'first', elevation: 60 }));
    view.update(RING_TEST_MAP, traps);
    expect(view.object.children.filter((mesh) => mesh.visible)).toHaveLength(12);
    expect(view.object.children[11]!.position.x).toBe(33);
    expect(view.object.children[11]!.position.y).toBeGreaterThanOrEqual(60);
    expect((view.object.children[11]!.children[0] as import('three').Mesh).position.y).toBeGreaterThan(0);
    expect(view.object.children[11]!.userData.levelId).toBe('first');
    view.update(RING_TEST_MAP, []);
    expect(view.object.children.some((mesh) => mesh.visible)).toBe(false);
    view.update(RING_TEST_MAP, traps);
    expect(view.object.children).toHaveLength(12);
  });
});
