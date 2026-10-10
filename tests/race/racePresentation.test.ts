import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundEngine } from '../../src/shared/audio/soundEngine';
import { createRuntimeAudio } from '../../src/shared/config/audio';
import { createRuntimeCamera } from '../../src/shared/config/camera';
import { createRuntimeGraphics, type GraphicsConfig } from '../../src/shared/config/graphics';
import { createCatAppearance } from '../../src/shared/config/catAppearance';
import { createKartLoadout } from '../../src/shared/config/kartLoadout';
import { RING_TEST_MAP } from '../support/ringTestMap';
import { createKartState } from '../../src/games/kart/kart/kartState';
import { RacePresentation } from '../../src/games/kart/race/views/racePresentation';
import { createProgress } from '../../src/games/kart/race/raceState';
import { createItemBoxStates } from '../../src/games/kart/items/itemBoxes';
import { createRuntimeItems } from '../../src/shared/config/items';
import { createRaceWorld } from '../../src/games/kart/race/raceWorld';

const gpu = vi.hoisted(() => ({ render: vi.fn(), viewport: vi.fn(), scissor: vi.fn(), resize: vi.fn(), pixelRatio: vi.fn() }));

vi.mock('three', async (original) => ({
  ...(await original<typeof import('three')>()),
  WebGLRenderer: class {
    info = { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 } };
    setPixelRatio = gpu.pixelRatio;
    getPixelRatio(): number {
      return window.devicePixelRatio;
    }
    setSize = gpu.resize;
    setScissorTest(): void {}
    clear(): void {}
    setViewport = gpu.viewport;
    setScissor = gpu.scissor;
    render = gpu.render;
  },
}));

vi.mock('../src/cat/catModelLoader', () => ({
  loadCatModelSource: () => new Promise(() => {}),
  cloneCatModel: vi.fn(),
}));

function fixture(pixelRatio = 1, graphics = createRuntimeGraphics()) {
  vi.stubGlobal('window', { devicePixelRatio: pixelRatio });
  const canvas = { clientWidth: 800, clientHeight: 600, width: 800 * pixelRatio, height: 600 * pixelRatio } as HTMLCanvasElement;
  const presentation = new RacePresentation(canvas, RING_TEST_MAP, createRuntimeCamera(), new SoundEngine(createRuntimeAudio()), graphics);
  const players = RING_TEST_MAP.startPositions.slice(0, 2).map((start) => ({
    state: createKartState(start.x, start.z, start.yaw, start.levelId),
    progress: createProgress(start.x, start.z, start.levelId),
    isAi: false,
  }));
  for (const player of players) presentation.addRacer(player, 0xff0000, createCatAppearance(), createKartLoadout());
  return { presentation, players };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', { devicePixelRatio: 1 });
});
afterEach(() => vi.unstubAllGlobals());

describe('race presentation ownership', () => {
  it('animates, resets feedback and renders without writing simulation data', () => {
    const { presentation, players } = fixture();
    const before = structuredClone(players);
    for (const player of players) {
      player.state.boostSeconds = 3;
      player.state.driftDirection = 1;
      player.state.stunSecondsLeft = 1;
      player.progress.finished = true;
      Object.freeze(player.state);
      Object.freeze(player.progress);
      Object.freeze(player);
    }
    const expected = structuredClone(players);
    const boxes = createItemBoxStates(RING_TEST_MAP).map((box) => Object.freeze(box));
    for (let frame = 0; frame < 3; frame += 1) {
      presentation.update(1 / 60, players, { ...createRaceWorld(RING_TEST_MAP), itemBoxes: boxes }, createRuntimeItems(), true);
      presentation.render(1 / 60, players);
    }
    presentation.resetFeedback();
    expect(players).toEqual(expected);
    expect(players[0]!.state.boostSeconds).not.toBe(before[0]!.state.boostSeconds);
    expect(gpu.render).toHaveBeenCalledTimes(6);
  });

  it.each([1, 1.5])('restores the full logical viewport after leaving split-screen at pixel ratio %s', (ratio) => {
    const { presentation, players } = fixture(ratio);
    presentation.update(1 / 60, players, createRaceWorld(RING_TEST_MAP), createRuntimeItems(), false);
    expect(gpu.resize).not.toHaveBeenCalled();
    presentation.render(1 / 60, players);
    expect(gpu.viewport.mock.calls.slice(-2)).toEqual([
      [0, 0, 400, 600],
      [400, 0, 400, 600],
    ]);
    presentation.removeRacer(players[1]!);
    presentation.render(1 / 60, players.slice(0, 1));
    expect(gpu.viewport).toHaveBeenLastCalledWith(0, 0, 800, 600);
  });

  it('draws one full-screen picture instead of a split when a guest phone draws the other human kart itself', () => {
    const { presentation, players } = fixture();
    presentation.render(1 / 60, players);
    expect(gpu.viewport.mock.calls.slice(-2)).toEqual([
      [0, 0, 400, 600],
      [400, 0, 400, 600],
    ]);
    Object.assign(players[1]!, { viewedElsewhere: true });
    presentation.render(1 / 60, players);
    expect(gpu.viewport).toHaveBeenLastCalledWith(0, 0, 800, 600);
  });

  it('draws fewer pixels once the graphics level is switched to low', () => {
    const graphics: GraphicsConfig = { ...createRuntimeGraphics(), quality: 'high' };
    const { presentation } = fixture(2, graphics);
    expect(gpu.pixelRatio).toHaveBeenLastCalledWith(1.5);
    graphics.quality = 'low';
    presentation.applyGraphicsQuality();
    expect(gpu.pixelRatio).toHaveBeenLastCalledWith(1);
  });

  it('stores appearance in the view, not in the simulation player', () => {
    const { presentation, players } = fixture();
    const player = players[0]!;
    const before = structuredClone(player);
    const appearance = { ...createCatAppearance(), furColor: 'red' as const };
    presentation.setAppearance(player, appearance);
    expect(presentation.appearanceFor(player)).toEqual(appearance);
    expect(player).toEqual(before);
    presentation.removeRacer(player);
    expect(() => presentation.appearanceFor(player)).toThrow('not registered');
  });

  it('is ready at once on a map without models, so the loading screen never waits for it', () => {
    const { presentation } = fixture();
    expect(presentation.isMapReady()).toBe(true);
  });

  it('draws a kart between its previous and current simulation tick, and shows a teleport as it is', () => {
    const { presentation, players } = fixture();
    const kart = players[0]!;
    const drawnX = (): number => {
      presentation.update(1 / 60, players, createRaceWorld(RING_TEST_MAP), createRuntimeItems(), false);
      const visuals = (presentation as unknown as { racers: Map<unknown, { view: { object: { position: { x: number } } } }> }).racers;
      return visuals.get(kart)!.view.object.position.x;
    };
    const startX = kart.state.x;
    presentation.snapshotPoses(players);

    kart.state.x = startX + 2;
    presentation.setFrameAlpha(0.5);
    expect(drawnX()).toBeCloseTo(startX + 1);

    presentation.setFrameAlpha(1);
    expect(drawnX()).toBeCloseTo(startX + 2);

    presentation.snapshotPoses(players);
    kart.state.x = startX + 80;
    presentation.setFrameAlpha(0.5);
    expect(drawnX()).toBeCloseTo(startX + 80);
  });
});
