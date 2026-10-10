// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import '../../../src/shared/ui/components/index';
import { mount } from './mount';

interface WebTypes {
  readonly contributions: { readonly html: { readonly elements: readonly { readonly name: string }[] } };
}

const tags = (JSON.parse(readFileSync('web-types.json', 'utf8')) as WebTypes).contributions.html.elements.map((element) => element.name);

afterEach(() => document.body.replaceChildren());

describe('every component', () => {
  it('is listed for the IDE in web-types.json', () => {
    expect(tags.length).toBeGreaterThan(30);
  });

  it.each(tags)('%s is registered and renders without an error', async (tag) => {
    expect(customElements.get(tag), `${tag} is not registered; add it to src/ui/components/index.ts`).toBeDefined();
    const element = await mount(tag);
    expect(element.isConnected).toBe(true);
  });
});
