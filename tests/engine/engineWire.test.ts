import { describe, expect, it } from 'vitest';
import { createCatAppearance } from '../../src/shared/config/catAppearance';
import { decodeEngineFrame, encodeEngineFrame, type EngineFrame } from '../../src/party/engine/engineWire';
import { parseEngineSetup } from '../../src/party/engine/engineSetup';

const FRAME: EngineFrame = {
  state: { cards: [-1, 3], turn: 1 },
  hud: { places: [1, 2], cards: ['2 Paare · dran', '0 Paare'], lines: ['Mauzi ist dran'], countdown: null },
};
const toBuffer = (text: string): ArrayBuffer => new TextEncoder().encode(text).buffer as ArrayBuffer;

describe('engine frames on the wire', () => {
  it('survive the trip as they are', () => {
    expect(decodeEngineFrame(encodeEngineFrame(FRAME))).toEqual(FRAME);
  });

  it.each([
    ['not JSON', 'hello'],
    ['not an object', '[1,2]'],
    ['without the HUD', '{"state":{}}'],
    ['places that are no places', '{"state":{},"hud":{"places":[99],"cards":[],"lines":[],"countdown":null}}'],
    ['cards that are no texts', '{"state":{},"hud":{"places":[1],"cards":[7],"lines":[],"countdown":null}}'],
    ['a countdown that is no text', '{"state":{},"hud":{"places":[1],"cards":[],"lines":[],"countdown":5}}'],
    ['far too many lines', `{"state":{},"hud":{"places":[1],"cards":[],"lines":${JSON.stringify(new Array(20).fill('x'))},"countdown":null}}`],
  ])('are dropped when they are %s', (_reason, text) => {
    expect(decodeEngineFrame(toBuffer(text))).toBeNull();
  });

  it('are dropped when they are far too big', () => {
    expect(decodeEngineFrame(toBuffer(JSON.stringify({ ...FRAME, state: { filler: 'x'.repeat(20_000) } })))).toBeNull();
  });
});

describe('engine setup for a guest', () => {
  const seat = (slot: number): unknown => ({ slot, isAi: false, name: 'Mauzi', color: '#e0533d', appearance: createCatAppearance() });
  const setup = (overrides: Record<string, unknown> = {}): unknown =>
    JSON.parse(JSON.stringify({ buildId: 'abc', seat: 1, snapshotHz: 20, resume: false, seats: [seat(0), seat(1)], ...overrides }));

  it('survives the trip as JSON', () => {
    expect(parseEngineSetup(setup())).toEqual(setup());
  });

  it.each([
    ['a seat nobody sits on', { seat: 5 }],
    ['an absurd snapshot rate', { snapshotHz: 1000 }],
    ['a build id that is no text', { buildId: 7 }],
    ['no seats', { seats: [] }],
    ['a colour that is no colour', { seats: [{ ...(seat(0) as object), color: 'red' }, seat(1)] }],
    ['a cat that does not exist', { seats: [seat(0), { ...(seat(1) as object), appearance: { ...createCatAppearance(), furColor: 'rainbow' } }] }],
  ])('refuses %s', (_reason, change) => {
    expect(parseEngineSetup(setup(change))).toBeNull();
  });

  it('refuses anything that is not an object', () => {
    expect([null, 'x', 7, [1]].map(parseEngineSetup)).toEqual([null, null, null, null]);
  });
});
