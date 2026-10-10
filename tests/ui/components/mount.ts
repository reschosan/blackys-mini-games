interface Updatable extends HTMLElement {
  readonly updateComplete: Promise<boolean>;
}

/** Puts a component into the page, sets its properties and text, and waits until it has rendered. */
export async function mount<T extends Updatable>(tag: string, properties: Record<string, unknown> = {}, text = ''): Promise<T> {
  const element = document.createElement(tag) as T;
  Object.assign(element, properties);
  element.textContent = text;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

export async function update<T extends Updatable>(element: T, properties: Record<string, unknown>): Promise<void> {
  Object.assign(element, properties);
  await element.updateComplete;
}
