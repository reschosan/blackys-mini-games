import { catNameLabel } from '../../shared/i18n/labels';
import { html, type TemplateResult } from 'lit';
import type { StatusMessage } from '../../shared/net/messages';
import { ChoiceKeys } from './choiceKeys';
import { t } from '../../shared/i18n';

export type PauseOption = 'resume' | 'leave';

export interface PausePanelActions {
  resume(): void;
  leave(): void;
  /** The panel looks different now (selection moved, a question appeared). */
  changed(): void;
}

/** The pause panel of a guest phone that draws the race itself: who paused, "Resume" and "Leave game". The cross works here at
 *  once (up and down choose, OK confirms); "Leave game" asks once more before it acts. */
export class PausePanel {
  private confirmingLeave = false;
  private readonly keys = new ChoiceKeys(2, {
    moved: () => {
      this.confirmingLeave = false;
      this.actions.changed();
    },
    confirmed: (index) => this.choose(index === 0 ? 'resume' : 'leave'),
  });

  constructor(private readonly actions: PausePanelActions) {}

  /** The panel is not shown: the next time it opens it starts at "Resume". */
  reset(): void {
    this.keys.reset();
    this.confirmingLeave = false;
  }

  /** Called with every key state the phone sends; only a key that was just pressed counts, and only while the panel is shown. */
  followKeys(keys: number, shown: boolean): void {
    this.keys.follow(keys, shown);
  }

  choose(option: PauseOption): void {
    if (option === 'resume') {
      this.confirmingLeave = false;
      this.actions.resume();
    } else if (this.confirmingLeave) {
      this.actions.leave();
    } else {
      this.confirmingLeave = true;
      this.actions.changed();
    }
  }

  template(status: StatusMessage, controlButtons: TemplateResult): TemplateResult {
    const { join, menus } = t();
    const who = status.pausedBy ? join.pausedBy(catNameLabel(status.pausedBy)) : join.gamePaused;
    const leaveLabel = this.confirmingLeave ? join.reallyLeave : join.leaveGame;
    return html`<c-screen tone="dim" data-guest-pause>
      <c-header>${menus.paused}</c-header>
      <c-text tone="soft">${who}</c-text>
      <c-list gap="m">
        <c-list-item><c-button grow data-pause-option="resume" label=${menus.resume} ?active=${this.keys.selected === 0}></c-button></c-list-item>
        <c-list-item>
          <c-button grow data-pause-option="leave" mode="cancel" label=${leaveLabel} ?active=${this.keys.selected === 1}></c-button>
        </c-list-item>
      </c-list>
      <c-text tone="muted" size="s" measure="prose">${join.pauseHint}</c-text>
      ${controlButtons}
    </c-screen>`;
  }
}
