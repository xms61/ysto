import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Accessibility (docs/DESIGN.md#accessibility): axe finds no serious or critical issue on any screen, in any
// theme. One player plays a whole game, and each screen is checked in every theme on the way. The
// themes' token contrast is also checked on its own, in src/themes.test.ts.
const THEMES = [
  'tokyo-rain',
  'konbini',
  'karaoke',
  'sakura',
  'omikuji',
  'blossom-map',
  'shonen',
  'tournament-arc',
  'splash-page',
  'night-arc',
  'mecha',
  'magical-girl',
  'isekai',
  'retro-vhs',
  'side-a',
];
const ROUNDS = 5;
const WAIT = { timeout: 20_000 };

// Each theme is switched on the page directly, with motion reduced so no transition is caught halfway. Every
// rule runs in the first theme; the others only change colors, so they rerun contrast alone, which keeps an
// audit of every theme shorter than a round.
async function audit(page: Page, screen: string, found: string[]): Promise<void> {
  for (const [at, theme] of THEMES.entries()) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
      document.documentElement.dataset.motion = 'reduced';
    }, theme);
    const axe = new AxeBuilder({ page });
    const { violations } = await (at === 0 ? axe : axe.withRules(['color-contrast'])).analyze();
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
  test.setTimeout(240_000);
  const found: string[] = [];

  await page.goto('/');
  await audit(page, 'home', found);
  await page.getByLabel('Your name').fill('Ann');
  await page.getByRole('button', { name: 'Create a lobby' }).click();
  await expect(page.getByRole('textbox', { name: 'Join link' })).toBeVisible();
  await audit(page, 'lobby', found);
  await page.getByText('Preferences', { exact: true }).click();
  await audit(page, 'preferences', found);
  await page.getByRole('button', { name: /choose a world$/ }).click();
  await expect(page.getByRole('dialog', { name: 'Choose a world' })).toBeVisible();
  await audit(page, 'theme picker', found);
  await page.getByRole('dialog').getByRole('button', { name: 'Back' }).click();

  await page.getByLabel('Songs per game').fill(String(ROUNDS));
  await page.getByLabel('Songs per game').press('Enter');
  await page.getByLabel('Sample length').selectOption('30');
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.getByText('Get ready')).toBeVisible(WAIT);
  await audit(page, 'countdown', found);
  await expect(page.getByRole('list', { name: 'Options' }).getByRole('button').first()).toBeEnabled(WAIT);
  await audit(page, 'round', found);
  // Answering ends a one-player round at once, so the reveal is audited from its start.
  await page.getByRole('list', { name: 'Options' }).getByRole('button').first().click();
  await expect(page.getByRole('heading', { name: 'The answer' })).toBeVisible(WAIT);
  await audit(page, 'reveal', found);

  for (let round = 2; round <= ROUNDS; round++) await answerWhenOpen(page, round);
  await expect(page.getByRole('heading', { name: 'Final results' })).toBeVisible(WAIT);
  await audit(page, 'results', found);

  expect(found).toEqual([]);
});
