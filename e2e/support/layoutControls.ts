import type { Page } from '@playwright/test';
import { joinWithGamepad, PAD, tapButton } from './gamepad';

export async function tapElement(page: Page, selector: string): Promise<void> {
  await page.evaluate((query) => document.querySelector(query)!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })), selector);
  await page.waitForTimeout(200);
}

/** What a player presses in each device profile: the gamepad buttons, or the keys on the screen. */
export interface Controls {
  join(page: Page): Promise<void>;
  confirm(page: Page): Promise<void>;
  down(page: Page): Promise<void>;
  right(page: Page): Promise<void>;
  settings(page: Page): Promise<void>;
  aiFill(page: Page): Promise<void>;
}

async function tapKey(page: Page, selector: string): Promise<void> {
  await page.waitForTimeout(200);
  await page.locator(selector).tap();
  await page.waitForTimeout(150);
}

export const GAMEPAD_CONTROLS: Controls = {
  join: (page) => joinWithGamepad(page),
  confirm: (page) => tapButton(page, PAD.CROSS),
  down: (page) => tapButton(page, PAD.DOWN),
  right: (page) => tapButton(page, PAD.RIGHT),
  settings: (page) => tapButton(page, PAD.SELECT),
  aiFill: (page) => tapButton(page, PAD.START),
};

export const TOUCH_CONTROLS: Controls = {
  join: async (page) => {
    await page.waitForFunction(() => window.__game.getState().playerCount === 1);
  },
  confirm: (page) => tapKey(page, '#pad-ok'),
  down: (page) => tapKey(page, '#pad-down'),
  right: (page) => tapKey(page, '#pad-right'),
  settings: (page) => tapKey(page, '#btn-menu'),
  aiFill: async (page) => {
    await tapElement(page, '[data-ai-fill-button]');
  },
};
