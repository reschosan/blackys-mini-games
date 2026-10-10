import { t } from '../../shared/i18n';
import { MAX_PLAYERS } from '../../shared/config/players';
import { JOIN_PAGE_FILE, REMOTE_ANSWER_PREFIX, REMOTE_OFFER_HASH_KEY, type RemoteConfig } from '../../shared/config/remote';
import type { InputManager } from '../../shared/input/inputManager';
import { RemoteInput, type RemoteLink } from '../../shared/input/remote/remoteInput';
import type { GuestControlMessage } from '../../shared/net/messages';
import { HostInvitation } from '../../shared/net/hostInvitation';
import { parseGuestControl, parseGuestMessage, serializeHostMessage } from '../../shared/net/messages';
import { isInvitationClosed } from '../../shared/ui/invite/inviteView';

/** `complete`: nobody new may join now (a race is on) and nobody is missing. */
export type InviteStatus = 'preparing' | 'waiting' | 'connecting' | 'full' | 'complete';

export interface InviteState {
  readonly status: InviteStatus;
  /** What the QR code shows: the address of the join page with the offer in it. */
  readonly qrText: string | null;
  readonly secondsLeft: number;
  readonly problem: string | null;
  /** A phone that was lost comes back to its old seat, not to a new one. */
  readonly reclaiming: boolean;
  readonly guestCount: number;
}

const CONNECTING_TIMEOUT_SECONDS = 15;

/** The address of the join page; a host opened with `?debug` hands that on, so the guest phone shows its measurements. */
function joinPageAddress(): string {
  const address = new URL(JOIN_PAGE_FILE, window.location.href);
  if (new URLSearchParams(window.location.search).has('debug')) address.searchParams.set('debug', '');
  return address.href;
}

/** Hands out one invitation at a time: a QR code for the next free seat, then the answer the guest shows back.
 *  Several guests join one after the other; a phone that dropped out is offered its old seat first. */
export class RemoteHost {
  private invitation: HostInvitation | null = null;
  private readonly guestOf = new Map<HostInvitation, RemoteInput>();
  private generation = 0;
  private active = false;
  private status: InviteStatus = 'preparing';
  private qrText: string | null = null;
  private problem: string | null = null;
  private reclaiming = false;
  private ageSeconds = 0;
  private lastIgnoredScan = '';

  constructor(
    private readonly input: InputManager,
    private readonly config: RemoteConfig,
    private readonly events: {
      guestJoined(): void;
      /** New seats only in the lobby; during a race only a seat that was lost can be taken again. */
      canAddSeats(): boolean;
      /** A guest that dropped out got its old seat back; a race may be under way. */
      guestReturned(guest: RemoteInput): void;
      guestMessage(guest: RemoteInput, message: GuestControlMessage): void;
      changed(): void;
    },
  ) {}

  get state(): InviteState {
    return {
      status: this.status,
      qrText: this.qrText,
      problem: this.problem,
      reclaiming: this.reclaiming,
      secondsLeft: Math.max(Math.ceil(this.config.inviteLifetimeSeconds - this.ageSeconds), 0),
      guestCount: this.input.remoteInputs.filter((remote) => remote.connected).length,
    };
  }

  get isOpen(): boolean {
    return this.active;
  }

  open(): void {
    this.active = true;
    this.problem = null;
    void this.startInvitation();
  }

  close(): void {
    this.active = false;
    this.cancelPending();
  }

  renew(): void {
    this.cancelPending();
    void this.startInvitation();
  }

  tick(stepSeconds: number): void {
    if (!this.active || this.status === 'preparing' || isInvitationClosed(this.status)) return;
    this.ageSeconds += stepSeconds;
    if (this.status === 'connecting' && this.ageSeconds > CONNECTING_TIMEOUT_SECONDS) this.failWith(t().problems.invite.connectionFailed);
    else if (this.status === 'waiting' && this.ageSeconds > this.config.inviteLifetimeSeconds) this.renew();
  }

  /** Called with every QR code the camera reads. The same wrong code is only reported once. */
  async submitScan(text: string): Promise<void> {
    const invitation = this.invitation;
    if (!invitation || this.status !== 'waiting') return;
    if (!text.startsWith(REMOTE_ANSWER_PREFIX)) {
      this.reportOnce(text, text.includes(`#${REMOTE_OFFER_HASH_KEY}=`) ? t().problems.invite.invitationScanned : t().problems.invite.notMyCode);
      return;
    }
    this.status = 'connecting';
    this.ageSeconds = 0;
    this.events.changed();
    if (await invitation.acceptAnswerCode(text.slice(REMOTE_ANSWER_PREFIX.length))) return;
    if (this.invitation === invitation) this.failWith(t().problems.invite.notMyCode);
  }

