import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Accessibility (docs/DESIGN.md#accessibility): axe finds no serious or critical issue on any screen, in any
// theme. One player plays a whole game, and each screen is checked in all three themes on the way. The
// themes' token contrast is also checked on its own, in src/themes.test.ts.
const THEMES = ['tokyo-rain', 'sakura', 'shonen', 'mecha', 'magical-girl', 'isekai', 'retro-vhs'];
const ROUNDS = 5;
const WAIT = { timeout: 20_000 };

// Each theme is switched on the page directly, with motion reduced so no transition is caught halfway.
async function audit(page: Page, screen: string, found: string[]): Promise<void> {
  for (const theme of THEMES) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
      document.documentElement.dataset.motion = 'reduced';
    }, theme);
    const { violations } = await new AxeBuilder({ page }).analyze();
    for (const violation of violations) {
      if (violation.impact !== 'serious' && violation.impact !== 'critical') continue;
      const where = violation.nodes.map((node) => node.target.join(' ')).join(', ');
      found.push(`${screen}, ${theme}: ${violation.id} at ${where}`);
    }
  }
}

async function answerWhenOpen(page: Page, round: number): Promise<void> {
  await expect(page.getByRole('heading', { name: `Round ${round} of ${ROUNDS}` })).toBeVisible(WAIT);
  const first = page.getByRole('list', { name: 'Options' }).getByRole('button').first();
  await expect(first).toBeEnabled(WAIT);
  await first.click();
}

test('every screen passes axe in every theme', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'axe reads the same page in every browser; one is enough');
  test.setTimeout(150_000);
  const found: string[] = [];

  await page.goto('/');
  await audit(page, 'home', found);
  await page.getByLabel('Your name').fill('Ann');
  await page.getByRole('button', { name: 'Create a lobby' }).click();
  await expect(page.getByRole('textbox', { name: 'Join link' })).toBeVisible();
  await audit(page, 'lobby', found);
  await page.getByText('Preferences', { exact: true }).click();
  await audit(page, 'preferences', found);
  await page.getByText('Preferences', { exact: true }).click();

  await page.getByLabel('Songs per game').fill(String(ROUNDS));
  await page.getByLabel('Songs per game').press('Enter');
  await page.getByLabel('Sample length').selectOption('10');
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.getByText('Get ready')).toBeVisible(WAIT);
  await audit(page, 'countdown', found);
  await expect(page.getByRole('list', { name: 'Options' }).getByRole('button').first()).toBeEnabled(WAIT);
  await audit(page, 'round', found);
  await expect(page.getByRole('heading', { name: 'The answer' })).toBeVisible(WAIT);
  await audit(page, 'reveal', found);

  for (let round = 2; round <= ROUNDS; round++) await answerWhenOpen(page, round);
  await expect(page.getByRole('heading', { name: 'Final results' })).toBeVisible(WAIT);
  await audit(page, 'results', found);

  expect(found).toEqual([]);
});
