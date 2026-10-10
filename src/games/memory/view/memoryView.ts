import { html, render } from 'lit';
import type * as THREE from 'three';
import type { EngineSeat, EngineSnapshot } from '../../../shared/game/engine';
import type { EngineView } from '../../../shared/game/engineView';
import type { MemoryCardState } from '../../../shared/ui/components/cMemoryCard';
import { t } from '../../../shared/i18n';

/** The pictures of the cards; their names are in the texts in the same order (`games.memoryMotifs`). */
const MOTIF_FACES: readonly string[] = ['🐠', '🧶', '🐭', '🥛', '🐦', '🪶', '🦴', '🐾', '🐈', '🌿', '🔔', '🧺'];
/** A card is about this much higher than wide. */
const CARD_HEIGHT_PER_WIDTH = 1.35;
const CARD_STATES: readonly MemoryCardState[] = ['hidden', 'open', 'matched'];
/** As wide as the screen allows for cards of the right shape (`--ratio`); on a phone the touch controls below take their room. */
const BOARD_CLASSES =
  'grid gap-2 sm:gap-3 w-[min(92vw,calc((100dvh-12rem)*var(--ratio)))] ' +
  '[@media(pointer:coarse)_and_(max-width:500px)]:w-[min(92vw,calc((100dvh-22rem)*var(--ratio)))]';

interface MemoryPicture {
  readonly cards: readonly number[];
  readonly states: readonly number[];
  readonly turn: number;
  readonly cursor: number;
  readonly columns: number;
}

function readPicture(snapshot: EngineSnapshot): MemoryPicture | null {
  const { cards, states, turn, cursor, columns } = snapshot;
  const valid =
    Array.isArray(cards) && Array.isArray(states) && typeof turn === 'number' && typeof cursor === 'number' && typeof columns === 'number' && columns > 0;
  return valid ? { cards: cards as number[], states: states as number[], turn, cursor, columns } : null;
}

/** The memory board: the cards of the chosen level in rows, the cursor in the colour of the cat whose turn it is. */
export class MemoryView implements EngineView {
  readonly scene: THREE.Scene | null = null;
  private root: HTMLElement | null = null;
  private picture: MemoryPicture | null = null;

  constructor(private readonly seats: readonly EngineSeat[]) {}

  mount(root: HTMLElement): void {
    this.root = document.createElement('div');
    this.root.dataset.testid = 'memory-board';
    root.appendChild(this.root);
  }

  apply(snapshot: EngineSnapshot): void {
    this.picture = readPicture(snapshot) ?? this.picture;
  }

  frame(): void {
    const { root, picture } = this;
    if (!root || !picture) return;
    const colour = this.seats[picture.turn]?.color ?? '';
    const cards = picture.cards.map(
      (motif, index) => html`
      <c-memory-card face=${MOTIF_FACES[motif] ?? ''} label=${t().games.memoryMotifs[motif] ?? ''} state=${CARD_STATES[picture.states[index] ?? 0] ?? 'hidden'}
        cursor=${index === picture.cursor ? colour : ''} data-pick-index=${index}></c-memory-card>`,
    );
    const ratio = picture.columns / (Math.ceil(picture.cards.length / picture.columns) * CARD_HEIGHT_PER_WIDTH);
    const layout = `--ratio: ${ratio}; grid-template-columns: repeat(${picture.columns}, minmax(0, 1fr));`;
    render(html`<c-screen tone="dim"><div class=${BOARD_CLASSES} style=${layout}>${cards}</div></c-screen>`, root);
  }

  camerasFor(): readonly THREE.PerspectiveCamera[] {
    return [];
  }

  dispose(): void {
    if (this.root) render(html``, this.root);
    this.root?.remove();
    this.root = null;
  }
}
