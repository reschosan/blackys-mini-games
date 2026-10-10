import { describe, expect, it, vi } from 'vitest';
import { createRuntimeRemote } from '../../src/shared/config/remote';
import { t } from '../../src/shared/i18n';
import { currentLanguage } from '../../src/shared/i18n/language';
import { RemoteInput, type RemoteLink } from '../../src/shared/input/remote/remoteInput';
import type { HostMessage } from '../../src/shared/net/messages';

function guestPhone(): { readonly remote: RemoteInput; readonly sent: HostMessage[] } {
  const sent: HostMessage[] = [];
  const link: RemoteLink = { send: vi.fn((message: HostMessage) => sent.push(message)), sendState: vi.fn(), close: vi.fn() };
  return { remote: new RemoteInput(1, link, createRuntimeRemote()), sent };
}

const lobbyText = (): HostMessage => ({ kind: 'lobby', lobby: { headline: t().menus.backToLobby } });

describe('texts for a guest phone in its own language', () => {
  it('uses the host language until the phone says which one it shows', () => {
    const { remote, sent } = guestPhone();
    remote.sendInOwnLanguage(lobbyText);
    expect(sent[0]).toEqual({ kind: 'lobby', lobby: { headline: 'Zurück zur Lobby' } });
  });

  it('makes the texts of a phone that shows English in English, and the host keeps its German', () => {
    const { remote, sent } = guestPhone();
    remote.language = 'en';
    remote.sendInOwnLanguage(lobbyText);
    expect(sent[0]).toEqual({ kind: 'lobby', lobby: { headline: 'Back to lobby' } });
    expect(currentLanguage()).toBe('de');
  });
});
