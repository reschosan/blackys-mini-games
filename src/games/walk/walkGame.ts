import type { EngineGame } from '../../shared/game/engine';
import { withCardTexts } from '../../shared/game/gameCard';
import { t } from '../../shared/i18n';
import { createWalkSession } from './walkSession';

export const WALK_GAME: EngineGame = withCardTexts({
  id: 'walk',
  touch: {
    get actionLabel() {
      return t().games.buttons.jump;
    },
    get secondActionLabel() {
      return t().games.buttons.paw;
    },
    looksAround: true,
  },
  lobbyPage: 'cat',
  music: 'arena',
  minimumSeats: 4,
  createSession: createWalkSession,
});
