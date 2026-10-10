/** Phones that join the host over a direct connection. */
export interface RemoteConfig {
  /** Input messages per second a guest sends, also while nothing is pressed (they double as heartbeat). */
  inputSendHz: number;
  /** Without a message for this long a guest's kart gets neutral input and rolls out. */
  staleInputMilliseconds: number;
  /** The host: without input from a guest for this long the connection counts as lost. */
  lostConnectionMilliseconds: number;
  /** The guest: without status from the host for this long the connection counts as lost. */
  hostSilenceMilliseconds: number;
  /** A lost player keeps the seat this long in the lobby before it is given up. */
  seatReservationSeconds: number;
  /** An invitation code that nobody answered is replaced by a fresh one after this long. */
  inviteLifetimeSeconds: number;
  /** How long the browser may collect connection candidates before the code is made. */
  candidateGatherMilliseconds: number;
  /** How often the host tells guests about place, lap and item. */
  statusSendHz: number;
  /** Own-screen guests: snapshots of the race per second. */
  snapshotHz: number;
  /** Other karts are drawn this far in the past, so there are always two snapshots to blend between. */
  interpolationDelayMilliseconds: number;
  /** The delay grows by itself when snapshots arrive in lumps (a lost or late one), up to this; it shrinks again when the connection calms down. */
  maxInterpolationDelayMilliseconds: number;
  /** Longest a kart is carried on from its last snapshot when none arrives (loss, lag spike). */
  maxExtrapolationMilliseconds: number;
  /** The host holds the countdown this long for guests that are still loading the map. */
  readyWaitSeconds: number;
  /** Own kart: an error between prediction and host up to this many meters is blended away, a bigger one snaps. */
  predictionSnapMeters: number;
  /** Own kart: how fast the visible error melts away (share per second, 1 = one second for all of it). */
  predictionBlendPerSecond: number;
  /** Own kart: oldest unanswered input that is kept for replaying after a snapshot. */
  predictionHistorySeconds: number;
}

const DEFAULT_REMOTE: Readonly<RemoteConfig> = Object.freeze({
  inputSendHz: 60,
  staleInputMilliseconds: 150,
  lostConnectionMilliseconds: 2000,
  hostSilenceMilliseconds: 6000,
  seatReservationSeconds: 30,
  inviteLifetimeSeconds: 60,
  candidateGatherMilliseconds: 2500,
  statusSendHz: 4,
  snapshotHz: 30,
  interpolationDelayMilliseconds: 100,
  maxInterpolationDelayMilliseconds: 220,
  maxExtrapolationMilliseconds: 250,
  readyWaitSeconds: 20,
  predictionSnapMeters: 3,
  predictionBlendPerSecond: 8,
  predictionHistorySeconds: 1,
} satisfies RemoteConfig);

export function createRuntimeRemote(): RemoteConfig {
  return { ...DEFAULT_REMOTE };
}

export const REMOTE_MESSAGE_MAX_CHARACTERS = 400;
/** The host's setup of a race (cats, karts, map) is longer than anything a guest sends. */
export const REMOTE_HOST_MESSAGE_MAX_CHARACTERS = 6000;
export const REMOTE_STATE_MAX_BYTES = 4096;
export const REMOTE_MAX_MESSAGES_PER_SECOND = 240;
export const REMOTE_PROTOCOL_VERSION = 1;
export const REMOTE_ANSWER_PREFIX = 'catkart-a:';
export const REMOTE_OFFER_HASH_KEY = 'o';
export const JOIN_PAGE_FILE = 'join.html';
