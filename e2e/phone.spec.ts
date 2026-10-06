import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Layout on a phone, where the stage keeps a fixed height. One player opens a lobby and plays a game in a
// different world each round: the default and the worlds that draw their own timer.
// - The lobby's start bar stands on the viewport's foot, also at the end of the scroll (src/screens/Lobby.tsx).
// - The cards keep their place and size from answering to the reveal (src/components/Stage.tsx and
//   OptionCard.tsx): the slot above them holds the verdict's height, and each card the height of its back.
const THEMES = ['tokyo-rain', 'sakura', 'shonen', 'mecha', 'karaoke', 'isekai'];
const WAIT = { timeout: 20_000 };

test.use({ viewport: { width: 375, height: 812 } });

// Each card's box, rounded to whole pixels.
async function cardBoxes(page: Page): Promise<number[][]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.options > li > .card')].map((card) => {
      const box = card.getBoundingClientRect();
      return [box.top, box.left, box.width, box.height].map(Math.round);
    }),
  );
}

// How far, in pixels, the start bar's foot sits from the viewport's foot, scrolled to the end of the lobby.
async function startBarGap(page: Page): Promise<number> {
  return page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const bar = document.querySelector('.start-bar');
    return bar ? Math.abs(window.innerHeight - bar.getBoundingClientRect().bottom) : Number.POSITIVE_INFINITY;
  });
}

test('the start bar stands on the foot and the cards stay put at the reveal', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem('ysto_prefs', JSON.stringify({ motion: 'reduced' }));
  });
  await page.goto('/');
  await page.getByLabel('Your name').fill('Ann');
  await page.getByRole('button', { name: 'Create a lobby' }).click();
  await page.getByLabel('Songs per game').fill(String(THEMES.length));
  await page.getByLabel('Songs per game').press('Enter');
  for (const theme of THEMES) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await expect.poll(() => startBarGap(page), { message: `${theme}, the start bar` }).toBeLessThan(1);
  }
  await page.getByRole('button', { name: 'Start game' }).click();

  for (const [at, theme] of THEMES.entries()) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await expect(page.getByRole('heading', { name: `Round ${at + 1} of ${THEMES.length}` })).toBeVisible(WAIT);
    const first = page.getByRole('list', { name: 'Options' }).getByRole('button').first();
    await expect(first).toBeEnabled(WAIT);
    const answering = await cardBoxes(page);
    await first.click();
    await expect(page.getByRole('heading', { name: 'The answer' })).toBeAttached(WAIT);
    await expect.poll(() => cardBoxes(page), { message: `${theme}, the cards at the reveal` }).toEqual(answering);
  }
});
