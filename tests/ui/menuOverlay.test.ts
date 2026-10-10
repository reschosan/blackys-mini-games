// @vitest-environment happy-dom
import { html } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import '../../src/shared/ui/components/index';
import { inLanguage } from '../../src/shared/i18n/language';
import { MenuOverlay, type MenuOption } from '../../src/shared/ui/menus/menuOverlay';

const OPTIONS: readonly MenuOption[] = [
  { id: 'one', label: 'Eins' },
  { id: 'two', label: 'Zwei' },
  { id: 'three', label: 'Drei' },
];

afterEach(() => document.body.replaceChildren());

function openOverlay(): MenuOverlay {
  const root = document.createElement('div');
  document.body.append(root);
  const overlay = new MenuOverlay(root, () => undefined);
  overlay.open('Titel', html`<p>Inhalt</p>`, OPTIONS);
  return overlay;
}

describe('MenuOverlay.refresh', () => {
  it('shows the default hint in the selected language', () => {
    inLanguage('en', () => openOverlay());
    expect(document.body.textContent).toContain('Choose with Up/Down');
    document.body.replaceChildren();
    inLanguage('de', () => openOverlay());
    expect(document.body.textContent).toContain('Wählen mit Hoch/Runter');
  });

  it('keeps the selected option while the page content changes', () => {
    const overlay = openOverlay();
    overlay.moveSelection(1);
    overlay.refresh(html`<p>Neuer Inhalt</p>`, OPTIONS);
    expect(overlay.selectedOptionId).toBe('two');
    expect(document.body.textContent).toContain('Neuer Inhalt');
  });

  it('selects the first option when the selected one is gone', () => {
    const overlay = openOverlay();
    overlay.moveSelection(2);
    overlay.refresh(html`<p>x</p>`, [{ id: 'one', label: 'Eins' }]);
    expect(overlay.selectedOptionId).toBe('one');
  });
});
