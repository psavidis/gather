import { expect, test } from './support/fixtures';

test.beforeEach(async ({ page, world, signIn }) => {
  world.now = new Date('2026-11-02T10:00:00Z');
  world.addUser('maria@example.com');
  await signIn('admin@example.com');
  await page.getByRole('link', { name: 'Rounds' }).click();
});

async function createDraft(page: import('@playwright/test').Page) {
  await page.getByLabel('Week').fill('2026-11-11');
  await page.getByLabel('Voting deadline').fill('2026-11-06T18:00');
  await page.getByRole('button', { name: 'Create draft round' }).click();
}

test('the administrator creates, opens, closes and reopens a round', async ({ page }) => {
  await createDraft(page);
  const round = page.getByRole('article', { name: 'Current round' });
  await expect(round).toContainText('Week of Mon 9 Nov – Fri 13 Nov');
  await expect(round).toContainText('Draft — not open for voting yet');

  await round.getByRole('button', { name: 'Open voting' }).click();
  await expect(round).toContainText('Open for voting');
  await expect(round).toContainText('0 of 2 have voted');

  await round.getByRole('button', { name: 'Close voting' }).click();
  await expect(round).toContainText('Voting closed');

  await round.getByLabel('New deadline').fill('2026-11-07T12:00');
  await round.getByRole('button', { name: 'Reopen voting' }).click();
  await expect(round).toContainText('Open for voting');
  await expect(round).toContainText('Sat 7 Nov, 12:00');
});

test('a deadline in the past is refused', async ({ page }) => {
  await page.getByLabel('Week').fill('2026-11-11');
  await page.getByLabel('Voting deadline').fill('2026-10-30T18:00');
  await page.getByRole('button', { name: 'Create draft round' }).click();

  await expect(page.getByRole('alert')).toHaveText('The deadline must be in the future');
});

test('a draft can be deleted', async ({ page }) => {
  await createDraft(page);

  await page.getByRole('button', { name: 'Delete draft' }).click();

  await expect(page.getByRole('button', { name: 'Create draft round' })).toBeVisible();
});
