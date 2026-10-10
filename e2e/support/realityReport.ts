import type { Page } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { auditLayout } from './layoutAudit';

/** Shared by the reality checks (`realityCheck.spec.ts`, `realityCheckGuest.spec.ts`): where the screenshots go and the written report. */
export const REALITY_DIR = process.env.REALITY_DIR ?? '/tmp/reality';
const REPORT = `${REALITY_DIR}/report.txt`;

export function note(line: string): void {
  mkdirSync(REALITY_DIR, { recursive: true });
  appendFileSync(REPORT, `${line}\n`);
}

/** The whole list, or only the names in a comma separated environment variable. */
export const pick = <T extends { name: string } | string>(all: readonly T[], env: string | undefined): readonly T[] => {
  if (!env) return all;
  const wanted = env.split(',');
  return all.filter((item) => wanted.includes(typeof item === 'string' ? item : item.name));
};

/** A screenshot at `name` (a path below the report folder) and the layout findings of that moment in the report. */
export async function lookAt(page: Page, name: string, touch: boolean): Promise<void> {
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelectorAll('.lil-gui').forEach((panel) => panel.remove()));
  const path = `${REALITY_DIR}/${name}.png`;
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path });
  const findings = await auditLayout(page, { touch });
  if (findings.length > 0)
    note(
      `${name}: ${findings.length} Befunde\n  ${findings
        .slice(0, 8)
        .map((finding) => `[${finding.kind}] ${finding.detail}`)
        .join('\n  ')}`,
    );
}
