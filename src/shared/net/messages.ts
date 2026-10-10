import { REMOTE_HOST_MESSAGE_MAX_CHARACTERS, REMOTE_MESSAGE_MAX_CHARACTERS } from '../config/remote';
import type { CatAppearance } from '../config/catAppearance';
import type { KartLoadout } from '../config/kartLoadout';
import { isValidProfile } from '../config/playerProfile';
import { isHexColor, isIntegerIn, isRecord, isTextUpTo } from '../core/wireChecks';
import { TOUCH_CONTROL_MODES, type TouchControlMode } from '../config/touch';
import { MAX_PICK_COUNT, MAX_PICK_INDEX, NO_PICK, type TouchPick } from '../input/touch/touchSource';
import { isLanguage, type Language } from '../i18n/language';

const MAX_BUTTON_BITS = 8191;
const MAX_NAME_CHARACTERS = 24;
const MAX_STATUS_CHARACTERS = 40;
const MAX_AWAY = 4;

/** Guest to host, 60 times per second: the on-screen stick and keys, and the steering mode the guest chose. */
export interface InputMessage {
  readonly kind: 'input';
  readonly stickX: number;
  readonly stickY: number;
  readonly pressedBits: number;
  /** The latest tap on the picture (a memory card); counted, so a tap is taken once however often it arrives. */
  readonly pick: TouchPick;
  readonly mode: TouchControlMode;
  /** Counts up with every message (wraps at 65536). The host reports the last one it applied, so the guest can tell which inputs the host has not seen yet. */
  readonly sequence: number;
}

export type RemotePhase = 'lobby' | 'racing' | 'paused' | 'results';

/** Host to guest, a few times per second. Everything the guest phone shows besides its own keys. */
export interface StatusMessage {
  readonly kind: 'status';
  readonly seatIndex: number;
  readonly name: string;
  readonly color: string;
  readonly phase: RemotePhase;
  readonly place: number;
  readonly lap: number;
  readonly lapCount: number;
  /** In a game that is not a race: what the host's card says about this seat ("Team Blau", "3 Punkte"); null in a race. */
  readonly gameStatus: string | null;
  readonly item: string | null;
  readonly finished: boolean;
  /** The name of the player who paused the race, while it is paused. */
  readonly pausedBy: string | null;
  /** Players whose phone has dropped out (their kart rolls out), so a guest sees what the host's screen shows. */
  readonly away: readonly string[];
  /** True when this guest chooses what happens after a game: only if the host plays nobody itself (it has nobody who could), and then only the first guest. */
  readonly canDecide: boolean;
  /** False when the host's screen is too small for a shared picture (a phone): then every guest must draw its own screen. */
  readonly allowsControllerOnly: boolean;
}

interface BuzzMessage {
  readonly kind: 'buzz';
}

/** The host asks, the guest answers with the same number: the time in between is the latency. */
interface PingMessage {
  readonly kind: 'ping';
  readonly sentAt: number;
}

interface PongMessage {
  readonly kind: 'pong';
  readonly sentAt: number;
}

/** The host has the game ready (which one, map, cats): build it. What the setup holds is the game's business and is checked there. */
interface SetupMessage {
  readonly kind: 'setup';
  readonly game: string;
  readonly setup: unknown;
}

/** Sound and sparks the host reports from the game; the game checks what is in it. */
interface EventMessage {
  readonly kind: 'event';
  readonly event: unknown;
}

/** A guest tells the host it has built the race (`renders`) or will stay a plain controller (a weak phone, a failed load, its own choice). */
interface ReadyMessage {
  readonly kind: 'ready';
  readonly renders: boolean;
}

/** A guest that was a plain controller wants the picture of the running race now: the host sends the setup again. */
interface WantPictureMessage {
  readonly kind: 'wantPicture';
}

/** What can happen after a game: play it again, choose the next game (the score stays), or leave for the lobby (the score is cleared). */
export type ResultChoice = 'again' | 'next' | 'lobby';

/** The guest that stands in for a host without a player chooses what happens after the game. */
interface DecideMessage {
  readonly kind: 'decide';
  readonly choice: ResultChoice;
}

/** The lobby as the guest's own screen shows it (host to guest, when it changes). */
interface LobbyMessage {
  readonly kind: 'lobby';
  readonly lobby: unknown;
}

/** The cat and kart a guest has saved on its phone; the host takes them for this player (it still decides about the name). */
interface ProfileMessage {
  readonly kind: 'profile';
  readonly appearance: CatAppearance;
  readonly loadout: KartLoadout;
}

/** A tap on the guest's own lobby screen (row, arrow, game, map, back, leave); the lobby checks what is in it. */
interface TapMessage {
  readonly kind: 'tap';
  readonly tap: unknown;
}

/** The language the guest phone shows: the host makes the texts it sends to this phone in it. */
interface LanguageMessage {
  readonly kind: 'language';
  readonly language: Language;
}

