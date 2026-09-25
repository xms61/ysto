import { expect, test } from '@playwright/test';

for (const path of ['/', '/j/ABC234']) {
  test(`loads the app at ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('You Skipped The OP?!');
  });
}
