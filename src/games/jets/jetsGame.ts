import type { EngineGame } from '../../shared/game/engine';
import { withCardTexts } from '../../shared/game/gameCard';
import { t } from '../../shared/i18n';
import { createJetsSession } from './jetsSession';

export const JETS_GAME: EngineGame = withCardTexts({
  id: 'jets',
  touch: {
    get actionLabel() {
      return t().games.buttons.fire;
    },
    get secondActionLabel() {
      return t().games.buttons.item;
    },
  },
  lobbyPage: 'plane',
  music: 'jets',
  minimumSeats: 4,
  createSession: createJetsSession,
});
