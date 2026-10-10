import { expect, type Page } from '@playwright/test';

/** PSP names for the standard gamepad buttons, as the game reads them. */
export const PAD = {
  CROSS: 0,
  CIRCLE: 1,
  SQUARE: 2,
  TRIANGLE: 3,
  L: 4,
  R: 5,
  SELECT: 8,
  START: 9,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
} as const;

const TAP_MS = 120;
export const RACE_START_LOCK_MS = 3600;

interface FakePad {
  connected: boolean;
  buttons: { pressed: boolean }[];
  axes: number[];
}
type WindowWithPads = Window & { fakePads: FakePad[] };

/** Plugs in `count` fake gamepads before the page starts; call before `page.goto`. */
export async function installFakeGamepads(page: Page, count = 1): Promise<void> {
  await page.addInitScript((padCount) => {
    const pads = Array.from({ length: padCount }, () => ({
      connected: true,
      buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
      axes: [0, 0, 0, 0],
    }));
    (window as unknown as WindowWithPads).fakePads = pads;
    Object.defineProperty(navigator, 'getGamepads', { value: () => pads.map((pad) => (pad.connected ? pad : null)), configurable: true });
  }, count);
}

export async function openGame(page: Page, padCount = 1): Promise<void> {
  if (padCount > 0) await installFakeGamepads(page, padCount);
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  await page.waitForLoadState('networkidle');
}

export async function holdButton(page: Page, button: number, pressed: boolean, padIndex = 0): Promise<void> {
  await page.evaluate(
    ([pad, index, value]) => {
      (window as unknown as WindowWithPads).fakePads[pad as number]!.buttons[index as number]!.pressed = value as boolean;
    },
    [padIndex, button, pressed],
  );
}

export async function tapButton(page: Page, button: number, padIndex = 0): Promise<void> {
  await holdButton(page, button, true, padIndex);
  await page.waitForTimeout(TAP_MS);
  await holdButton(page, button, false, padIndex);
  await page.waitForTimeout(TAP_MS);
}

export async function setAxis(page: Page, axis: number, value: number, padIndex = 0): Promise<void> {
  await page.evaluate(
    ([pad, index, amount]) => {
      (window as unknown as WindowWithPads).fakePads[pad as number]!.axes[index as number] = amount as number;
    },
    [padIndex, axis, value],
  );
}

export async function setPadConnected(page: Page, connected: boolean, padIndex = 0): Promise<void> {
  await page.evaluate(
    ([pad, value]) => {
      (window as unknown as WindowWithPads).fakePads[pad as number]!.connected = value as boolean;
    },
    [padIndex, connected],
  );
}

export async function activeRowId(page: Page): Promise<string | null> {
  return page.evaluate(() => document.querySelector('c-cat-preview-card [data-row-id][active]')?.getAttribute('data-row-id') ?? null);
}

export async function playerCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__game.getState().playerCount);
}

export async function phaseOf(page: Page): Promise<string> {
  return page.evaluate(() => window.__game.getState().phase);
}

/** Joins the gamepad with any button and waits until the lobby has its kart. */
export async function joinWithGamepad(page: Page, padIndex = 0): Promise<void> {
  const before = await playerCount(page);
  await tapButton(page, PAD.CROSS, padIndex);
  await page.waitForFunction((count) => window.__game.getState().playerCount > count, before);
}

/** The game vote comes right after everyone is ready: every listed pad locks in the first game, the race. */
export async function chooseDefaultGame(page: Page, padIndexes: readonly number[] = [0]): Promise<void> {
  await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });
  for (const padIndex of padIndexes) await tapButton(page, PAD.CROSS, padIndex);
  await chooseDefaultVehicle(page, padIndexes);
}

/** The kart race needs a kart: after the vote every listed pad takes the kart it has (the card shows the kart rows) and is ready again. */
export async function chooseDefaultVehicle(page: Page, padIndexes: readonly number[] = [0]): Promise<void> {
  await page.waitForSelector('[data-testid=lobby] [data-row-id=kartType]', { state: 'visible', timeout: 5000 });
  for (const padIndex of padIndexes) await tapButton(page, PAD.CROSS, padIndex);
}

/** Joins, sets ready with the cross (works on every row), takes the first game and votes once for the only map. Waits for the race. */
export async function startRaceWithGamepad(page: Page, padIndex = 0): Promise<void> {
  await joinWithGamepad(page, padIndex);
  await tapButton(page, PAD.CROSS, padIndex);
  await chooseDefaultGame(page, [padIndex]);
  await page.waitForSelector('[data-testid=map-vote]', { state: 'visible', timeout: 5000 });
  await tapButton(page, PAD.CROSS, padIndex);
  await page.waitForFunction(() => window.__game.getState().phase === 'racing', undefined, { timeout: 5000 });
}

/** The whole card of a kart game: ready, lock in the race in the game vote, and the card shows the cat and the kart. Needs a joined player. */
export async function openFullCard(page: Page, padIndex = 0): Promise<void> {
  await tapButton(page, PAD.CROSS, padIndex);
  await page.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 5000 });
  await tapButton(page, PAD.CROSS, padIndex);
  await page.waitForSelector('[data-testid=lobby] [data-row-id=kartType]', { state: 'visible', timeout: 5000 });
}

/** Moves the cursor of an open menu down until it stands on the option. A menu takes keys only once every key was let go since it opened,
 *  so a press right after opening can be lost: it repeats until the cursor gets there. */
export async function moveMenuCursorTo(page: Page, optionId: string): Promise<void> {
  const active = page.locator('[data-testid=menu] c-button[active]');
  await expect
    .poll(
      async () => {
        if ((await active.getAttribute('data-option-id')) !== optionId) await tapButton(page, PAD.DOWN);
        return active.getAttribute('data-option-id');
      },
      { timeout: 10_000 },
    )
    .toBe(optionId);
}

/** Moves the cursor of the first card down (it wraps round) until it stands on the row (the name row is the player tag at the top: nothing in the list is active then). */
export async function goToRow(page: Page, rowId: string, padIndex = 0): Promise<void> {
  const active = page.locator('[data-slot=player]').first().locator('[data-row-id][active]');
  const current = async (): Promise<string | null> => ((await active.count()) === 0 ? 'name' : active.getAttribute('data-row-id'));
  for (let attempt = 0; attempt < 14 && (await current()) !== rowId; attempt += 1) await tapButton(page, PAD.DOWN, padIndex);
  if (rowId === 'name') await expect(active).toHaveCount(0);
  else await expect(active).toHaveAttribute('data-row-id', rowId);
}