  private reportOnce(text: string, problem: string): void {
    if (text === this.lastIgnoredScan) return;
    this.lastIgnoredScan = text;
    this.problem = problem;
    this.events.changed();
  }

  private failWith(problem: string): void {
    this.cancelPending();
    this.problem = problem;
    void this.startInvitation();
  }

  private cancelPending(): void {
    this.generation += 1;
    this.invitation?.cancel();
    this.invitation = null;
    this.qrText = null;
  }

  private async startInvitation(): Promise<void> {
    const lostSeat = this.input.remoteInputs.find((remote) => !remote.connected);
    if (!lostSeat && !this.events.canAddSeats()) {
      this.status = 'complete';
      this.problem = null;
      this.events.changed();
      return;
    }
    if (!lostSeat && this.input.players.length >= MAX_PLAYERS) {
      this.status = 'full';
      this.problem = t().problems.invite.full;
      this.events.changed();
      return;
    }
    const generation = ++this.generation;
    this.status = 'preparing';
    this.reclaiming = lostSeat !== undefined;
    this.ageSeconds = 0;
    this.events.changed();
    const invitation = this.createInvitation(lostSeat?.id);
    this.invitation = invitation;
    try {
      const code = await invitation.createOfferCode();
      if (generation !== this.generation) return;
      this.qrText = `${joinPageAddress()}#${REMOTE_OFFER_HASH_KEY}=${code}`;
      this.status = 'waiting';
    } catch {
      if (generation !== this.generation) return;
      this.problem = t().problems.invite.codeFailed;
    }
    this.events.changed();
  }

  private createInvitation(seatId: number | undefined): HostInvitation {
    const holder: { invitation?: HostInvitation } = {};
    const invitation = new HostInvitation(
      this.config,
      {
        onOpen: () => this.guestConnected(holder.invitation!),
        onLost: () => this.connectionLost(holder.invitation!),
        onRawInput: (raw) => this.routeInput(holder.invitation!, raw),
        onRawControl: (raw) => this.routeControl(holder.invitation!, raw),
        onRawState: () => undefined,
      },
      seatId,
    );
    holder.invitation = invitation;
    return invitation;
  }

  private linkOf(invitation: HostInvitation): RemoteLink {
    return {
      send: (message) => invitation.peerLink.sendControl(serializeHostMessage(message)),
      sendState: (data) => invitation.peerLink.sendState(data),
      close: () => invitation.cancel(),
    };
  }

  private guestConnected(invitation: HostInvitation): void {
    const link = this.linkOf(invitation);
    const returning = invitation.seatId === undefined ? undefined : this.input.remoteById(invitation.seatId);
    const guest = returning ?? new RemoteInput(this.input.nextRemoteId(), link, this.config);
    if (returning) returning.reconnect(link);
    else if (!this.input.addRemote(guest)) {
      invitation.cancel();
      this.failWith(t().problems.invite.full);
      return;
    }
    this.guestOf.set(invitation, guest);
    this.invitation = null;
    this.problem = null;
    if (returning) this.events.guestReturned(guest);
    else this.events.guestJoined();
    if (this.active) void this.startInvitation();
    else this.events.changed();
  }

  private connectionLost(invitation: HostInvitation): void {
    const guest = this.guestOf.get(invitation);
    if (guest) {
      this.guestOf.delete(invitation);
      guest.markLost();
      if (this.active && this.status === 'waiting' && !this.reclaiming) this.renew();
      else this.events.changed();
      return;
    }
    if (this.invitation === invitation) this.failWith(t().problems.invite.connectionFailed);
  }

  private routeControl(invitation: HostInvitation, raw: unknown): void {
    const message = parseGuestControl(raw);
    const guest = this.guestOf.get(invitation);
    if (!message || !guest) return;
    if (message.kind === 'pong') guest.receivePong(message.sentAt);
    else this.events.guestMessage(guest, message);
  }

  private routeInput(invitation: HostInvitation, raw: unknown): void {
    const message = parseGuestMessage(raw);
    const guest = this.guestOf.get(invitation);
    if (message && guest) guest.receive(message);
  }
}
