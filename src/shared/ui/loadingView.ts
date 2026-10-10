import { LOADING_SHOW_DELAY_SECONDS, LOADING_TIP_SECONDS } from '../config/loadingTips';
import { t } from '../i18n';
import { LoadingGate } from './loadingGate';

/** Covers the race with the loading screen while the map's models are still loading. */
export class LoadingView {
  private readonly root = document.createElement('c-loading-screen');
  private readonly gate = new LoadingGate(
    () => t().controls.tips,
    LOADING_SHOW_DELAY_SECONDS,
    LOADING_TIP_SECONDS,
    Math.floor(Math.random() * t().controls.tips.length),
  );

  constructor(overlay: HTMLElement) {
    this.root.dataset.testid = 'loading';
    this.root.hidden = true;
    overlay.appendChild(this.root);
  }

  update(waiting: boolean, label: string, frameSeconds: number): void {
    this.gate.update(waiting, frameSeconds);
    this.root.hidden = !this.gate.visible;
    if (!this.gate.visible) return;
    this.root.label = label;
    this.root.tip = this.gate.tip;
  }
}
