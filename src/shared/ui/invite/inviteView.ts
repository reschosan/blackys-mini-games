import { t } from '../../i18n';
import { html, nothing, type TemplateResult } from 'lit';
import type { InviteState, InviteStatus } from '../../../party/app/remoteHost';
import { QrScanner, type CameraFacing, type ScannerFailure } from '../../net/qrScanner';
import type { MenuOption } from '../menus/menuOverlay';

/** No code to show: every seat is taken, or everyone who dropped out is back. */
export function isInvitationClosed(status: InviteStatus): boolean {
  return status === 'full' || status === 'complete';
}

export type InviteSlotState = 'you' | 'connected' | 'lost' | 'next' | 'free';

export interface InviteSlot {
  readonly symbol: string;
  readonly color: string;
  readonly state: InviteSlotState;
}

export function inviteHint(): TemplateResult {
  return t().invite.hint;
}

function cameraProblem(failure: ScannerFailure): string {
  const { invite } = t().problems;
  return failure === 'denied' ? invite.cameraDenied : invite.cameraUnavailable;
}

/** The "Invite players" page: the QR code for the next seat on top, the camera below it, and the seats as chips.
 *  The camera reads the answer code by itself, so the host taps nothing between two guests. */
export class InviteView {
  private readonly camera = document.createElement('c-camera-view');
  private readonly scanner: QrScanner;
  private facing: CameraFacing = 'user';
  private cameraProblem: string | null = null;

  constructor(
    private readonly handlers: { onScan(text: string): void; onChange(): void },
    private readonly slots: () => readonly InviteSlot[],
    private readonly state: () => InviteState,
  ) {
    this.scanner = new QrScanner(this.camera.video, {
      onCode: (text) => this.handlers.onScan(text),
      onFailure: (reason) => {
        this.cameraProblem = cameraProblem(reason);
        this.handlers.onChange();
      },
    });
  }

  startCamera(): void {
    this.cameraProblem = null;
    this.camera.mirrored = this.facing === 'user';
    void this.scanner.start(this.facing);
  }

  stopCamera(): void {
    this.scanner.stop();
  }

  switchCamera(): void {
    this.facing = this.facing === 'user' ? 'environment' : 'user';
    this.startCamera();
  }

  options(): readonly MenuOption[] {
    const { invite } = t();
    return [
      { id: 'inviteBack', label: this.state().guestCount > 0 ? invite.done : invite.back },
      { id: 'inviteRenew', label: invite.newCode },
      { id: 'inviteCamera', label: invite.switchCamera },
    ];
  }

  body(): TemplateResult {
    const state = this.state();
    return html`
      <c-stack align="center" gap="m" adapt="centerInPortrait">
        <c-stack direction="row" gap="s" justify="center" wrap role="status" data-invite-slots>
          ${this.slots().map((slot, index) => this.renderSlot(slot, index))}
        </c-stack>
        <c-text tone="soft" aria-live="polite" data-invite-instruction>${this.instruction(state)}</c-text>
        <c-stack gap="m" align="center" adapt="rowInLandscape">
          ${this.renderCode(state)}
          <c-stack align="center" gap="s">
            ${this.camera}
            <c-text tone="muted" size="s">${t().invite.cameraHint}</c-text>
          </c-stack>
        </c-stack>
        ${this.renderProblem(state)}
      </c-stack>`;
  }

  private renderSlot(slot: InviteSlot, index: number): TemplateResult {
    return html`<c-chip mode="color" color=${slot.color} ?dim=${slot.state === 'free'} ?outlined=${slot.state === 'next'}
      aria-label=${t().invite.seat(index + 1, t().invite.slotStates[slot.state])}>
      ${slot.symbol} ${t().invite.slotStates[slot.state]}</c-chip>`;
  }

  private instruction(state: InviteState): string {
    const { invite } = t();
    if (state.status === 'full') return invite.allSeatsTaken;
    if (state.status === 'complete') return invite.allBack;
    if (state.status === 'connecting') return invite.connecting;
    return state.reclaiming ? invite.scanReturning : invite.scanNext;
  }

  private renderCode(state: InviteState): TemplateResult | typeof nothing {
    if (isInvitationClosed(state.status)) return nothing;
    return state.qrText
      ? html`<c-qr-code value=${state.qrText} label=${t().invite.qrLabel} data-invite-qr></c-qr-code>`
      : html`<c-text tone="muted">${t().invite.makingCode}</c-text>`;
  }

  private renderProblem(state: InviteState): TemplateResult | typeof nothing {
    const problem = this.cameraProblem ?? state.problem;
    return problem ? html`<c-text tone="warn" role="alert" data-invite-problem>${problem}</c-text>` : nothing;
  }
}
