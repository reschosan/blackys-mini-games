import type { Game } from './party/app/game';

declare global {
  /** Set by the build (`vite.config.ts`): equal on the host and on a guest of the same build. */
  const __BUILD_ID__: string;

  interface Window {
    /** Debug hook of the guest page (`join.html`): what the phone shows and how the prediction does. */
    __guest?: { getState: () => unknown };
    __game: {
      getState: () => ReturnType<Game['getState']>;
      startEnduranceRace: (mapIndex: number, accelerated?: boolean) => boolean;
      startGameForTest: (gameId: string, accelerated?: boolean) => boolean;
      submitInviteScan: (text: string) => Promise<void>;
      showResultsForTest: () => void;
    };
  }
}

export {};
