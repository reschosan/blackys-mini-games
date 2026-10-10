// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import '../../src/shared/ui/components/index';
import type { JoinedPlayer } from '../../src/shared/input/inputManager';
import { GAMES } from '../../src/party/games';
import { MapVoteView } from '../../src/party/lobby/mapVoteView';

const players: JoinedPlayer[] = [{ source: { kind: 'gamepad', gamepadIndex: 0 }, deviceName: 'Gamepad 1' }];
const maps = Array.from({ length: 12 }, (_, index) => ({ name: `Karte ${index + 1}` }));
const nameFor = (index: number) => `Katze ${index + 1}`;

afterEach(() => document.body.replaceChildren());

function newView() {
  const overlay = document.createElement('div');
  document.body.appendChild(overlay);
  return new MapVoteView(overlay, { onMapClick: () => undefined, onBackClick: () => undefined });
}

describe('map vote with more maps than fit on the screen', () => {
  it('scrolls the card someone moved to into view, also far down the list', () => {
    const scrolled: string[] = [];
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (this: Element) {
      scrolled.push(this.getAttribute('data-map-index') ?? 'back');
    });
    const view = newView();
    view.update(maps, players, () => ({ mapIndex: 0, confirmed: false }), nameFor, GAMES[0]!);
    view.update(maps, players, () => ({ mapIndex: 9, confirmed: false }), nameFor, GAMES[0]!);
    expect(scrolled.at(-1)).toBe('9');
  });

  it('scrolls to "Zurück" when the cursor is on it, and not at all while nobody moves', () => {
    const scrolled: string[] = [];
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (this: Element) {
      scrolled.push(this.getAttribute('data-map-index') ?? 'back');
    });
    const view = newView();
    view.update(maps, players, () => ({ mapIndex: 12, confirmed: false }), nameFor, GAMES[0]!);
    expect(scrolled).toEqual(['back']);
    view.update(maps, players, () => ({ mapIndex: 12, confirmed: false }), nameFor, GAMES[0]!);
    expect(scrolled).toEqual(['back']);
  });
});

describe('page height on tablets and phones', () => {
  it('uses the visible height (dvh) for the page and the UI scale, not the height behind the browser bars', () => {
    const css = readFileSync('src/shared/ui/style.css', 'utf-8');
    expect(css).toContain('height: 100dvh');
    expect(css).toMatch(/@supports \(height: 100dvh\)[\s\S]*1\.6dvh/);
  });
});
