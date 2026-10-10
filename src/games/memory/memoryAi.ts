import type { Rng } from '../../shared/core/rng';

/** What an AI cat remembers: the motif of cards it has seen, by position. */
export type MemoryKnowledge = Map<number, number>;

interface Choice {
  readonly hidden: readonly number[];
  readonly knowledge: MemoryKnowledge;
  /** The first card of this turn, or -1 while the first one is still to pick. */
  readonly firstCard: number;
  readonly motifs: readonly number[];
  readonly rng: Rng;
}

function knownPair(hidden: readonly number[], knowledge: MemoryKnowledge): number {
  for (const card of hidden) {
    const motif = knowledge.get(card);
    const partner = hidden.find((other) => other !== card && knowledge.get(other) === motif);
    if (motif !== undefined && partner !== undefined) return card;
  }
  return -1;
}

/** The card an AI cat flips next: one half of a pair it knows, the partner of the card it just flipped when it knows it, otherwise a card it has not seen. */
export function pickMemoryCard({ hidden, knowledge, firstCard, motifs, rng }: Choice): number {
  if (firstCard >= 0) {
    const motif = motifs[firstCard];
    const partner = hidden.find((card) => card !== firstCard && knowledge.get(card) === motif);
    if (partner !== undefined) return partner;
  } else {
    const pair = knownPair(hidden, knowledge);
    if (pair >= 0) return pair;
  }
  const unseen = hidden.filter((card) => card !== firstCard && !knowledge.has(card));
  const pool = unseen.length > 0 ? unseen : hidden.filter((card) => card !== firstCard);
  return pool[rng.nextInt(pool.length)]!;
}
