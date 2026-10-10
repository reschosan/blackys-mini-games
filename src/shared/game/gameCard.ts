import type { MusicTrackId } from '../audio/music/tracks';
import { t, type Texts } from '../i18n';

/** The buttons of a game outside the kart engine on a touch screen. */
export interface TouchGame {
  /** The main button (jump, fire, flip). */
  readonly actionLabel: string;
  /** A second button, or none. */
  readonly secondActionLabel?: string;
  /** The player turns the camera (right stick, a swipe on the picture). */
  readonly looksAround?: boolean;
}

/** What the party shell needs to know about a game to offer it, explain it and keep its score: no rules, those live in the game. */
export interface GameCard {
  readonly id: string;
  readonly title: string;
  /** One line under the title on the selection card. */
  readonly summary: string;
  /** The few lines of "So wird gespielt" shown before the game starts. */
  readonly rules: readonly string[];
  /** What the card of the lobby shows after the game is chosen, besides the cat: the kart, the plane, the level of memory, or nothing (the cat is made before the vote). */
  readonly lobbyPage?: 'cat' | 'kart' | 'plane' | 'memory';
  /** How many cats the game needs to be worth playing: fewer players are filled up with AI cats for this game (a duel with nobody is no game). */
  readonly minimumSeats?: number;
  /** A kart game where the item button does something else names it here (on the touch screen); otherwise it is "Item". */
  readonly itemButtonLabel?: string;
  /** How a touch screen plays a game outside the kart engine; the stick then moves in every direction. */
  readonly touch?: TouchGame;
  /** The music while the game runs. */
  readonly music: MusicTrackId;
}

export type GameId = keyof Texts['games']['cards'];

/** The fields of a card that come from the texts. */
export type CardTexts = 'title' | 'summary' | 'rules';

/** Gives a card its title, summary and rules from the texts: read when drawn, so they follow a change of language. */
export function withCardTexts<Card extends Omit<GameCard, CardTexts> & { readonly id: GameId }>(card: Card): Card & Pick<GameCard, CardTexts> {
  const texts = (): Texts['games']['cards'][GameId] => t().games.cards[card.id];
  return Object.defineProperties(card, {
    title: { get: () => texts().title, enumerable: true },
    summary: { get: () => texts().summary, enumerable: true },
    rules: { get: () => texts().rules, enumerable: true },
  }) as Card & Pick<GameCard, CardTexts>;
}
