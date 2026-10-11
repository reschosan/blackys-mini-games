import { expect, test, type Page } from '@playwright/test';
import { GAME_COUNT } from './support/gameCount';
import { phaseOf, PAD, tapButton } from './support/gamepad';
import { closeInvitation, connectGuest, FAKE_CAMERA_LAUNCH_ARGS, newHostAndContext, openInvitation, pressKey, tapElement } from './support/remoteGuest';

// lobby on a separate screen: a guest changes its cat, readies up and votes for the map on its own phone.
// The rules stay on the host; the guest draws what the host sends and passes taps and the cross on.

test.use({ launchOptions: { args: FAKE_CAMERA_LAUNCH_ARGS } });
test.setTimeout(120_000);

const GUEST_LOBBY = '[data-testid=guest-lobby]';
const HOST_CARD = '[data-testid=lobby] [data-player-index="1"]';

async function inTheLobby(browser: import('@playwright/test').Browser) {
  const { host, context } = await newHostAndContext(browser, false, true);
  await openInvitation(host);
  const guest = await connectGuest(host, context);
  await guest.setViewportSize({ width: 844, height: 390 });
  await closeInvitation(host);
  await expect(guest.locator(`${GUEST_LOBBY} c-cat-preview-card`)).toBeVisible({ timeout: 20_000 });
  return { host, guest, context };
}

const rowValue = (page: Page, scope: string, rowId: string): Promise<string | null> => page.locator(`${scope} [data-row-id="${rowId}"]`).getAttribute('value');
const activeRow = (page: Page, scope: string): Promise<string | null> => page.locator(`${scope} [data-row-id][active]`).first().getAttribute('data-row-id');

