import { expect, test } from '@playwright/test';

// One player plays today's Openings daily against the fixture server, whose secret turns the dailies on (its
// catalog has only openings): the home screen offers all three, the private lobby starts on its own, ten rounds
// play, and the result shows the day, the daily and a streak of one day; the home screen then offers Openings again
// as practice, and the other two to play.
const ROUNDS = 10;
const WAIT = { timeout: 20_000 };

// Its own address (the fixture server trusts one proxy hop), so its lobby doesn't count against the other tests'
// creations a minute.
test.use({ extraHTTPHeaders: { 'x-forwarded-for': '10.20.0.1' } });

test("plays today's Openings daily and counts its streak alone", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/');
  await page.getByLabel('Your name').fill('Ann');
  await page.getByRole('button', { name: 'Play Openings' }).click();
  for (let round = 1; round <= ROUNDS; round++) {
    await expect(page.getByRole('heading', { name: `Round ${round} of ${ROUNDS}` })).toBeVisible(WAIT);
    const choice = page.getByRole('list', { name: 'Options' }).getByRole('button').first();
    await expect(choice).toBeEnabled(WAIT);
    await choice.click();
  }
  const result = page.getByRole('region', { name: "Today's result" });
  await expect(result).toBeVisible(WAIT);
  await expect(result).toContainText(/Daily No\. \d+ · Openings · \d+\/10/);
  await expect(result).toContainText('1 day in a row');
  await page.getByRole('button', { name: 'Leave' }).click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page.getByRole('button', { name: 'Practice Openings' })).toBeVisible(WAIT);
  await expect(page.getByRole('button', { name: 'Play Endings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play Both' })).toBeVisible();
});
