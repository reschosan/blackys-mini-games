import { NO_PICK } from '../../src/shared/input/touch/touchSource';
import { describe, expect, it } from 'vitest';
import { REMOTE_MESSAGE_MAX_CHARACTERS } from '../../src/shared/config/remote';
import {
  serializeGuestWantsPicture,
  serializeGuestDecision,
  serializeGuestLanguage,
  MessageRateLimit,
  parseGuestControl,
  parseGuestMessage,
  parseHostMessage,
  serializeGuestPong,
  serializeGuestReady,
  serializeHostMessage,
  serializeInput,
} from '../../src/shared/net/messages';

const INPUT = { stickX: 0.5, stickY: -0.25, pressedBits: 66, pick: NO_PICK, mode: 'classic', sequence: 4242 } as const;

describe('input messages from a guest', () => {
  it('survive the trip unchanged', () => {
    expect(parseGuestMessage(serializeInput(INPUT))).toEqual({ kind: 'input', ...INPUT });
  });

  it('are short enough to send sixty times a second', () => {
    expect(serializeInput(INPUT).length).toBeLessThan(50);
    expect(serializeInput({ ...INPUT, pick: { index: 13, count: 200 } }).length).toBeLessThan(70);
  });

  it('carry the latest tap on the picture with its count', () => {
    expect(parseGuestMessage(serializeInput({ ...INPUT, pick: { index: 13, count: 7 } }))).toMatchObject({ pick: { index: 13, count: 7 } });
    expect(parseGuestMessage('{"k":"i","x":0,"y":0,"b":0,"m":0,"n":1,"pi":999,"pc":1}')).toMatchObject({ pick: NO_PICK });
  });

  it.each([
    ['not text', 42],
    ['not json', 'hello'],
    ['not an object', '[1,2]'],
    ['another kind', '{"k":"x"}'],
    ['stick out of range', '{"k":"i","x":2,"y":0,"b":0,"m":0,"n":1}'],
    ['stick not a number', '{"k":"i","x":"1","y":0,"b":0,"m":0,"n":1}'],
    ['stick not finite', '{"k":"i","x":1e999,"y":0,"b":0,"m":0,"n":1}'],
    ['keys not whole', '{"k":"i","x":0,"y":0,"b":1.5,"m":0,"n":1}'],
    ['keys out of range', '{"k":"i","x":0,"y":0,"b":8192,"m":0,"n":1}'],
    ['unknown steering mode', '{"k":"i","x":0,"y":0,"b":0,"m":7,"n":1}'],
    ['without a sequence number', '{"k":"i","x":0,"y":0,"b":0,"m":0}'],
    ['a sequence number out of range', '{"k":"i","x":0,"y":0,"b":0,"m":0,"n":70000}'],
    ['too long', `{"k":"i","x":0,"y":0,"b":0,"m":0,"n":1,"pad":"${'a'.repeat(REMOTE_MESSAGE_MAX_CHARACTERS)}"}`],
  ])('are dropped when %s', (_reason, raw) => {
    expect(parseGuestMessage(raw)).toBeNull();
  });
});

