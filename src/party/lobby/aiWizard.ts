import { AI_DIFFICULTIES, type AiDifficulty } from '../../shared/config/aiDifficulty';
import type { InputFrame } from '../../shared/input/actions';
import { PlayerLobbyInput } from './playerLobbyInput';

interface AiWizardSlot {
  difficulty: AiDifficulty;
  ready: boolean;
  selectedRow: 0 | 1;
  pendingAction: 'confirm' | 'back';
}

export interface AiWizardSlotView {
  readonly difficulty: AiDifficulty;
  readonly ready: boolean;
  readonly focused: boolean;
  readonly selectedRow: 0 | 1;
  readonly pendingAction: 'confirm' | 'back';
}

function cycle<T>(items: readonly T[], current: T, delta: number): T {
  const index = items.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  return items[(safeIndex + delta + items.length) % items.length]!;
}

function freshSlot(difficulty: AiDifficulty): AiWizardSlot {
  return { difficulty, ready: false, selectedRow: 0, pendingAction: 'confirm' };
}

/**
 * Drives the "player 1 sets the AI up" lobby step (one choice of strength for all AI cats at once, not one per seat): once player 1 is ready, their
 * own input steers a per-slot difficulty pick and a Ready/Back choice, one AI kart at a time.
 * Confirming "Ready" advances to the next slot; confirming "Back" reopens the previous slot
 * (or, on the very first slot, hands control back to player 1's own customization).
 */
export class AiWizard {
  private slots: AiWizardSlot[] = [];
  private defaultDifficulty: AiDifficulty = 'medium';
  private readonly input = new PlayerLobbyInput();

  /** Grows/shrinks the slot list to match the current AI kart count, keeping already-configured
   *  slots untouched. */
  syncCount(count: number): void {
    while (this.slots.length < count) this.slots.push(freshSlot(this.defaultDifficulty));
    this.slots.length = count;
  }

  reset(): void {
    this.slots = [];
  }

  /** Debug-panel convenience: forces every current and future slot to one difficulty. */
  setAllDifficulties(difficulty: AiDifficulty): void {
    this.defaultDifficulty = difficulty;
    for (const slot of this.slots) slot.difficulty = difficulty;
  }

  difficultyFor(aiIndex: number): AiDifficulty {
    return this.slots[aiIndex]?.difficulty ?? this.defaultDifficulty;
  }

  /** Index of the AI slot currently being configured (first not-yet-ready one), or -1 once every
   *  slot is done (or there are none). */
  get focusIndex(): number {
    return this.slots.findIndex((slot) => !slot.ready);
  }

  allReady(): boolean {
    return this.slots.every((slot) => slot.ready);
  }

  /** True while player 1's input should drive the wizard instead of their own customization. */
  isActive(player1Ready: boolean): boolean {
    return player1Ready && this.focusIndex !== -1;
  }

  viewFor(aiIndex: number, focused: boolean): AiWizardSlotView | null {
    const slot = this.slots[aiIndex];
    if (!slot) return null;
    return { difficulty: slot.difficulty, ready: slot.ready, focused, selectedRow: slot.selectedRow, pendingAction: slot.pendingAction };
  }

  /** Applies player 1's frame to the currently focused slot. Confirm always commits
   *  whatever `pendingAction` currently is, even while still on the difficulty row, so the
   *  default "Ready" only needs a single confirm. `onAction`, if given, is called for
   *  navigation and for confirm — purely so the caller can play a matching menu sound, never
   *  affects state here. Returns true if "Back" was confirmed on the very first slot, meaning
   *  the caller must un-ready player 1 themselves. */
  update(frame: InputFrame, onAction?: (kind: 'navigate' | 'confirm') => void): boolean {
    const slot = this.slots[this.focusIndex];
    if (!slot) return false;
    const command = this.input.read(frame);

    if (command.rowDelta !== 0) {
      slot.selectedRow = slot.selectedRow === 0 ? 1 : 0;
      onAction?.('navigate');
    }
    if (command.valueDelta !== 0) {
      this.changeSlotValue(slot, command.valueDelta);
      onAction?.('navigate');
    }
    return command.confirm && this.confirmSlot(slot, onAction);
  }

  /** Mouse equivalent of confirming on the focused slot; true means "Back" on the first slot. */
  confirmFocused(onAction?: (kind: 'navigate' | 'confirm') => void): boolean {
    const slot = this.slots[this.focusIndex];
    return slot ? this.confirmSlot(slot, onAction) : false;
  }

  private confirmSlot(slot: AiWizardSlot, onAction?: (kind: 'navigate' | 'confirm') => void): boolean {
    onAction?.('confirm');
    if (slot.pendingAction === 'confirm') {
      for (const other of this.slots) Object.assign(other, { ready: true, difficulty: slot.difficulty });
      return false;
    }
    const wasFirstSlot = this.focusIndex === 0;
    const previousSlot = this.slots[this.focusIndex - 1];
    Object.assign(slot, { pendingAction: 'confirm', selectedRow: 0 });
    if (previousSlot) previousSlot.ready = false;
    return wasFirstSlot;
  }

  private changeSlotValue(slot: AiWizardSlot, delta: number): void {
    if (slot.selectedRow === 0) slot.difficulty = cycle(AI_DIFFICULTIES, slot.difficulty, delta);
    else slot.pendingAction = slot.pendingAction === 'confirm' ? 'back' : 'confirm';
  }

  /** Mouse equivalent of navigating to a row (clicking it directly instead of steering there). */
  selectRow(rowIndex: 0 | 1): void {
    const slot = this.slots[this.focusIndex];
    if (slot) slot.selectedRow = rowIndex;
  }

  /** Mouse equivalent of a value-change edge on the currently selected row (clicking a ◀/▶
   *  arrow instead of steering). Confirming is still done with the controller. */
  changeValue(delta: -1 | 1): void {
    const slot = this.slots[this.focusIndex];
    if (slot) this.changeSlotValue(slot, delta);
  }
}
