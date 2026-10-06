import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

// Party mode against the fixture server: a host and a guest on phones, and a laptop that joins by the link as the
// screen. The screen fetches the clips and the phones don't; the phones answer, the screen shows the reveal, and no
// phone is marked "no audio". Each device has its own address, so the per-IP limits don't collide.
const WAIT = { timeout: 20_000 };

async function device(browser: Browser, address: string, clips: string[]): Promise<Page> {
  const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': address } });
  const page = await context.newPage();
  page.on('request', (request) => {
    if (request.url().includes('/api/clips/')) clips.push(request.url());
  });
  return page;
}

test('a screen plays the sound while the phones answer', async ({ browser }) => {
  test.setTimeout(120_000);
  const phoneClips: string[] = [];
  const screenClips: string[] = [];
  const host = await device(browser, '10.30.0.1', phoneClips);
  const guest = await device(browser, '10.30.0.2', phoneClips);
  const screen = await device(browser, '10.30.0.3', screenClips);

  await host.goto('/');
  await host.getByLabel('Your name').fill('Ann');
  await host.getByRole('button', { name: 'Create a lobby' }).click();
  const link = await host.getByRole('textbox', { name: 'Join link' }).inputValue();
  await host.getByLabel('Songs per game').fill('5');
  await host.getByLabel('Songs per game').press('Enter');
  await host.getByLabel(/^Party mode:/).check();

  await screen.goto(link);
  await screen.getByRole('button', { name: 'Use as the screen' }).click();
  await guest.goto(link);
  await guest.getByLabel('Your name').fill('Ben');
  await guest.getByRole('button', { name: /^Join lobby/ }).click();
  await expect(host.getByRole('list', { name: 'Players' })).toContainText('screen');
  await expect(host.getByRole('heading', { name: 'Players (2)' })).toBeVisible();

  await host.getByRole('button', { name: 'Start game' }).click();
  await expect(screen.getByText('This screen plays the sound. Answer on your phones.')).toBeVisible(WAIT);
  for (const page of [host, guest]) {
    const choice = page.getByRole('list', { name: 'Options' }).getByRole('button').first();
    await expect(choice).toBeEnabled(WAIT);
    await choice.click();
  }
  await expect(screen.getByRole('heading', { name: 'The answer' })).toBeAttached(WAIT);
  await expect(screen.getByRole('list', { name: 'Scores' })).not.toContainText('no audio');
  expect(screenClips.length).toBeGreaterThan(0);
  expect(phoneClips).toEqual([]);
});
