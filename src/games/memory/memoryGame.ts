import type { EngineGame } from '../../shared/game/engine';
import { withCardTexts } from '../../shared/game/gameCard';
import { t } from '../../shared/i18n';
import { createMemorySession } from './memorySession';

export const MEMORY_GAME: EngineGame = withCardTexts({
  id: 'memory',
  touch: {
    get actionLabel() {
      return t().games.buttons.flip;
    },
  },
  lobbyPage: 'memory',
  music: 'memory',
  minimumSeats: 2,
  createSession: createMemorySession,
});
