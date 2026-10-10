import { html, nothing, render } from 'lit';
import type { FatalProblem, ProblemNotice } from './problemTexts';

/** Tells the player what went wrong: a blocking screen when the game cannot go on, and a short notice
 *  at the bottom when something is only reduced. A notice with the same text shows once per page load. */
export class ProblemView {
  private readonly root = document.createElement('div');
  private readonly shownNoticeTexts = new Set<string>();
  private fatal: FatalProblem | null = null;
  private notice: ProblemNotice | null = null;
  private noticeSecondsLeft = 0;

  constructor(overlay: HTMLElement) {
    this.root.dataset.testid = 'problems';
    overlay.appendChild(this.root);
  }

  showFatal(problem: FatalProblem): void {
    this.fatal = problem;
    this.draw();
  }

  clearFatal(): void {
    this.fatal = null;
    this.draw();
  }

  showNotice(notice: ProblemNotice): void {
    if (this.shownNoticeTexts.has(notice.text)) return;
    this.shownNoticeTexts.add(notice.text);
    this.notice = notice;
    this.noticeSecondsLeft = notice.seconds;
    this.draw();
  }

  update(frameSeconds: number): void {
    if (!this.notice) return;
    this.noticeSecondsLeft -= frameSeconds;
    if (this.noticeSecondsLeft > 0) return;
    this.notice = null;
    this.draw();
  }

  private draw(): void {
    const notice = this.notice ? html`<c-alert-banner raised>${this.notice.text}</c-alert-banner>` : nothing;
    render(html`${this.fatalTemplate()}${notice}`, this.root);
  }

  private fatalTemplate() {
    const problem = this.fatal;
    if (!problem) return nothing;
    const button = problem.buttonLabel
      ? html`<c-button label=${problem.buttonLabel} mode="success" size="l" @click=${() => window.location.reload()}></c-button>`
      : nothing;
    return html`<c-modal><c-panel role="alert"><c-header level="2">${problem.title}</c-header><c-text measure="column">${problem.text}</c-text>${button}</c-panel></c-modal>`;
  }
}
