import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';

const DAYS = ['Mon 9 Nov', 'Tue 10 Nov', 'Wed 11 Nov', 'Thu 12 Nov', 'Fri 13 Nov'];

test.beforeEach(async ({ world }) => {
  world.now = new Date('2026-11-02T10:00:00Z');
  world.ok('admin@example.com', 'signIn');
  world.addUser('maria@example.com');
  world.addUser('nikos@example.com');
  for (const [name, latitude] of [
    ['Noel', 37.9772],
    ['Six d.o.g.s', 37.977],
  ] as const) {
    world.ok('admin@example.com', 'addVenue', {
      name,
      category: 'bar',
      latitude,
      longitude: 23.73,
    });
  }
  const { roundId } = world.ok<{ roundId: string }>('admin@example.com', 'createRound', {
    week: '2026-11-09',
    deadline: '2026-11-06T18:00:00.000Z',
  });
  world.ok('admin@example.com', 'openRound', { roundId });
});

async function answerAvailability(page: Page, answers: string[]) {
  for (const [index, answer] of answers.entries()) {
    await page.getByRole('group', { name: DAYS[index] }).getByLabel(answer).check();
  }
}

test('a member votes through all steps and reviews before submitting', async ({
  page,
  world,
  signIn,
}) => {
  await signIn('maria@example.com');
  await page.getByRole('link', { name: 'Vote now' }).click();

  await expect(page.getByText('not a commitment to attend')).toBeVisible();
  await answerAvailability(page, [
    'After work — 18:30',
    'After going home first — 21:00',
    'Unavailable',
    'No preference / Flexible',
    'After work — 18:30',
  ]);
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByLabel('Drinks', { exact: true }).check();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByLabel('Near home').check();
  await page.getByLabel('Area (optional)').fill('Pangrati');
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('region', { name: 'Venue map' }).waitFor();
  await page.getByLabel('Noel').check();
  await page.getByRole('button', { name: 'Next' }).click();

  const summary = page.getByRole('definition');
  await expect(summary).toHaveText([
    'After work — 18:30',
    'After going home first — 21:00',
    'Unavailable',
    'No preference / Flexible',
    'After work — 18:30',
    'Drinks',
    'Near home: Pangrati',
    'Noel',
  ]);

  await page.getByRole('button', { name: 'Submit vote' }).click();
  await expect(page.getByRole('status')).toContainText('your vote is saved');
  await expect(page.getByRole('status')).toContainText('You can change it until voting closes.');
  expect(world.db.votes.all()).toHaveLength(1);
});

test('every day needs an answer before continuing', async ({ page, signIn }) => {
  await signIn('maria@example.com');
  await page.getByRole('link', { name: 'Vote now' }).click();
  await answerAvailability(page, ['Unavailable', 'Unavailable']);

  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByRole('alert')).toHaveText('Answer every day of the week');
  await expect(page.getByRole('heading', { name: 'Availability' })).toBeVisible();
});

test('a member updates their vote starting from previous answers', async ({
  page,
  world,
  signIn,
}) => {
  const { roundId } = world.ok<{ roundId: string }>('maria@example.com', 'getCurrentRound');
  world.ok('maria@example.com', 'submitVote', {
    roundId,
    availability: Object.fromEntries(
      ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'].map((d) => [
        d,
        'flexible',
      ]),
    ),
    activity: 'drinks',
    location: 'central',
  });

  await signIn('maria@example.com');
  await expect(page.getByText('You have voted.')).toBeVisible();
  await page.getByRole('link', { name: 'Change my vote' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByLabel('Drinks', { exact: true })).toBeChecked();
  await page.getByLabel('Food', { exact: true }).check();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByRole('definition').nth(5)).toHaveText('Food');
  await expect(page.getByRole('definition').nth(7)).toHaveText('No particular preference');
  await page.getByRole('button', { name: 'Update vote' }).click();

  await expect(page.getByRole('status')).toContainText('your vote is saved');
  expect(world.db.votes.all()[0].activity).toBe('food');
});

test('members are told when voting has closed', async ({ page, world, signIn }) => {
  world.now = new Date('2026-11-06T18:00:00.000Z');

  await signIn('maria@example.com');

  await expect(
    page.getByText('Voting has closed for the week of Mon 9 Nov – Fri 13 Nov.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vote now' })).toBeHidden();
});

test('members added after opening are told they are not participants', async ({
  page,
  world,
  signIn,
}) => {
  world.addUser('eleni@example.com');

  await signIn('eleni@example.com');

  await expect(page.getByText('you are not a participant in this round')).toBeVisible();
});