export type GuestMessage = InputMessage;
export type GuestControlMessage = PongMessage | ReadyMessage | ProfileMessage | TapMessage | WantPictureMessage | DecideMessage | LanguageMessage;
export type HostMessage = StatusMessage | BuzzMessage | PingMessage | SetupMessage | EventMessage | LobbyMessage;

const PHASES: readonly RemotePhase[] = ['lobby', 'racing', 'paused', 'results'];

function numberIn(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function integerIn(value: unknown, min: number, max: number): number | null {
  return isIntegerIn(value, min, max) ? value : null;
}

function parseJson(raw: unknown, limit = REMOTE_MESSAGE_MAX_CHARACTERS): Record<string, unknown> | null {
  if (typeof raw !== 'string' || raw.length > limit) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

export function serializeInput(message: Omit<InputMessage, 'kind'>): string {
  return JSON.stringify({
    k: 'i',
    x: round2(message.stickX),
    y: round2(message.stickY),
    b: message.pressedBits,
    m: TOUCH_CONTROL_MODES.indexOf(message.mode),
    n: message.sequence,
    ...(message.pick.count > 0 ? { pi: message.pick.index, pc: message.pick.count } : {}),
  });
}

/** Everything a guest sends is checked: wrong shape, wrong range or too long means the message is dropped. */
export function parseGuestMessage(raw: unknown): GuestMessage | null {
  const json = parseJson(raw);
  if (!json || json.k !== 'i') return null;
  const stickX = numberIn(json.x, -1, 1);
  const stickY = numberIn(json.y, -1, 1);
  const pressedBits = integerIn(json.b, 0, MAX_BUTTON_BITS);
  const modeIndex = integerIn(json.m, 0, TOUCH_CONTROL_MODES.length - 1);
  const mode = modeIndex === null ? undefined : TOUCH_CONTROL_MODES[modeIndex];
  const sequence = integerIn(json.n, 0, 0xffff);
  if (stickX === null || stickY === null || pressedBits === null || !mode || sequence === null) return null;
  return { kind: 'input', stickX, stickY, pressedBits, pick: parsePick(json), mode, sequence };
}

function parsePick(json: Record<string, unknown>): TouchPick {
  const index = integerIn(json.pi, -1, MAX_PICK_INDEX);
  const count = integerIn(json.pc, 0, MAX_PICK_COUNT);
  return index === null || count === null ? NO_PICK : { index, count };
}

const MAX_PING_STAMP = 2 ** 40;

/** The answer to a ping. */
export function serializeGuestPong(message: PongMessage): string {
  return JSON.stringify({ k: 'q', s: message.sentAt });
}

/** That the guest has built the race (or stays a controller). */
export function serializeGuestReady(message: ReadyMessage): string {
  return JSON.stringify({ k: 'r', m: message.renders ? 1 : 0 });
}

/** The cat and kart a guest has saved. */
export function serializeGuestProfile(message: ProfileMessage): string {
  return JSON.stringify({ k: 'f', a: message.appearance, l: message.loadout });
}

export function serializeGuestTap(message: TapMessage): string {
  return JSON.stringify({ k: 't', t: message.tap });
}

const DECISIONS: readonly ResultChoice[] = ['again', 'next', 'lobby'];

export function serializeGuestDecision(choice: ResultChoice): string {
  return JSON.stringify({ k: 'd', c: DECISIONS.indexOf(choice) });
}

export function serializeGuestWantsPicture(): string {
  return JSON.stringify({ k: 'w' });
}

export function serializeGuestLanguage(language: Language): string {
  return JSON.stringify({ k: 'l', l: language });
}

function parseGuestTap(json: Record<string, unknown>): GuestControlMessage | null {
  return isRecord(json.t) ? { kind: 'tap', tap: json.t } : null;
}

function parseGuestDecision(json: Record<string, unknown>): GuestControlMessage | null {
  const index = integerIn(json.c, 0, DECISIONS.length - 1);
  return index === null ? null : { kind: 'decide', choice: DECISIONS[index]! };
}

function parseGuestPong(json: Record<string, unknown>): GuestControlMessage | null {
  const sentAt = integerIn(json.s, 0, MAX_PING_STAMP);
  return sentAt === null ? null : { kind: 'pong', sentAt };
}

export function parseGuestControl(raw: unknown): GuestControlMessage | null {
  const json = parseJson(raw);
  if (!json) return null;
  const parsers: Readonly<Record<string, () => GuestControlMessage | null>> = {
    r: () => ({ kind: 'ready', renders: json.m === 1 }),
    w: () => ({ kind: 'wantPicture' }),
    d: () => parseGuestDecision(json),
    f: () => (isValidProfile(json.a, json.l) ? { kind: 'profile', appearance: json.a, loadout: json.l as KartLoadout } : null),
    t: () => parseGuestTap(json),
    q: () => parseGuestPong(json),
    l: () => (isLanguage(json.l) ? { kind: 'language', language: json.l } : null),
  };
  return typeof json.k === 'string' && Object.hasOwn(parsers, json.k) ? parsers[json.k]!() : null;
}

export function serializeHostMessage(message: HostMessage): string {
  if (message.kind === 'buzz') return JSON.stringify({ k: 'z' });
  if (message.kind === 'ping') return JSON.stringify({ k: 'g', s: message.sentAt });
  if (message.kind === 'setup') return JSON.stringify({ k: 'u', g: message.game, u: message.setup });
  if (message.kind === 'event') return JSON.stringify({ k: 'v', e: message.event });
  if (message.kind === 'lobby') return JSON.stringify({ k: 'b', b: message.lobby });
  return JSON.stringify({
    k: 's',
    i: message.seatIndex,
    n: message.name.slice(0, MAX_NAME_CHARACTERS),
    c: message.color,
    p: PHASES.indexOf(message.phase),
    r: message.place,
    l: message.lap,
    t: message.lapCount,
    gs: message.gameStatus?.slice(0, MAX_STATUS_CHARACTERS) ?? null,
    it: message.item,
    d: message.finished ? 1 : 0,
    pb: message.pausedBy?.slice(0, MAX_NAME_CHARACTERS) ?? null,
    ad: message.away.slice(0, MAX_AWAY).map((name) => name.slice(0, MAX_NAME_CHARACTERS)),
    dc: message.canDecide ? 1 : 0,
    co: message.allowsControllerOnly ? 1 : 0,
  });
}

function parseStatus(json: Record<string, unknown>): StatusMessage | null {
  const seatIndex = integerIn(json.i, 0, 15);
  const phaseIndex = integerIn(json.p, 0, PHASES.length - 1);
  const place = integerIn(json.r, 0, 16);
  const lap = integerIn(json.l, 0, 99);
  const lapCount = integerIn(json.t, 0, 99);
  const phase = phaseIndex === null ? undefined : PHASES[phaseIndex];
  const validTexts =
    typeof json.n === 'string' &&
    isHexColor(json.c) &&
    (json.it === null || typeof json.it === 'string') &&
    (json.pb === null || json.pb === undefined || typeof json.pb === 'string');
  if (seatIndex === null || place === null || lap === null || lapCount === null || !phase || !validTexts) return null;
  return {
    kind: 'status',
    seatIndex,
    name: (json.n as string).slice(0, MAX_NAME_CHARACTERS),
    color: json.c as string,
    phase,
    place,
    lap,
    lapCount,
    item: json.it as string | null,
    finished: json.d === 1,
    gameStatus: typeof json.gs === 'string' ? json.gs.slice(0, MAX_STATUS_CHARACTERS) : null,
    pausedBy: typeof json.pb === 'string' ? json.pb.slice(0, MAX_NAME_CHARACTERS) : null,
    canDecide: json.dc === 1,
    allowsControllerOnly: json.co !== 0,
    away: Array.isArray(json.ad)
      ? json.ad
          .filter((name): name is string => typeof name === 'string')
          .slice(0, MAX_AWAY)
          .map((name) => name.slice(0, MAX_NAME_CHARACTERS))
      : [],
  };
}

function parsePing(json: Record<string, unknown>): PingMessage | null {
  const sentAt = integerIn(json.s, 0, MAX_PING_STAMP);
  return sentAt === null ? null : { kind: 'ping', sentAt };
}

const MAX_GAME_ID_CHARACTERS = 24;

function parseSetup(json: Record<string, unknown>): HostMessage | null {
  const { g: game, u: setup } = json;
  return isTextUpTo(game, MAX_GAME_ID_CHARACTERS) && game.length > 0 && isRecord(setup) ? { kind: 'setup', game, setup } : null;
}

export function parseHostMessage(raw: unknown): HostMessage | null {
  const json = parseJson(raw, REMOTE_HOST_MESSAGE_MAX_CHARACTERS);
  if (!json) return null;
  const parsers: Readonly<Record<string, () => HostMessage | null>> = {
    u: () => parseSetup(json),
    v: () => (isRecord(json.e) ? { kind: 'event', event: json.e } : null),
    b: () => (isRecord(json.b) ? { kind: 'lobby', lobby: json.b } : null),
    z: () => ({ kind: 'buzz' }),
    g: () => parsePing(json),
    s: () => parseStatus(json),
  };
  return typeof json.k === 'string' && Object.hasOwn(parsers, json.k) ? parsers[json.k]!() : null;
}

/** Allows a burst but not a flood: more than `limit` calls within a second return false. */
export class MessageRateLimit {
  private windowStart = 0;
  private count = 0;

  constructor(
    private readonly limit: number,
    private readonly clock: () => number,
  ) {}

  allows(): boolean {
    const now = this.clock();
    if (now - this.windowStart >= 1000) {
      this.windowStart = now;
      this.count = 0;
    }
    this.count += 1;
    return this.count <= this.limit;
  }
}
