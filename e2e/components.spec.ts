import { expect, test } from '@playwright/test';

test('the component gallery renders every component without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/components.html');
  await expect(page.locator('[data-testid=gallery]')).toBeVisible();

  const tags = await page.evaluate(() => [
    ...new Set([...document.querySelectorAll('*')].map((element) => element.localName).filter((name) => name.startsWith('c-'))),
  ]);
  expect(tags.length).toBeGreaterThan(20);
  for (const tag of tags) expect(await page.evaluate((name) => customElements.get(name) !== undefined, tag), tag).toBe(true);

  expect(errors).toEqual([]);
});

test('button modes, sizes and the compact flag change how the button looks', async ({ page }) => {
  await page.goto('/components.html');
  const button = (label: string) => page.locator(`c-button[label="${label}"] button`);

  await expect(button('Cancel')).toHaveClass(/border-cancel/);
  await expect(button('Success')).toHaveClass(/border-success/);
  await expect(button('Default m')).toHaveClass(/border-line/);

  const regular = await button('Default m').boundingBox();
  const compact = await button('Compact').boundingBox();
  const large = await button('Default l').boundingBox();
  expect(compact!.height).toBeLessThan(regular!.height);
  expect(large!.height).toBeGreaterThan(regular!.height);
});

test('the header level sets the size and the ARIA level, level 1 is the default', async ({ page }) => {
  await page.goto('/components.html');
  const sizes = await page.evaluate(() =>
    [1, 2, 3, 4].map((level) => {
      const element = [...document.querySelectorAll('c-header')].find((header) => header.textContent === `Level ${level}`)!;
      return { level: element.getAttribute('aria-level'), size: parseFloat(getComputedStyle(element).fontSize) };
    }),
  );
  expect(sizes.map((entry) => entry.level)).toEqual(['1', '2', '3', '4']);
  expect(sizes[0]!.size).toBeGreaterThan(sizes[1]!.size);
  expect(sizes[1]!.size).toBeGreaterThan(sizes[2]!.size);
  expect(await page.locator('c-header').first().getAttribute('aria-level')).toBe('1');
});

test('a disabled button swallows clicks so handlers of parent elements never see them', async ({ page }) => {
  await page.goto('/components.html');
  const disabled = page.locator('c-button[disabled]');
  await expect(disabled).toHaveAttribute('aria-disabled', 'true');
  await page.evaluate(() => {
    (window as unknown as { __clicks: string[] }).__clicks = [];
    document.body.addEventListener('pointerup', (event) => (window as unknown as { __clicks: string[] }).__clicks.push((event.target as Element).localName));
  });

  const box = (await disabled.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  const targets = await page.evaluate(() => (window as unknown as { __clicks: string[] }).__clicks);
  expect(targets).not.toContain('c-button');
  await expect(page.locator('c-button[label="Default m"]')).not.toHaveAttribute('aria-disabled', 'true');
});

test('the checkbox keeps its checked property in sync with clicks', async ({ page }) => {
  await page.goto('/components.html');
  const checkbox = page.locator('c-checkbox').first();
  const isChecked = () => checkbox.evaluate((element) => (element as HTMLElement & { checked: boolean }).checked);

  expect(await isChecked()).toBe(true);
  await checkbox.locator('input').click();
  expect(await isChecked()).toBe(false);
  await checkbox.locator('input').click();
  expect(await isChecked()).toBe(true);
});
