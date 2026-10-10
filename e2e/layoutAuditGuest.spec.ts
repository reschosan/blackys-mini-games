import { expect, test } from '@playwright/test';
import { installFakeGamepads, joinWithGamepad, PAD, tapButton } from './support/gamepad';
import { installFakePeerConnection } from './support/fakePeerConnection';
import { tapElement } from './support/layoutControls';
import { auditSizes, openHost, report } from './support/layoutReport';
import { closeInvitation, currentInviteCode, openGuestPage, pressKey, startRaceWithGuest } from './support/remoteGuest';
import { TOUCH_SCREENS } from './support/screenMatrix';

// The screens of a phone that joins the host (invitation, own lobby, own race, result page) on every phone and tablet size. Run with `npm run test:e2e:layout`.

test.setTimeout(20 * 60 * 1000);

// ---------------------------------------------------------------- phones that join the host

test.describe('guest page', () => {
  test('guest page: no code, answer code, lobby, race', async ({ browser }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL;
    const context = await browser.newContext({ ...(baseURL ? { baseURL } : {}), hasTouch: true, viewport: { width: 1280, height: 800 } });
    await installFakePeerConnection(context);
    const problems: string[] = [];
    try {
      const host = await context.newPage();
      await installFakeGamepads(host, 1);
      await openHost(host);
      await joinWithGamepad(host);
      await tapElement(host, '[data-invite-button]');
      await host.waitForFunction(() => window.__game.getState().invite.status === 'waiting');

      const withoutCode = await context.newPage();
      await withoutCode.goto('/join.html');
      await withoutCode.waitForSelector('[data-join-view=noCode]');
      problems.push(report('Beitreten ohne Code', await auditSizes(withoutCode, TOUCH_SCREENS)));
      await withoutCode.close();

      const { guest, answerCode } = await openGuestPage(context, await currentInviteCode(host));
      problems.push(report('Beitreten: Antwort-Code', await auditSizes(guest, TOUCH_SCREENS)));
      await host.evaluate((code) => window.__game.submitInviteScan(code), answerCode);
      await guest.waitForSelector('[data-join-seat]', { timeout: 20000 });
      await guest.waitForTimeout(600);
      problems.push(report('Beitreten: Warten, solange der Gastgeber einlädt (nur das Kreuz)', await auditSizes(guest, TOUCH_SCREENS)));

      await closeInvitation(host);
      await guest.waitForSelector('[data-testid=guest-lobby] canvas', { timeout: 20000 });
      await guest.waitForTimeout(600);
      problems.push(report('Beitreten: Lobby auf dem eigenen Bildschirm', await auditSizes(guest, TOUCH_SCREENS)));

      await tapButton(host, PAD.CROSS);
      await tapElement(guest, '[data-testid=guest-lobby] [data-row-id="ready"]');
      await guest.waitForSelector('[data-testid=guest-lobby][data-stage=gameVote]', { timeout: 10000 });
      await guest.waitForTimeout(600);
      problems.push(report('Beitreten: Spielauswahl auf dem eigenen Bildschirm', await auditSizes(guest, TOUCH_SCREENS)));
      await tapElement(guest, '[data-testid=guest-lobby] [data-game-index="0"]');
      await tapElement(guest, '[data-testid=guest-lobby] [data-game-index="0"]');
      await expect
        .poll(
          async () => {
            await tapButton(host, PAD.CROSS);
            return guest.locator('[data-testid=guest-lobby] [data-row-id="kartType"]').isVisible();
          },
          { timeout: 10000 },
        )
        .toBe(true);
      await guest.waitForTimeout(600);
      problems.push(report('Beitreten: Kartseite auf dem eigenen Bildschirm', await auditSizes(guest, TOUCH_SCREENS)));
      await tapButton(host, PAD.CROSS);
      await tapElement(guest, '[data-testid=guest-lobby] [data-row-id="ready"]');
      await guest.waitForSelector('[data-testid=guest-lobby][data-stage=trackVote]', { timeout: 10000 });
      await guest.waitForTimeout(600);
      problems.push(report('Beitreten: Kartenwahl auf dem eigenen Bildschirm', await auditSizes(guest, TOUCH_SCREENS)));
      await tapElement(guest, '[data-testid=guest-lobby] [data-back-button]');
      await guest.waitForSelector('[data-testid=guest-lobby][data-stage=gameVote]', { timeout: 10000 });
      await tapElement(guest, '[data-testid=guest-lobby] [data-back-button]');
      await guest.waitForSelector('[data-testid=guest-lobby][data-stage=customizing]', { timeout: 10000 });
      await guest.evaluate(() => document.querySelector('[data-guest-view]')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
      await startRaceWithGuest(host, guest);
      await guest.waitForSelector('[data-join-race]');
      problems.push(report('Beitreten: Rennen (nur Controller)', await auditSizes(guest, TOUCH_SCREENS)));
    } finally {
      await context.close();
    }
    expect(problems.filter(Boolean).join('\n'), 'Befunde').toBe('');
  });
});

for (const layout of ['overlay', 'split'] as const) {
  test(`guest page: the race on its own screen, layout ${layout}`, async ({ browser }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL;
    const context = await browser.newContext({ ...(baseURL ? { baseURL } : {}), hasTouch: true, viewport: { width: 1280, height: 800 } });
    await installFakePeerConnection(context);
    let problems = '';
    try {
      const host = await context.newPage();
      await installFakeGamepads(host, 1);
      await openHost(host);
      await joinWithGamepad(host);
      await tapElement(host, '[data-invite-button]');
      await host.waitForFunction(() => window.__game.getState().invite.status === 'waiting');
      const { guest, answerCode } = await openGuestPage(context, await currentInviteCode(host));
      await host.evaluate((code) => window.__game.submitInviteScan(code), answerCode);
      await guest.waitForFunction(() => (window.__guest?.getState() as { view: string } | undefined)?.view === 'connected', undefined, { timeout: 15000 });
      await closeInvitation(host);
      if (layout === 'split')
        await guest.evaluate(() => document.querySelector('[data-guest-layout]')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
      await startRaceWithGuest(host, guest);
      await guest.waitForFunction(() => (window.__guest!.getState() as { race: { ready: boolean } | null }).race?.ready === true, undefined, {
        timeout: 60000,
      });
      await host.waitForTimeout(5500);
      await guest.locator('#stick-zone').waitFor({ state: 'visible' });
      problems = report(`Beitreten: Rennen auf dem eigenen Bildschirm (${layout})`, await auditSizes(guest, TOUCH_SCREENS));
      await pressKey(guest, '#btn-pause');
      await guest.waitForSelector('[data-guest-pause]');
      problems += report(`Beitreten: Pause auf dem eigenen Bildschirm (${layout})`, await auditSizes(guest, TOUCH_SCREENS));
    } finally {
      await context.close();
    }
    expect(problems, 'Befunde').toBe('');
  });
}

test('guest page: the result page with "Nochmal" and the lobby, when the host plays nobody', async ({ browser }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  const context = await browser.newContext({ ...(baseURL ? { baseURL } : {}), hasTouch: true, viewport: { width: 1280, height: 800 } });
  await installFakePeerConnection(context);
  let problems = '';
  try {
    const host = await context.newPage();
    await openHost(host);
    await tapElement(host, '[data-invite-button]');
    await host.waitForFunction(() => window.__game.getState().invite.status === 'waiting');
    const { guest, answerCode } = await openGuestPage(context, await currentInviteCode(host));
    await host.evaluate((code) => window.__game.submitInviteScan(code), answerCode);
    await guest.waitForFunction(() => (window.__guest?.getState() as { view: string } | undefined)?.view === 'connected', undefined, { timeout: 15000 });
    await tapElement(host, '[data-option-id=inviteBack]');
    await tapElement(host, '[data-option-id=settingsBack]');
    await host.waitForSelector('[data-testid=menu]', { state: 'hidden' });
    await pressKey(guest, '#pad-ok');
    await host.waitForSelector('[data-testid=game-vote]', { state: 'visible', timeout: 8000 });
    await tapElement(guest, '[data-testid=guest-lobby] [data-game-index="0"]');
    await tapElement(guest, '[data-testid=guest-lobby] [data-game-index="0"]');
    await guest.waitForSelector('[data-testid=guest-lobby] [data-row-id=kartType]', { state: 'visible', timeout: 8000 });
    await tapElement(guest, '[data-testid=guest-lobby] [data-row-id="ready"]');
    await host.waitForSelector('[data-testid=map-vote]', { state: 'visible', timeout: 8000 });
    await tapElement(guest, '[data-testid=guest-lobby] [data-map-index="0"]');
    await tapElement(guest, '[data-testid=guest-lobby] [data-map-index="0"]');
    await host.waitForFunction(() => window.__game.getState().phase === 'racing', undefined, { timeout: 15000 });
    await guest.waitForFunction(() => (window.__guest!.getState() as { race: { ready: boolean } | null }).race?.ready === true, undefined, { timeout: 60000 });
    await host.waitForTimeout(2000);
    await host.evaluate(() => window.__game.showResultsForTest());
    await guest.waitForSelector('[data-result-option]', { timeout: 15000 });
    problems = report('Beitreten: Ergebnis mit Wahl (Gastgeber ohne Spieler)', await auditSizes(guest, TOUCH_SCREENS));
  } finally {
    await context.close();
  }
  expect(problems, 'Befunde').toBe('');
});
