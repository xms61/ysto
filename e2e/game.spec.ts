import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Two players in separate browser contexts play a whole game against the fixture server: a lobby by link,
// the host's settings, five rounds (the fewest a game allows) with clips, answers and reveals, then the
// results. Every clip must load and decode in each browser, or a reveal would mark its player "no audio".
const ROUNDS = 5;
const WAIT = { timeout: 20_000 };

async function playRound(page: Page, round: number, option: number): Promise<void> {
  await expect(page.getByRole('heading', { name: `Round ${round} of ${ROUNDS}` })).toBeVisible(WAIT);
  const choice = page.getByRole('list', { name: 'Options' }).getByRole('button').nth(option);
  await expect(choice).toBeEnabled(WAIT);
  await choice.click();
}

test('two players play a whole game', async ({ browser }) => {
  test.setTimeout(150_000);
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();

  await host.goto('/');
  await host.getByLabel('Your name').fill('Ann');
  await host.getByRole('button', { name: 'Create a lobby' }).click();
  await expect(host.getByRole('heading', { level: 1 })).toHaveText(/^Lobby [A-Z2-9]{6}$/);
  const link = await host.getByRole('textbox', { name: 'Join link' }).inputValue();

  await guest.goto(link);
  await guest.getByLabel('Your name').fill('Ben');
  await guest.getByRole('button', { name: /^Join lobby/ }).click();
  await expect(host.getByRole('list', { name: 'Players' })).toContainText('Ben');

  const start = host.getByRole('button', { name: 'Start game' });
  await expect(start).toBeDisabled();
  await host.getByLabel('Songs per game').fill(String(ROUNDS));
  await host.getByLabel('Songs per game').press('Enter');
  await host.getByLabel('Sample length').selectOption('10');
  await expect(guest.getByText(`${ROUNDS} songs, 10 s each`)).toBeVisible();
  await start.click();

  for (let round = 1; round <= ROUNDS; round++) {
    await playRound(host, round, 0);
    await playRound(guest, round, 1);
    for (const page of [host, guest]) {
      await expect(page.getByRole('heading', { name: 'The answer' })).toBeVisible(WAIT);
      await expect(page.getByText('no audio')).toHaveCount(0);
    }
  }

  for (const page of [host, guest]) {
    await expect(page.getByRole('heading', { name: 'Final results' })).toBeVisible(WAIT);
    const standings = page.getByRole('list', { name: 'Final standings' });
    await expect(standings).toContainText('Ann');
    await expect(standings).toContainText('Ben');
  }
  await expect(host.getByRole('button', { name: 'Play again' })).toBeVisible();
});
