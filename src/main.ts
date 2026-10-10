import './shared/ui/tailwind.css';
import './shared/ui/components';
import { Game } from './party/app/game';
import { loadCatModelSource } from './shared/cat/catModelLoader';
import type { CLoadingScreen } from './shared/ui/components/cLoadingScreen';
import { watchScreenSize } from './party/app/screenSize';
import { catModelMissing, webglUnavailable } from './shared/ui/problemTexts';
import { ProblemView } from './shared/ui/problemView';
import { t } from './shared/i18n';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const overlay = document.querySelector<HTMLElement>('#overlay');
const touchRoot = document.querySelector<HTMLElement>('#touch-controls');
if (!canvas || !overlay || !touchRoot) throw new Error('game canvas, overlay or touch controls not found');

const BOOT_SCREEN_FADE_MILLISECONDS = 400;

const problems = new ProblemView(overlay);
const bootScreen = document.querySelector<CLoadingScreen>('#boot-screen');
if (bootScreen) {
  bootScreen.label = t().controls.booting;
  bootScreen.tip = t().controls.bootTip;
}

function startGame(gameCanvas: HTMLCanvasElement, gameOverlay: HTMLElement, gameTouchRoot: HTMLElement): Game | null {
  try {
    return new Game(gameCanvas, gameOverlay, gameTouchRoot, problems);
  } catch (error) {
    console.error('Game could not be created', error);
    bootScreen?.remove();
    problems.showFatal(webglUnavailable());
    return null;
  }
}

watchScreenSize(window, document.documentElement);
const game = startGame(canvas, overlay, touchRoot);
if (game) {
  window.__game = {
    getState: () => game.getState(),
    startEnduranceRace: (mapIndex, accelerated) => game.dev.startEnduranceRace(mapIndex, accelerated),
    submitInviteScan: (text) => game.dev.submitInviteScan(text),
    startGameForTest: (gameId, accelerated) => game.dev.startGameForTest(gameId, accelerated),
    showResultsForTest: () => game.dev.showResultsForTest(),
  };
  game.start();

  void loadCatModelSource()
    .catch(() => problems.showNotice(catModelMissing()))
    .then(() => {
      if (!bootScreen) return;
      bootScreen.leaving = true;
      window.setTimeout(() => bootScreen.remove(), BOOT_SCREEN_FADE_MILLISECONDS);
    });
}
