import { readFile } from 'node:fs/promises';
import { ADMIN, seedVotedRound } from '../backend/test/support/scenarios';
import { expect, test } from './support/fixtures';

let eventId: string;

test.beforeEach(({ world }) => {
  const { roundId, noel } = seedVotedRound(world);
  world.ok(ADMIN, 'closeRound', { roundId });
  ({ eventId } = world.ok<{ eventId: string }>(ADMIN, 'publishEvent', {
    roundId,
    date: '2026-11-09',
    time: '21:00',
    venueId: noel,
    notes: 'First round is on the company',
  }));
});

test('the administrator downloads a PNG of the event', async ({ page, signIn }) => {
  await signIn(ADMIN);
  await page.goto(`/#/events/${eventId}`);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download image for Slack' }).click(),
  ]);

  expect(download.suggestedFilename()).toBe('outing-2026-11-09.png');
  const png = await readFile((await download.path())!);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
});

test('visitors are not offered the export', async ({ page }) => {
  await page.goto(`/#/events/${eventId}`);

  await expect(page.getByRole('article', { name: 'Team outing' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download image for Slack' })).toBeHidden();
});
