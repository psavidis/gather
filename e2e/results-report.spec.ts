import { ADMIN, seedVotedRound } from '../backend/test/support/scenarios';
import { expect, test } from './support/fixtures';

test('the administrator reviews the results of a closed round', async ({ page, world, signIn }) => {
  const { roundId } = seedVotedRound(world);
  world.ok(ADMIN, 'closeRound', { roundId });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  await signIn(ADMIN);
  await page.getByRole('link', { name: 'Rounds' }).click();
  await page.getByRole('link', { name: 'View results' }).click();

  await expect(page.getByText('3 of 4 voted (75%). No response from Ada.')).toBeVisible();
  await expect(
    page
      .getByRole('table', { name: 'Availability per day' })
      .getByRole('row', { name: /Mon 9 Nov/ }),
  ).toHaveText(/Mon 9 Nov\s*2\s*3\s*0\s*0\s*1/);

  await page.getByLabel('From', { exact: true }).fill('19:00');
  await page.getByLabel('To', { exact: true }).fill('22:00');
  await page.getByRole('button', { name: 'Show window' }).click();
  await expect(
    page
      .getByRole('table', { name: 'Availability 19:00–22:00' })
      .getByRole('row', { name: /Mon 9 Nov/ }),
  ).toContainText('1 at 21:00');

  const top = page.getByRole('list', { name: 'Recommendations' }).getByRole('listitem').first();
  await expect(top).toContainText('Mon 9 Nov · 21:00 · Noel — score 14');
  await expect(top).toContainText(
    '3 available × 3 + 0 flexible × 1 + 2 venue picks × 2 + 1 activity match × 1 = 14',
  );

  await page.getByRole('button', { name: 'Copy report as text' }).click();
  await expect(page.getByRole('status')).toContainText('Copied');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('Participation: 3 of 4 voted (75%), 1 no response.');
  expect(copied).toContain('1. Mon 9 Nov 21:00 at Noel');
  expect(copied).not.toContain('Ada');
});

test('the report is not offered while voting is open', async ({ page, world, signIn }) => {
  seedVotedRound(world);

  await signIn(ADMIN);
  await page.getByRole('link', { name: 'Rounds' }).click();

  await expect(page.getByText('Open for voting')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View results' })).toBeHidden();
});
