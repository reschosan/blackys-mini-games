import type { CatView } from '../../../../../shared/cat/catView';
import type { KartLoadout } from '../../../../../shared/config/kartLoadout';
import type { KartState } from '../../../kart/kartState';
import type { KartView } from '../../../kart/views/kartView';
import type { KartProgress } from '../../raceState';
import type { FeedbackState } from './racerFeedback';

/** What the presentation reads of a kart: the same shape on the host (a player) and on a guest (a remote racer). */
export interface PresentedRacer {
  readonly state: Readonly<KartState>;
  readonly progress: Readonly<KartProgress>;
  readonly isAi: boolean;
  readonly viewedElsewhere?: boolean;
  /** Out of the game: not drawn. */
  readonly hidden?: boolean;
}

export interface RacerView {
  readonly view: KartView;
  readonly cat: CatView;
  readonly accentColor: number;
  readonly loadout: KartLoadout;
  feedback: FeedbackState;
}