describe('messages from the host', () => {
  const status = {
    kind: 'status',
    seatIndex: 1,
    name: 'Mochi',
    color: '#3d8fe0',
    phase: 'racing',
    place: 2,
    lap: 1,
    lapCount: 3,
    gameStatus: null,
    item: 'Haarball',
    finished: false,
    pausedBy: 'Mauzi',
    away: ['Felix'],
    canDecide: true,
    allowsControllerOnly: true,
  } as const;

  it('status survives the trip unchanged', () => {
    expect(parseHostMessage(serializeHostMessage(status))).toEqual(status);
  });

  it('carries what the host card says about the seat in a game that is not a race', () => {
    expect(parseHostMessage(serializeHostMessage({ ...status, gameStatus: 'Team Blau' }))).toMatchObject({ gameStatus: 'Team Blau' });
  });

  it('tells a guest that it chooses after the race only when the host says so', () => {
    expect(parseHostMessage(serializeHostMessage({ ...status, canDecide: false }))).toMatchObject({ canDecide: false });
    expect(parseHostMessage(serializeHostMessage(status))).toMatchObject({ canDecide: true });
  });

  it('tells a guest that it may stay a plain controller only when the host can show a shared picture', () => {
    expect(parseHostMessage(serializeHostMessage({ ...status, allowsControllerOnly: false }))).toMatchObject({ allowsControllerOnly: false });
    expect(parseHostMessage(serializeHostMessage(status))).toMatchObject({ allowsControllerOnly: true });
  });

  it('carries the game, the setup, events and the lobby without knowing what is in them', () => {
    const setup = { mapIndex: 1 };
    expect(parseHostMessage(serializeHostMessage({ kind: 'setup', game: 'timetrial', setup }))).toEqual({ kind: 'setup', game: 'timetrial', setup });
    expect(parseHostMessage(serializeHostMessage({ kind: 'event', event: { type: 'go' } }))).toEqual({ kind: 'event', event: { type: 'go' } });
    expect(parseHostMessage(serializeHostMessage({ kind: 'lobby', lobby: { stage: 'gameVote' } }))).toEqual({ kind: 'lobby', lobby: { stage: 'gameVote' } });
  });

  it.each([
    ['a setup without a game', '{"k":"u","u":{}}'],
    ['a game name that is far too long', `{"k":"u","g":"${'x'.repeat(40)}","u":{}}`],
    ['a setup that is no object', '{"k":"u","g":"race","u":5}'],
    ['an event that is no object', '{"k":"v","e":"go"}'],
    ['a lobby that is no object', '{"k":"b","b":[1]}'],
  ])('drops %s', (_reason, raw) => {
    expect(parseHostMessage(raw)).toBeNull();
  });

  it('buzz survives the trip unchanged', () => {
    expect(parseHostMessage(serializeHostMessage({ kind: 'buzz' }))).toEqual({ kind: 'buzz' });
  });

  it('cuts a name that is too long instead of passing it on', () => {
    const parsed = parseHostMessage(serializeHostMessage({ ...status, name: 'N'.repeat(200) }));
    expect(parsed?.kind === 'status' && parsed.name.length).toBeLessThanOrEqual(24);
  });

  it.each([
    ['a colour that is no colour', { ...status, color: 'red; background: url(x)' }],
    ['a phase that does not exist', { ...status, phase: 'cheating' }],
  ])('refuses %s', (_reason, message) => {
    const raw = serializeHostMessage(status)
      .replace(`"c":"${status.color}"`, `"c":"${message.color}"`)
      .replace('"p":1', `"p":${message.phase === 'cheating' ? 9 : 1}`);
    expect(parseHostMessage(raw)).toBeNull();
  });
});

describe('ping', () => {
  it('goes to the guest and comes back with the same stamp', () => {
    const ping = parseHostMessage(serializeHostMessage({ kind: 'ping', sentAt: 123456 }));
    expect(ping).toEqual({ kind: 'ping', sentAt: 123456 });
    expect(parseGuestControl(serializeGuestPong({ kind: 'pong', sentAt: 123456 }))).toEqual({ kind: 'pong', sentAt: 123456 });
  });

  it.each(['{"k":"q","s":-1}', '{"k":"q","s":1.5}', '{"k":"q","s":"1"}', '{"k":"x","s":1}', 'nope', 7])('drops an answer that is %j', (raw) => {
    expect(parseGuestControl(raw)).toBeNull();
  });
});

describe('message rate limit', () => {
  it('lets a burst through but not a flood within one second', () => {
    let now = 0;
    const limit = new MessageRateLimit(3, () => now);
    expect([limit.allows(), limit.allows(), limit.allows(), limit.allows()]).toEqual([true, true, true, false]);
    now = 1000;
    expect(limit.allows()).toBe(true);
  });
});

describe('messages that must never be trusted', () => {
  it('ignores a message kind that is an inherited name of every object', () => {
    for (const kind of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(parseHostMessage(JSON.stringify({ k: kind }))).toBeNull();
    }
  });

  it('answers a ready message with the choice of the guest', () => {
    expect(parseGuestControl(serializeGuestReady({ kind: 'ready', renders: true }))).toEqual({ kind: 'ready', renders: true });
    expect(parseGuestControl(serializeGuestReady({ kind: 'ready', renders: false }))).toEqual({ kind: 'ready', renders: false });
  });
});

describe('a guest asking for the picture of a running race', () => {
  it('survives the way over and is told apart from other control messages', () => {
    expect(parseGuestControl(serializeGuestWantsPicture())).toEqual({ kind: 'wantPicture' });
    expect(parseGuestControl('{"k":"nope"}')).toBeNull();
    expect(parseGuestControl('not json')).toBeNull();
  });
});

describe('what a guest decides after the race', () => {
  it.each(['again', 'next', 'lobby'] as const)('%s survives the trip, anything else is refused', (choice) => {
    expect(parseGuestControl(serializeGuestDecision(choice))).toEqual({ kind: 'decide', choice });
    expect(parseGuestControl('{"k":"d","c":7}')).toBeNull();
    expect(parseGuestControl('{"k":"d","c":-1}')).toBeNull();
  });
});

describe('the language of a guest phone', () => {
  it.each(['en', 'de'] as const)('%s survives the trip, a language the game does not speak is refused', (language) => {
    expect(parseGuestControl(serializeGuestLanguage(language))).toEqual({ kind: 'language', language });
    expect(parseGuestControl('{"k":"l","l":"fr"}')).toBeNull();
    expect(parseGuestControl('{"k":"l"}')).toBeNull();
  });
});