test.describe('the lobby on the guest phone', () => {
  test('the guest sees its own card with a cat view, and the cross moves the cursor on both screens', async ({ browser }) => {
    const { host, guest, context } = await inTheLobby(browser);
    await expect(guest.locator(`${GUEST_LOBBY} canvas`)).toBeVisible();
    await expect(guest.locator(`${GUEST_LOBBY} c-player-tag`)).not.toHaveText('');
    await expect(guest.locator('[data-join-view]')).toHaveCount(0);

    const before = await activeRow(guest, GUEST_LOBBY);
    await pressKey(guest, '#pad-down');
    await expect.poll(() => activeRow(guest, GUEST_LOBBY)).not.toBe(before);
    await expect.poll(async () => (await activeRow(guest, GUEST_LOBBY)) === (await activeRow(host, HOST_CARD))).toBe(true);
    await context.close();
  });

  test('tapping a row and its arrow on the guest changes the cat, on the guest and on the host', async ({ browser }) => {
    const { host, guest, context } = await inTheLobby(browser);
    const before = await rowValue(guest, GUEST_LOBBY, 'preset');
    await tapElement(guest, `${GUEST_LOBBY} [data-row-id="preset"]`);
    await expect.poll(() => activeRow(guest, GUEST_LOBBY)).toBe('preset');
    await tapElement(guest, `${GUEST_LOBBY} [data-row-id="preset"] [data-arrow="right"]`);
    await expect.poll(() => rowValue(guest, GUEST_LOBBY, 'preset')).not.toBe(before);
    await expect.poll(() => rowValue(host, HOST_CARD, 'preset')).toBe(await rowValue(guest, GUEST_LOBBY, 'preset'));
    await context.close();
  });

  test('ready on the guest, then both vote for a map on their own screens and the race starts', async ({ browser }) => {
    const { host, guest, context } = await inTheLobby(browser);
    await tapButton(host, PAD.CROSS);
    await tapElement(guest, `${GUEST_LOBBY} [data-row-id="ready"]`);
    await expect(guest.locator(`${GUEST_LOBBY}[data-stage=gameVote]`)).toBeVisible({ timeout: 10_000 });
    await expect(guest.locator(`${GUEST_LOBBY} c-map-vote-card`)).toHaveCount(GAME_COUNT);
    await tapElement(guest, `${GUEST_LOBBY} [data-game-index="1"]`);
    await tapElement(guest, `${GUEST_LOBBY} [data-game-index="1"]`);
    await tapButton(host, PAD.RIGHT);
    await expect
      .poll(
        async () => {
          await tapButton(host, PAD.CROSS);
          return guest.locator(`${GUEST_LOBBY} [data-row-id="kartType"]`).isVisible();
        },
        { timeout: 10_000 },
      )
      .toBe(true);
    await tapButton(host, PAD.CROSS);
    await tapElement(guest, `${GUEST_LOBBY} [data-row-id="ready"]`);
    await expect(guest.locator(`${GUEST_LOBBY}[data-stage=trackVote]`)).toBeVisible({ timeout: 10_000 });
    await expect(guest.locator(`${GUEST_LOBBY} [data-game-rules]`)).toContainText('Zeitfahren');
    await expect(guest.locator(`${GUEST_LOBBY} c-map-vote-card`)).toHaveCount(6);

    await tapElement(guest, `${GUEST_LOBBY} [data-map-index="1"]`);
    await expect(guest.locator(`${GUEST_LOBBY} c-map-vote-card[data-map-index="1"] c-chip`)).toHaveCount(1);
    await tapElement(guest, `${GUEST_LOBBY} [data-map-index="1"]`);
    await expect(guest.locator(`${GUEST_LOBBY} c-map-vote-card[data-map-index="1"] c-chip`)).toContainText('✓');
    await expect
      .poll(
        async () => {
          await tapButton(host, PAD.RIGHT);
          await tapButton(host, PAD.CROSS);
          return phaseOf(host);
        },
        { timeout: 20_000 },
      )
      .toBe('racing');
    await context.close();
  });

  test('while the host still invites, the guest phone shows only its cross and waits; the lobby comes when the host is in it', async ({ browser }) => {
    const { host, context } = await newHostAndContext(browser, false, true);
    await openInvitation(host);
    const guest = await connectGuest(host, context);
    await guest.setViewportSize({ width: 390, height: 844 });
    await expect(guest.locator('[data-join-view=connected]')).toBeVisible();
    await expect(guest.locator('#touch-navigation')).toBeVisible();
    await expect(guest.locator(`${GUEST_LOBBY} c-cat-preview-card`)).toHaveCount(0);
    await expect(guest.locator('[data-join-view=connected]')).toContainText('Warte auf den Gastgeber');
    await closeInvitation(host);
    await expect(guest.locator(`${GUEST_LOBBY} c-cat-preview-card`)).toBeVisible({ timeout: 20_000 });
    await context.close();
  });

  test('the guest can take its way back from the vote to the cat', async ({ browser }) => {
    const { host, guest, context } = await inTheLobby(browser);
    await tapButton(host, PAD.CROSS);
    await tapElement(guest, `${GUEST_LOBBY} [data-row-id="ready"]`);
    await expect(guest.locator(`${GUEST_LOBBY}[data-stage=gameVote]`)).toBeVisible({ timeout: 10_000 });
    await tapElement(guest, `${GUEST_LOBBY} [data-back-button]`);
    await expect(guest.locator(`${GUEST_LOBBY}[data-stage=customizing]`)).toBeVisible({ timeout: 10_000 });
    await context.close();
  });

  test('"Nur Controller" shows no lobby screen on the guest', async ({ browser }) => {
    const { guest, context } = await inTheLobby(browser);
    await tapElement(guest, '[data-guest-view]');
    await expect(guest.locator(GUEST_LOBBY)).toBeHidden();
    await expect(guest.locator('[data-join-view=connected]')).toBeVisible();
    await context.close();
  });

  test('the cat this phone remembers comes along to the next game', async ({ browser }) => {
    const { host, context } = await newHostAndContext(browser, false, true);
    await context.addInitScript(() => {
      window.localStorage.setItem(
        'blackys-mini-games:cat:guest',
        JSON.stringify({
          name: 'Mauzi',
          furColor: 'red',
          pattern: 'tabby',
          patternSecondaryColor: 'white',
          eyeColor: 'green',
          hairLength: 'long',
          mane: 'ruff',
        }),
      );
      window.localStorage.setItem('blackys-mini-games:kart:guest', JSON.stringify({ kartType: 'tank', wheels: 'standard', colorIndex: 2 }));
    });
    await openInvitation(host);
    const guest = await connectGuest(host, context);
    await guest.setViewportSize({ width: 844, height: 390 });
    await closeInvitation(host);
    await expect(guest.locator(`${GUEST_LOBBY} c-cat-preview-card`)).toBeVisible({ timeout: 20_000 });
    // The host takes the profile only while the cats are made: wait until it has it before everybody is ready.
    await expect.poll(() => host.evaluate(() => window.localStorage.getItem('blackys-mini-games:cat:remote:1') ?? '')).toContain('"furColor":"red"');
    // The whole cat is on the card of the game that is chosen: ready, both lock in the first game, and the kart card shows the cat the phone brought.
    await tapButton(host, PAD.CROSS);
    await tapElement(guest, `${GUEST_LOBBY} [data-row-id="ready"]`);
    await expect(guest.locator(`${GUEST_LOBBY}[data-stage=gameVote]`)).toBeVisible({ timeout: 10_000 });
    await tapElement(guest, `${GUEST_LOBBY} [data-game-index="0"]`);
    await tapElement(guest, `${GUEST_LOBBY} [data-game-index="0"]`);
    await expect
      .poll(
        async () => {
          await tapButton(host, PAD.CROSS);
          return guest.locator(`${GUEST_LOBBY} [data-row-id="kartType"]`).isVisible();
        },
        { timeout: 10_000 },
      )
      .toBe(true);
    await expect.poll(() => rowValue(guest, GUEST_LOBBY, 'furColor')).toBe('Rot');
    await expect.poll(() => rowValue(guest, GUEST_LOBBY, 'hairLength')).toBe('Lang');
    await expect.poll(() => rowValue(guest, GUEST_LOBBY, 'kartType')).toBe('Panzer');
    await context.close();
  });
});
