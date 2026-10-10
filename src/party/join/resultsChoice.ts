import type { ResultChoice } from '../../shared/net/messages';
import { ChoiceKeys } from './choiceKeys';

const CHOICES: readonly ResultChoice[] = ['again', 'next', 'lobby'];

/** The choice a button of the result page stands for (its `data-result-option`); anything unknown is the first one. */
export function resultChoiceOf(option: string | null): ResultChoice {
  return CHOICES.find((choice) => choice === option) ?? 'again';
}

/** What a guest phone chooses on the result page when it stands in for a host without a player ("Again", "Next game" or "Back to lobby"):
 *  up and down move between them, OK confirms, a tap on a button chooses at once. */
export class ResultsChoice {
  private readonly keys = new ChoiceKeys(CHOICES.length, {
    moved: () => this.actions.changed(),
    confirmed: (index) => this.choose(CHOICES[index]!),
  });

  constructor(private readonly actions: { choose(choice: ResultChoice): void; changed(): void }) {}

  get selected(): ResultChoice {
    return CHOICES[this.keys.selected]!;
  }

  /** Called with every key state the phone sends; only a key that was just pressed counts, and only while the choice is shown. */
  followKeys(keys: number, shown: boolean): void {
    this.keys.follow(keys, shown);
  }

  choose(choice: ResultChoice): void {
    this.actions.choose(choice);
  }

  reset(): void {
    this.keys.reset();
  }
}
