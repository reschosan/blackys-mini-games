import { playerDisplayName } from '../../shared/i18n/labels';
import type { EngineSession, EngineSetup, EngineSnapshot } from '../../shared/game/engine';
import { placesByScoreDescending } from '../../shared/game/ranking';
import type { InputFrame } from '../../shared/input/actions';
import { DEFAULT_MEMORY_LEVEL, MEMORY_LEVELS, memoryColumnsFor } from '../../shared/config/memoryLevels';
import { GOLDEN_MOTIF, GOLDEN_POINTS } from './memoryTuning';
import { pickMemoryCard, type MemoryKnowledge } from './memoryAi';
import { t as texts } from '../../shared/i18n';

type CardState = 0 | 1 | 2;
const HIDDEN: CardState = 0;
const UP: CardState = 1;
const MATCHED: CardState = 2;

type Phase = 'first' | 'second' | 'reveal';

const MOVE_THRESHOLD = 0.6;

function directionOf(value: number): -1 | 0 | 1 {
  if (value > MOVE_THRESHOLD) return 1;
  return value < -MOVE_THRESHOLD ? -1 : 0;
}

/** Memory for cats: the players take turns flipping two cards; a pair stays up and its player goes on, otherwise the cards turn back and the next one is up.
 *  The golden fish pair is worth three, and a player who takes too long gets a card flipped for them. */
export function createMemorySession({ seats, rng, tuning, level = DEFAULT_MEMORY_LEVEL }: EngineSetup): EngineSession {
  const t = tuning.memory;
  const pairCount = MEMORY_LEVELS[level] ?? MEMORY_LEVELS[DEFAULT_MEMORY_LEVEL]!;
  const columns = memoryColumnsFor(pairCount);
  const motifs = Array.from({ length: pairCount * 2 }, (_, index) => index % pairCount);
  for (let index = motifs.length - 1; index > 0; index -= 1) {
    const swap = rng.nextInt(index + 1);
    [motifs[index], motifs[swap]] = [motifs[swap]!, motifs[index]!];
  }
  const state: CardState[] = motifs.map(() => HIDDEN);
  const pairs = seats.map(() => 0);
  const points = seats.map(() => 0);
  const knowledge: MemoryKnowledge = new Map();
  let turn = 0;
  let cursor = 0;
  let phase: Phase = 'first';
  let firstCard = -1;
  let timer = seats[0]?.isAi ? t.thinkSeconds : t.humanThinkSeconds;
  let heldMove = 0;
  let previousFlip = false;

  const rows = motifs.length / columns;
  const thinkSeconds = (): number => (seats[turn]?.isAi ? t.thinkSeconds : t.humanThinkSeconds);

  const flip = (card: number): void => {
    state[card] = UP;
    if (rng.next() < t.rememberChance) knowledge.set(card, motifs[card]!);
    if (phase === 'first') {
      firstCard = card;
      phase = 'second';
      timer = thinkSeconds();
      return;
    }
    phase = 'reveal';
    timer = t.revealSeconds;
  };

  const endOfReveal = (): void => {
    const second = state.findIndex((value, card) => value === UP && card !== firstCard);
    if (motifs[firstCard] === motifs[second]) {
      state[firstCard] = MATCHED;
      state[second] = MATCHED;
      pairs[turn] = pairs[turn]! + 1;
      points[turn] = points[turn]! + (motifs[firstCard] === GOLDEN_MOTIF ? GOLDEN_POINTS : 1);
      knowledge.delete(firstCard);
      knowledge.delete(second);
    } else {
      state[firstCard] = HIDDEN;
      state[second] = HIDDEN;
      turn = (turn + 1) % seats.length;
    }
    firstCard = -1;
    phase = 'first';
    timer = thinkSeconds();
    cursor = state.findIndex((value) => value === HIDDEN);
  };

  const moveCursor = (frame: InputFrame): void => {
    const x = frame.move?.x ?? frame.steer;
    const y = frame.move?.y ?? 0;
    const horizontal = Math.abs(x) >= Math.abs(y) ? directionOf(x) : 0;
    const vertical = horizontal === 0 ? directionOf(y) : 0;
    if (horizontal === 0 && vertical === 0) {
      heldMove = 0;
      return;
    }
    if (heldMove > 0) return;
    heldMove = t.moveRepeatSeconds;
    const column = ((cursor % columns) + horizontal + columns) % columns;
    const row = (Math.floor(cursor / columns) + vertical + rows) % rows;
    cursor = row * columns + column;
  };

  const humanTurn = (frame: InputFrame | undefined, stepSeconds: number): void => {
    heldMove = Math.max(heldMove - stepSeconds, 0);
    timer -= stepSeconds;
    if (timer <= 0) {
      flipForSlowPlayer();
      return;
    }
    if (!frame) return;
    if (frame.pick !== undefined && state[frame.pick] === HIDDEN) {
      cursor = frame.pick;
      flip(frame.pick);
      return;
    }
    moveCursor(frame);
    const flipPressed = frame.useItem || frame.confirm || frame.drift;
    if (flipPressed && !previousFlip && state[cursor] === HIDDEN) flip(cursor);
    previousFlip = flipPressed;
  };

  const flipForSlowPlayer = (): void => {
    const hidden = state.flatMap((value, card) => (value === HIDDEN ? [card] : []));
    cursor = hidden.includes(cursor) ? cursor : hidden[rng.nextInt(hidden.length)]!;
    flip(cursor);
  };

  const aiTurn = (stepSeconds: number): void => {
    timer -= stepSeconds;
    if (timer > 0) return;
    const hidden = state.flatMap((value, card) => (value === HIDDEN ? [card] : []));
    const choice = pickMemoryCard({ hidden, knowledge, firstCard, motifs, rng });
    cursor = choice;
    flip(choice);
  };

  return {
    step(frames, stepSeconds) {
      if (state.every((value) => value === MATCHED)) return;
      if (phase === 'reveal') {
        timer -= stepSeconds;
        if (timer <= 0) endOfReveal();
        return;
      }
      if (seats[turn]?.isAi) aiTurn(stepSeconds);
      else humanTurn(frames[turn], stepSeconds);
    },
    get over() {
      return state.every((value) => value === MATCHED);
    },
    places: () => placesByScoreDescending(points),
    detail: (slot) => texts().games.status.points(points[slot]!),
    cardText: (slot) => texts().games.status.points(points[slot]!) + (slot === turn ? texts().games.status.yourTurn : ''),
    statusLines: () => {
      const { status } = texts().games;
      return [status.turnOf(playerDisplayName(seats[turn]?.name ?? '', turn)), status.pairs(state.filter((value) => value === MATCHED).length / 2, pairCount)];
    },
    snapshot: (): EngineSnapshot => ({
      cards: state.map((value, card) => (value === HIDDEN ? -1 : motifs[card]!)),
      states: [...state],
      turn,
      cursor,
      columns,
      points: [...points],
      phase,
    }),
  };
}
