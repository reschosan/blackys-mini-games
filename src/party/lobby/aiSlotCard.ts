import { catNameLabel } from '../../shared/i18n/labels';
import { html, type TemplateResult } from 'lit';
import type { CatAppearance } from '../../shared/config/catAppearance';
import type { KartLoadout } from '../../shared/config/kartLoadout';
import type { AiWizardSlotView } from './aiWizard';
import { t } from '../../shared/i18n';

/** An AI seat as the lobby shows it: its cat (name and look) and how strong it plays. */
export interface AiSlotView extends AiWizardSlotView {
  readonly name: string;
  readonly appearance: CatAppearance;
  readonly loadout: KartLoadout;
}

/** The card of an AI cat: its name and picture like a player's card, the strength it plays at, and while player 1 sets the AI up,
 *  one choice for all AI cats at once. */
export function renderAiSlot(index: number, ai: AiSlotView): TemplateResult {
  const { lobby } = t();
  const difficulty = lobby.aiDifficulties[ai.difficulty];
  const status = html`<c-chip mode=${ai.ready ? 'success' : 'default'}>${lobby.aiChip(difficulty)}</c-chip>`;
  const setup = ai.focused
    ? html`<c-text tone="soft" size="s" measure="inset">${lobby.aiSetupHint}</c-text>
      <c-list inset data-ai-wizard-rows>
        <c-setting-row data-row-index="0" label=${lobby.aiStrength} value=${difficulty} ?active=${ai.selectedRow === 0}></c-setting-row>
        <c-setting-row data-row-index="1" label=${lobby.aiAction} value=${ai.pendingAction === 'confirm' ? lobby.ready : lobby.back} ?active=${ai.selectedRow === 1}></c-setting-row>
      </c-list>`
    : status;
  return html`<c-cat-preview-card variant="ai" data-slot=${ai.focused ? 'ai-focused' : 'ai'}>
    <c-header level="4" tone="muted">${catNameLabel(ai.name) || lobby.seat(index + 1)}</c-header>
    <c-preview-frame data-preview-index=${index}></c-preview-frame>
    ${setup}
  </c-cat-preview-card>`;
}
