import type { Page } from '@playwright/test';
import { auditLayout, type Finding } from './layoutAudit';
import type { ScreenSize } from './screenMatrix';

const SETTLE_MS = 250;

export async function openHost(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__game?.getState === 'function');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.querySelector('.lil-gui')?.remove());
}

export interface Result {
  readonly size: ScreenSize;
  readonly findings: readonly Finding[];
}

export async function auditSizes(page: Page, sizes: readonly ScreenSize[]): Promise<Result[]> {
  const results: Result[] = [];
  const start = page.viewportSize()!;
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.waitForTimeout(SETTLE_MS);
    results.push({ size, findings: await auditLayout(page, { touch: size.touch }) });
  }
  await page.setViewportSize(start);
  await page.waitForTimeout(SETTLE_MS);
  return results;
}

/** The same problem on many sizes is one line with the sizes behind it. */
export function report(state: string, results: readonly Result[]): string {
  const groups = new Map<string, { example: string; sizes: string[] }>();
  for (const { size, findings } of results) {
    for (const finding of findings) {
      const key = `${finding.kind}|${finding.detail.replace(/[\d.,]+/g, '#')}`;
      const group = groups.get(key) ?? { example: `[${finding.kind}] ${finding.detail}`, sizes: [] };
      group.sizes.push(size.name);
      groups.set(key, group);
    }
  }
  if (groups.size === 0) return '';
  const lines = [...groups.values()].map(
    (group) => `  ${group.example}\n      bei ${group.sizes.length} Größen: ${group.sizes.slice(0, 6).join('; ')}${group.sizes.length > 6 ? ' …' : ''}`,
  );
  return `${state}: ${groups.size} Befunde\n${lines.join('\n')}`;
}
