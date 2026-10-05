import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// The listening rings start on the headphones (src/components/Listening.tsx). The ring field is measured in
// script, so a layout change that moves the headphones inside a panel that keeps its size, such as the
// countdown giving way to a world's timer, must move the rings' center with them. One player plays a game on a
// phone, where the stage keeps a fixed height, in a different world each round: the default and the worlds that
// draw their own timer. Each round is checked before it starts and while answering.
const THEMES = ['tokyo-rain', 'sakura', 'shonen', 'konbini', 'mecha'];
const WAIT = { timeout: 20_000 };

test.use({ viewport: { width: 375, height: 812 } });

// How far, in pixels, the rings' center sits from the headphones' center.
async function ringOffset(page: Page): Promise<number> {
  return page.evaluate(() => {
    const field = document.querySelector<HTMLElement>('.sonar-field');
    const core = document.querySelector<HTMLElement>('.sonar-core');
    if (!field || !core) return Number.POSITIVE_INFINITY;
    const style = getComputedStyle(field);
    const fieldBox = field.getBoundingClientRect();
    const coreBox = core.getBoundingClientRect();
    const x = fieldBox.left + parseFloat(style.getPropertyValue('--ring-x'));
    const y = fieldBox.top + parseFloat(style.getPropertyValue('--ring-y'));
    return Math.hypot(x - (coreBox.left + coreBox.width / 2), y - (coreBox.top + coreBox.height / 2));
  });
}

async function expectRingOnHeadphones(page: Page, where: string): Promise<void> {
  await expect.poll(() => ringOffset(page), { message: where, timeout: 2_000 }).toBeLessThan(1);
}

test('the rings center on the headphones in every phase', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem('ysto_prefs', JSON.stringify({ motion: 'reduced' }));
  });
  await page.goto('/');
  await page.getByLabel('Your name').fill('Ann');
  await page.getByRole('button', { name: 'Create a lobby' }).click();
  await page.getByLabel('Songs per game').fill(String(THEMES.length));
  await page.getByLabel('Songs per game').press('Enter');
  await page.getByRole('button', { name: 'Start game' }).click();

  for (const [at, theme] of THEMES.entries()) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await expect(page.getByRole('heading', { name: `Round ${at + 1} of ${THEMES.length}` })).toBeVisible(WAIT);
    await expectRingOnHeadphones(page, `${theme}, before the round starts`);
    const first = page.getByRole('list', { name: 'Options' }).getByRole('button').first();
    await expect(first).toBeEnabled(WAIT);
    await expectRingOnHeadphones(page, `${theme}, while answering`);
    await first.click();
    await expect(page.getByRole('heading', { name: 'The answer' })).toBeVisible(WAIT);
  }
});
