import { ADMIN, seedVotedRound } from '../backend/test/support/scenarios';
import { expect, test } from './support/fixtures';

test.beforeEach(async ({ page, world, signIn }) => {
  const { roundId } = seedVotedRound(world);
  world.ok(ADMIN, 'closeRound', { roundId });
  await signIn(ADMIN);
  await page.getByRole('link', { name: 'Rounds' }).click();
  await page.getByRole('link', { name: 'View results' }).click();
});

test('the administrator publishes the outing, which anyone can see without signing in', async ({
  page,
  world,
  newPage,
}) => {
  const form = page.getByRole('form', { name: 'Publish the outing' });
  await expect(form.getByLabel(/^Venue/)).toHaveValue(/.+/);
  await expect(form.getByLabel(/^Time/)).toHaveValue('21:00');
  await expect(form.getByLabel('Expected participants (optional)')).toHaveValue('3');
  await form.getByLabel('Notes for participants (optional)').fill('First round is on the company');
  await form.getByRole('button', { name: 'Publish' }).click();

  const event = page.getByRole('article', { name: 'Team outing' });
  await expect(event).toContainText('Monday, 9 November 2026 at 21:00');
  await expect(event).toContainText('Noel');
  await expect(event).toContainText('Noel street 1, Athens');
  await expect(event).toContainText('First round is on the company');
  await expect(event).toContainText('3 people are expected.');
  await expect(event.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute(
    'href',
    'https://www.google.com/maps/place/Noel',
  );

  const visitor = await newPage();
  await visitor.goto(page.url().replace(/^.*#/, '/#'));
  await expect(visitor.getByRole('article', { name: 'Team outing' })).toContainText('Noel');
  await expect(visitor.getByRole('button', { name: 'Sign in with Google' })).toBeHidden();
  const visible = await visitor.locator('body').innerText();
  for (const secret of ['@example.com', 'Maria', 'Pangrati', 'Ada']) {
    expect(visible).not.toContain(secret);
  }

  await visitor.getByRole('link', { name: 'All outings' }).click();
  await expect(visitor.getByRole('list', { name: 'Upcoming outings' })).toContainText(
    'Monday, 9 November 2026 at 21:00 · Noel',
  );

  world.now = new Date('2026-11-10T09:00:00Z');
  await visitor.reload();
  await expect(visitor.getByRole('list', { name: 'Past outings' })).toContainText('Team outing');
});

test('the administrator can decide differently from the top recommendation', async ({ page }) => {
  const form = page.getByRole('form', { name: 'Publish the outing' });
  await form.getByLabel(/^Date/).selectOption('Fri 13 Nov');
  await form.getByLabel(/^Time/).fill('20:00');
  await form.getByLabel(/^Venue/).selectOption('Taverna');
  await form.getByRole('button', { name: 'Publish' }).click();

  await expect(page.getByRole('article', { name: 'Team outing' })).toContainText(
    'Friday, 13 November 2026 at 20:00',
  );
  await expect(page.getByRole('article', { name: 'Team outing' })).toContainText('Taverna');
});

test('members see the next outing on their home page', async ({ page, newPage, signIn, world }) => {
  await page
    .getByRole('form', { name: 'Publish the outing' })
    .getByRole('button', { name: 'Publish' })
    .click();
  await expect(page.getByRole('article', { name: 'Team outing' })).toBeVisible();

  const maria = await newPage();
  await signIn('maria@example.com', maria);

  await expect(maria.getByText('There is no voting round open right now.')).toBeVisible();
  await maria.getByRole('link', { name: /Next outing|Team outing/ }).click();
  await expect(maria.getByRole('article', { name: 'Team outing' })).toContainText('Noel');
  expect(world.db.events.all()).toHaveLength(1);
});
